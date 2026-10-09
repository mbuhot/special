import type { Analysis, AstValue, NarrationNode, ScenarioNode, StepNode } from "./ast.js";
import type { Dialect, EmissionRule, ResolvedStep } from "./dialect.js";
import type { Line } from "./markdown.js";
import type { Lexicon, Match, Matcher, SlotDescriptor } from "./pattern.js";
import { scopeKeyOf, type Entry, type Registry } from "./registry.js";

export interface Composite {
  header: string;
  matcher: Matcher;
  children: Line[];
  line: number;
}

export interface ScenarioEnvironment {
  dialect: Dialect;
  registry: Registry;
  composites: readonly Composite[];
  analysis: Analysis;
  usedSurfaces: Set<string>;
  scenarioName: string;
  report(line: number, message: string): void;
}

interface StepScope {
  line: number;
  values: Map<string, string>;
}

type Candidate =
  | { type: "step"; step: ResolvedStep; match: Match; weight: number }
  | { type: "composite"; composite: Composite; match: Match; weight: number };

const MAX_EXPANSION_DEPTH = 8;
const NARRATION_LINE = /^(narrate|caption)\s*:\s*(.*)$/i;

/**
 * Resolves the lines of one scenario against the dialect's steps and composites.
 * Conventions: namespace `Ref` is scenario scoped and declared by steps; slots named `Field` and `Value`
 * are checked against the Entity's declared states and relations; emissions of kind `TransitionUse`
 * carry the previously observed state of the same Ref and Field.
 */
export class ScenarioResolver {
  private readonly refs = new Map<string, { name: string; entity: string | undefined }>();
  private readonly current = new Map<string, string>();
  private readonly states = new Map<string, string>();
  private readonly nodes: ScenarioNode[] = [];
  private readonly lexicon: Lexicon = {
    names: (namespace) => this.environment.registry.names(namespace),
  };

  constructor(private readonly environment: ScenarioEnvironment) {}

  resolve(lines: readonly Line[]): ScenarioNode[] {
    for (const entry of lines) {
      this.resolveLine(entry.text, entry.line, 0);
    }
    return this.nodes;
  }

  private resolveLine(text: string, line: number, depth: number): void {
    const narration = NARRATION_LINE.exec(text);
    if (narration !== null) {
      const node: NarrationNode = {
        id: (narration[1] as string).toLowerCase() as NarrationNode["id"],
        line,
        text: (narration[2] as string).trim(),
        modes: ["demo"],
      };
      this.nodes.push(node);
      return;
    }
    const candidate = this.bestCandidate(text);
    if (candidate === null) {
      this.environment.report(line, `No step matches "${text}"`);
    } else if (candidate.type === "composite") {
      this.expand(candidate.composite, candidate.match, line, depth);
    } else {
      this.resolveStep(candidate.step, candidate.match, line);
    }
  }

  private bestCandidate(text: string): Candidate | null {
    const candidates: Candidate[] = [];
    for (const composite of this.environment.composites) {
      const match = composite.matcher(text, this.lexicon);
      match !== null &&
        candidates.push({
          type: "composite",
          composite,
          match,
          weight: composite.matcher.literalWords.length,
        });
    }
    for (const step of this.environment.dialect.steps) {
      const match = step.matcher(text, this.lexicon);
      match !== null &&
        candidates.push({ type: "step", step, match, weight: step.matcher.literalWords.length });
    }
    return candidates.reduce<Candidate | null>(
      (best, candidate) => (best === null || candidate.weight > best.weight ? candidate : best),
      null,
    );
  }

  private expand(composite: Composite, match: Match, line: number, depth: number): void {
    if (depth >= MAX_EXPANSION_DEPTH) {
      this.environment.report(line, `Composite step "${composite.header}" expands recursively`);
      return;
    }
    for (const child of composite.children) {
      this.resolveLine(substituteSlots(child.text, match.slots), line, depth + 1);
    }
  }

  private resolveStep(step: ResolvedStep, match: Match, line: number): void {
    const scope: StepScope = { line, values: new Map() };
    const resolved = new Map<string, string>();
    const declaring = new Set(step.declares ?? []);
    const deferred: SlotDescriptor[] = [];
    for (const descriptor of this.resolutionOrder(step)) {
      const value = match.slots[descriptor.name];
      if (value === undefined) {
        continue;
      }
      if (descriptor.capture === "enumeration") {
        descriptor.argument === "included" && resolved.set(descriptor.name, value);
      } else if (declaring.has(descriptor.namespace)) {
        deferred.push(descriptor);
      } else {
        this.resolveInto(descriptor, value, scope, resolved);
      }
    }
    const pairs = this.resolvePairs(step, match, scope);
    this.checkValue(scope, resolved);
    for (const descriptor of deferred) {
      this.declareRef(descriptor, match.slots[descriptor.name] as string, scope, resolved, pairs);
    }
    this.nodes.push(this.stepNode(step, match, line, resolved, pairs));
    step.emits !== undefined && this.emit(step.emits, resolved, scope);
  }

  private resolutionOrder(step: ResolvedStep): SlotDescriptor[] {
    const isScenarioScoped = (descriptor: SlotDescriptor): boolean =>
      this.environment.dialect.namespaces[descriptor.namespace]?.scope === "scenario";
    const { slots } = step.matcher;
    return [...slots.filter(isScenarioScoped), ...slots.filter((slot) => !isScenarioScoped(slot))];
  }

  private resolveInto(
    descriptor: SlotDescriptor,
    value: string,
    scope: StepScope,
    resolved: Map<string, string>,
  ): void {
    const canonical = this.resolveSlot(descriptor, value, scope);
    if (canonical !== undefined) {
      resolved.set(descriptor.name, canonical);
      scope.values.set(descriptor.namespace, canonical);
      this.recordOpenSurface(descriptor, scope, resolved);
    }
  }

  private stepNode(
    step: ResolvedStep,
    match: Match,
    line: number,
    resolved: Map<string, string>,
    pairs: [string, string][],
  ): StepNode {
    const args: Record<string, AstValue> = {};
    for (const descriptor of step.matcher.slots) {
      this.includeSurfaceArg(descriptor, resolved, args);
      const value = resolved.get(descriptor.name);
      value !== undefined && (args[descriptor.name] = value);
    }
    const pairNames = step.matcher.pairSlotNames;
    if (pairNames !== null) {
      args["pairs"] = pairs;
    }
    for (const [name, list] of Object.entries(match.lists)) {
      pairNames?.includes(name) || (args[name] = list);
    }
    const node: StepNode = { id: step.id, line, args };
    if (step.narrate !== undefined) {
      node.narrate = step.narrate(Object.fromEntries(resolved));
    }
    return node;
  }

  private resolvePairs(step: ResolvedStep, match: Match, scope: StepScope): [string, string][] {
    const pairNames = step.matcher.pairSlotNames;
    if (pairNames === null) {
      return [];
    }
    const fieldDescriptor = match.kinds[pairNames[0]] as SlotDescriptor;
    return match.pairs.flatMap(([fieldText, valueText]) => {
      const field = this.resolveSlot(fieldDescriptor, fieldText, scope);
      if (field === undefined) {
        return [];
      }
      const value = this.checkFieldValue(this.entityOf(scope), field, valueText, scope.line);
      return [[field, value] as [string, string]];
    });
  }

  private checkValue(scope: StepScope, resolved: Map<string, string>): void {
    const field = resolved.get("Field");
    const value = resolved.get("Value");
    if (field !== undefined && value !== undefined) {
      resolved.set("Value", this.checkFieldValue(this.entityOf(scope), field, value, scope.line));
    }
  }

  private checkFieldValue(
    entity: string | undefined,
    field: string,
    value: string,
    line: number,
  ): string {
    if (entity === undefined) {
      return value;
    }
    const { registry } = this.environment;
    if (registry.lookup("Field", field, entity)?.kind === "relation") {
      return this.resolveRef(value, line) ?? value;
    }
    const states = registry.inScope("State", `${entity}.${field}`);
    if (states.length === 0) {
      return value;
    }
    const state = registry.lookup("State", value, `${entity}.${field}`);
    state === undefined &&
      this.environment.report(line, `"${value}" is not a state of ${entity}.${field}`);
    return state?.name ?? value;
  }

  private declareRef(
    descriptor: SlotDescriptor,
    value: string,
    scope: StepScope,
    resolved: Map<string, string>,
    pairs: [string, string][],
  ): void {
    const entity = this.entityOf(scope);
    this.refs.set(value.toLowerCase(), { name: value, entity });
    resolved.set(descriptor.name, value);
    scope.values.set(descriptor.namespace, value);
    for (const [field, state] of pairs) {
      entity !== undefined &&
        this.isStateField(entity, field) &&
        this.states.set(stateKey(value, field), state);
    }
  }

  private isStateField(entity: string, field: string): boolean {
    return this.environment.registry.inScope("State", `${entity}.${field}`).length > 0;
  }

  private entityOf(scope: StepScope): string | undefined {
    const direct = scope.values.get("Entity");
    if (direct !== undefined) {
      return direct;
    }
    const ref = scope.values.get("Ref");
    return ref === undefined ? undefined : this.refs.get(ref.toLowerCase())?.entity;
  }

  private resolveRef(value: string, line: number): string | undefined {
    const found = this.refs.get(value.toLowerCase());
    if (found === undefined) {
      this.environment.report(
        line,
        `Ref "${value}" is not declared by an earlier step in this scenario`,
      );
    }
    return found?.name;
  }

  private resolveSlot(
    descriptor: SlotDescriptor,
    value: string,
    scope: StepScope,
  ): string | undefined {
    const { dialect, registry } = this.environment;
    const namespace = dialect.namespaces[descriptor.namespace];
    if (namespace === undefined || namespace.resolution === "free") {
      return value;
    }
    if (namespace.scope === "scenario") {
      return this.resolveRef(value, scope.line);
    }
    const scopeKey = scopeKeyOf(dialect.namespaces, descriptor.namespace, (ancestor) =>
      this.scopeValue(ancestor, scope),
    );
    if ("missing" in scopeKey) {
      this.environment.report(
        scope.line,
        this.missingScopeMessage(descriptor, value, scopeKey.missing, scope),
      );
      return undefined;
    }
    const entry = registry.lookup(descriptor.namespace, value, scopeKey.key);
    if (entry === undefined) {
      const location = scopeKey.key === "" ? "" : ` on ${scopeKey.key}`;
      this.environment.report(scope.line, `Unknown ${descriptor.namespace} "${value}"${location}`);
      return undefined;
    }
    return this.acceptEntry(descriptor, entry, scope);
  }

  private acceptEntry(
    descriptor: SlotDescriptor,
    entry: Entry,
    scope: StepScope,
  ): string | undefined {
    if (descriptor.constraint !== undefined && entry.kind !== descriptor.constraint) {
      this.environment.report(
        scope.line,
        `${descriptor.namespace} "${entry.name}" is a ${entry.kind}, expected ${descriptor.constraint}`,
      );
      return undefined;
    }
    this.current.set(this.currentKey(descriptor.namespace, scope), entry.name);
    descriptor.namespace === "Surface" && this.environment.usedSurfaces.add(entry.name);
    const key = entry.scopeKey === "" ? entry.name : `${entry.scopeKey}/${entry.name}`;
    this.environment.analysis.references.push({
      kind: descriptor.namespace,
      key,
      line: scope.line,
    });
    return entry.name;
  }

  private currentKey(namespace: string, scope: StepScope): string {
    const actor = (scope.values.get("Actor") ?? "").toLowerCase();
    return `${actor}|${namespace}`;
  }

  private isSurfaceScoped(descriptor: SlotDescriptor): boolean {
    return this.environment.dialect.namespaces[descriptor.namespace]?.scope === "Surface";
  }

  private recordOpenSurface(
    descriptor: SlotDescriptor,
    scope: StepScope,
    resolved: Map<string, string>,
  ): void {
    const surface = this.scopeValue("Surface", scope);
    if (this.isSurfaceScoped(descriptor) && surface !== undefined) {
      resolved.set("Surface", surface);
    }
  }

  private includeSurfaceArg(
    descriptor: SlotDescriptor,
    resolved: Map<string, string>,
    args: Record<string, AstValue>,
  ): void {
    const surface = resolved.get("Surface");
    if (this.isSurfaceScoped(descriptor) && surface !== undefined) {
      args["Surface"] = surface;
    }
  }

  private missingScopeMessage(
    descriptor: SlotDescriptor,
    value: string,
    missing: string,
    scope: StepScope,
  ): string {
    const actor = scope.values.get("Actor");
    if (missing === "Surface") {
      return actor === undefined ? "No surface open" : `No surface open for ${actor}`;
    }
    return `${descriptor.namespace} "${value}" needs a ${missing} in scope`;
  }

  private scopeValue(ancestor: string, scope: StepScope): string | undefined {
    const inStep = scope.values.get(ancestor);
    if (inStep !== undefined) {
      return inStep;
    }
    if (ancestor === "Entity") {
      return this.entityOf(scope) ?? this.current.get(this.currentKey(ancestor, scope));
    }
    return this.current.get(this.currentKey(ancestor, scope));
  }

  private emit(rule: EmissionRule, resolved: Map<string, string>, scope: StepScope): void {
    const data: Record<string, string> = {};
    for (const [fieldName, slotName] of Object.entries(rule.fields)) {
      const value = resolved.get(slotName);
      value !== undefined && (data[fieldName] = value);
    }
    const entity = this.entityOf(scope);
    entity !== undefined && data["Entity"] === undefined && (data["Entity"] = entity);
    const key = rule.kind === "TransitionUse" ? this.trackTransition(data) : undefined;
    const emission = {
      kind: rule.kind,
      scenario: this.environment.scenarioName,
      line: scope.line,
      data,
    };
    this.environment.analysis.emissions.push(key === undefined ? emission : { ...emission, key });
  }

  private trackTransition(data: Record<string, string>): string | undefined {
    const { Ref: ref, Field: field, State: state, Entity: entity } = data;
    if (ref === undefined || field === undefined || state === undefined || entity === undefined) {
      return undefined;
    }
    const previous = this.states.get(stateKey(ref, field));
    this.states.set(stateKey(ref, field), state);
    if (previous === undefined) {
      return undefined;
    }
    data["From"] = previous;
    return previous === state ? undefined : `${entity}.${field}:${previous}->${state}`;
  }
}

function stateKey(ref: string, field: string): string {
  return `${ref.toLowerCase()}|${field.toLowerCase()}`;
}

function substituteSlots(text: string, slots: Readonly<Record<string, string>>): string {
  return text.replace(
    /<([A-Za-z][A-Za-z0-9_]*)>/g,
    (placeholder, name: string) => slots[name] ?? placeholder,
  );
}
