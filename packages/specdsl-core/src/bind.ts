import {
  FIELD_TYPES,
  type Analysis,
  type BindError,
  type BindResult,
  type EntityNode,
  type FieldNode,
  type FieldType,
  type DerivedNode,
  type InvariantNode,
  type Scenario,
  type SpecAst,
  type SurfaceNode,
} from "./ast.js";
import type { Dialect, ResolvedRule, ResolvedSection } from "./dialect.js";
import {
  parseMarkdown,
  type Item,
  type Line,
  type MarkdownTree,
  type Section,
} from "./markdown.js";
import {
  resolveCount,
  resolvePredicate,
  type DerivedContext,
  type DerivedSource,
} from "./derived.js";
import { resolveInvariant } from "./invariants.js";
import {
  compilePattern,
  PatternError,
  type ListValue,
  type Match,
  type Matcher,
} from "./pattern.js";
import { Registry, scopeKeyOf, type Entry } from "./registry.js";
import { ScenarioResolver, type Composite } from "./scenario.js";

export interface BindOptions {
  file: string;
}

export interface SpecSource {
  file: string;
  markdown: string;
}

interface ParsedSource {
  file: string;
  tree: MarkdownTree;
}

interface ClassifiedSection {
  file: string;
  section: Section;
  definition: ResolvedSection;
  match: Match;
}

interface PendingItem {
  file: string;
  line: number;
  rule: ResolvedRule;
  match: Match;
  entity: string | undefined;
}

const REDECLARATION_GUARDED = new Set(["Entity", "Actor", "Surface"]);

interface FieldSpec {
  type?: FieldType;
  required?: true;
  values?: string[];
}

interface Site {
  file: string;
  line: number;
}

/**
 * Binds a parsed spec to a dialect: matches sections, declares namespace entries, expands composite steps
 * and resolves scenario steps. Surfaces and controls come from the dialect's `Surface` and `Control` namespaces.
 */
export function bind(tree: MarkdownTree, dialect: Dialect, options: BindOptions): BindResult {
  return new Binder([{ file: options.file, tree }], dialect).run();
}

/** Binds base sources and a feature source, in order, into one registry; the last source is the feature spec. */
export function bindSpec(sources: readonly SpecSource[], dialect: Dialect): BindResult {
  const parsed = sources.map((source) => ({
    file: source.file,
    tree: parseMarkdown(source.markdown),
  }));
  return new Binder(parsed, dialect).run();
}

class Binder {
  private readonly errors: BindError[] = [];
  private readonly registry = new Registry();
  private readonly analysis: Analysis = { declarations: [], emissions: [], references: [] };
  private readonly contexts: SpecAst["contexts"] = {};
  private readonly actors: SpecAst["actors"] = {};
  private readonly model: SpecAst["model"] = {};
  private readonly policies: SpecAst["policies"] = {};
  private readonly invariants: InvariantNode[] = [];
  private readonly derived: DerivedNode = { predicates: [], counts: [] };
  private readonly listedSurfaces = new Set<string>();
  private readonly surfaceDesigns = new Map<string, string>();
  private readonly usedSurfaces = new Set<string>();
  private readonly composites: Composite[] = [];

  private readonly scenarioSites = new Map<string, string>();
  private readonly fieldSites = new Map<string, Site>();
  private readonly machineSites = new Map<string, Site>();

  constructor(
    private readonly sources: readonly ParsedSource[],
    private readonly dialect: Dialect,
  ) {}

  run(): BindResult {
    const sections = this.sources.flatMap((source) => this.classifySections(source));
    this.preloadSurfaces();
    const pending = sections
      .filter((classified) => classified.definition.body === undefined)
      .flatMap((classified) => this.matchItems(classified));
    pending.forEach((item) => this.declare(item));
    pending.forEach((item) => this.complete(item));
    pending.forEach((item) => this.recordInvariant(item));
    this.reconcileMachineFields();
    pending
      .filter((item) => item.rule.derived === "predicate")
      .forEach((item) => this.recordDerived(item));
    pending
      .filter((item) => item.rule.derived === "count")
      .forEach((item) => this.recordDerived(item));
    sections
      .filter((classified) => classified.definition.body === "composites")
      .forEach((classified) => this.collectComposites(classified));
    const scenarios = sections
      .filter((classified) => classified.definition.body === "steps")
      .map((classified) => this.bindScenario(classified));
    return this.finish(scenarios);
  }

  private report(file: string, line: number, message: string): void {
    this.errors.push({ file, line, message });
  }

  private classifySections(source: ParsedSource): ClassifiedSection[] {
    const classified: ClassifiedSection[] = [];
    const seenOnce = new Set<string>();
    for (const section of source.tree.sections) {
      const found = this.matchHeading(source.file, section);
      if (found === null) {
        this.report(source.file, section.line, `Unknown section "${section.heading}"`);
      } else if (found.definition.occurs === "once" && seenOnce.has(found.definition.name)) {
        this.report(
          source.file,
          section.line,
          `Section "${found.definition.name}" may occur only once`,
        );
      } else {
        seenOnce.add(found.definition.name);
        classified.push(found);
      }
    }
    return classified;
  }

  private matchHeading(file: string, section: Section): ClassifiedSection | null {
    for (const definition of Object.values(this.dialect.sections)) {
      const match = definition.headingMatcher(section.heading);
      if (match !== null) {
        return { file, section, definition, match };
      }
    }
    return null;
  }

  private preloadSurfaces(): void {
    for (const [surfaceName, surface] of Object.entries(this.dialect.surfaces)) {
      this.registry.declare({
        namespace: "Surface",
        name: surfaceName,
        scopeKey: "",
        shared: surface.shared === true,
        origin: "dialect",
        line: 0,
        data: {},
      });
      for (const [controlName, control] of Object.entries(surface.controls)) {
        this.registry.declare({
          namespace: "Control",
          name: controlName,
          scopeKey: surfaceName,
          kind: control.kind,
          origin: "dialect",
          line: 0,
          data: {},
        });
      }
    }
  }

  private matchItems(classified: ClassifiedSection): PendingItem[] {
    const pending: PendingItem[] = [];
    for (const item of classified.section.items) {
      let entity: string | undefined;
      for (const sentence of splitSentences(item.text)) {
        const found = bestRule(classified.definition.rules, sentence);
        if (found === null) {
          this.report(
            classified.file,
            item.line,
            `Unrecognized ${classified.definition.name} item "${sentence}"`,
          );
        } else {
          pending.push({
            file: classified.file,
            line: item.line,
            rule: found.rule,
            match: found.match,
            entity,
          });
          entity = found.rule.declares?.includes("Entity") ? found.match.slots["Entity"] : entity;
        }
      }
    }
    return pending;
  }

  private declare(item: PendingItem): void {
    for (const namespace of item.rule.declares ?? []) {
      valuesOf(item.match, namespace).forEach((value, index) =>
        this.declareValue(item, namespace, value, index),
      );
    }
    this.markSharedSurface(item);
    this.recordEntity(item);
  }

  private markSharedSurface(item: PendingItem): void {
    const surfaceName = item.match.slots["Surface"];
    if (
      item.rule.emits === "Control" &&
      item.match.optionals[0] === true &&
      surfaceName !== undefined
    ) {
      this.registry.markShared(surfaceName);
    }
  }

  private declareValue(item: PendingItem, namespace: string, value: string, index: number): void {
    const scopeKey = scopeKeyOf(
      this.dialect.namespaces,
      namespace,
      (ancestor) => item.match.slots[ancestor],
    );
    if ("missing" in scopeKey) {
      this.report(item.file, item.line, `${namespace} "${value}" needs a ${scopeKey.missing}`);
    } else if (namespace === "Control") {
      this.declareControl(
        item,
        value,
        scopeKey.key,
        flatten(item.match.lists["Control.kind"] ?? [])[index],
      );
    } else {
      this.rejectRedeclaration(item, namespace, value, scopeKey.key);
      this.registry.declare({
        namespace,
        name: value,
        scopeKey: scopeKey.key,
        origin: "spec",
        file: item.file,
        line: item.line,
        data: {},
      });
    }
  }

  private rejectRedeclaration(
    item: PendingItem,
    namespace: string,
    value: string,
    scopeKey: string,
  ): void {
    const existing = this.registry.lookup(namespace, value, scopeKey);
    if (
      REDECLARATION_GUARDED.has(namespace) &&
      existing?.file !== undefined &&
      existing.file !== item.file
    ) {
      this.report(
        item.file,
        item.line,
        `${value} is already declared in ${existing.file}:${existing.line}`,
      );
    }
  }

  private declareControl(
    item: PendingItem,
    name: string,
    surfaceName: string,
    kind: string | undefined,
  ): void {
    const kinds = this.dialect.namespaces["Control"]?.kinds ?? [];
    if (kind === undefined || !kinds.includes(kind.toLowerCase())) {
      this.report(item.file, item.line, `"${kind}" is not a Control kind (${kinds.join(", ")})`);
      return;
    }
    const existing = this.registry.lookup("Control", name, surfaceName);
    const surface = this.registry.lookup("Surface", surfaceName, "");
    if (existing !== undefined && existing.kind !== kind.toLowerCase()) {
      this.report(
        item.file,
        item.line,
        `Control "${existing.name}" on ${surfaceName} is a ${existing.kind}, not a ${kind}`,
      );
    } else if (existing === undefined && surface?.origin === "dialect") {
      this.report(item.file, item.line, `Unknown Control "${name}" on ${surfaceName}`);
    } else if (existing === undefined) {
      this.registry.declare({
        namespace: "Control",
        name,
        scopeKey: surfaceName,
        kind: kind.toLowerCase(),
        origin: "spec",
        file: item.file,
        line: item.line,
        data: {},
      });
    }
  }

  private complete(item: PendingItem): void {
    this.checkReferences(item);
    this.applyRelation(item);
    this.recordRelation(item);
    this.recordOutput(item);
    if (item.rule.emits === "Transition") {
      this.declareTransitions(item);
    } else if (item.rule.emits === "Control") {
      this.declareControls(item);
    } else if (item.rule.emits === "Policy") {
      this.declarePolicies(item);
    }
  }

  private recordInvariant(item: PendingItem): void {
    const kind = item.rule.invariant;
    if (item.rule.output !== "invariants" || kind === undefined) {
      return;
    }
    const node = resolveInvariant(
      { kind, match: item.match, file: item.file, line: item.line },
      {
        registry: this.registry,
        model: this.model,
        report: (message) => this.report(item.file, item.line, message),
      },
    );
    node !== undefined && this.invariants.push(node);
  }

  private recordDerived(item: PendingItem): void {
    const kind = item.rule.derived;
    if (item.rule.output !== "derived" || kind === undefined) {
      return;
    }
    const source = { kind, match: item.match, file: item.file, line: item.line };
    const context = {
      registry: this.registry,
      model: this.model,
      predicates: this.derived.predicates,
      report: (message: string) => this.report(item.file, item.line, message),
    };
    kind === "predicate"
      ? this.recordPredicate(source, context)
      : this.recordCount(source, context);
  }

  private recordPredicate(source: DerivedSource, context: DerivedContext): void {
    const node = resolvePredicate(source, context);
    const earlier = this.derived.predicates.find(
      (candidate) =>
        candidate.entity === node?.entity &&
        candidate.name.toLowerCase() === node.name.toLowerCase(),
    );
    earlier !== undefined &&
      context.report(
        `Predicate "${node?.name}" of ${node?.entity} is already declared in ${earlier.file}:${earlier.line}`,
      );
    node !== undefined && earlier === undefined && this.derived.predicates.push(node);
  }

  private recordCount(source: DerivedSource, context: DerivedContext): void {
    const node = resolveCount(source, context);
    node !== undefined && this.derived.counts.push(node);
  }

  private checkReferences(item: PendingItem): void {
    for (const namespace of item.rule.references ?? []) {
      const scopeKey = scopeKeyOf(
        this.dialect.namespaces,
        namespace,
        (ancestor) => item.match.slots[ancestor],
      );
      for (const value of referencedValues(item.match, namespace)) {
        const known =
          "key" in scopeKey && this.registry.lookup(namespace, value, scopeKey.key) !== undefined;
        known || this.report(item.file, item.line, `Unknown ${namespace} "${value}"`);
      }
    }
  }

  private applyRelation(item: PendingItem): void {
    const { owner: ownerName, target, name: relationName } = relationEnds(item);
    if (item.rule.relation !== "belongs-to" || ownerName === undefined || target === undefined) {
      return;
    }
    const owner = this.registry.lookup("Entity", ownerName, "");
    const targetEntry = this.registry.lookup("Entity", target, "");
    if (owner !== undefined && targetEntry !== undefined) {
      const name =
        relationName ?? targetEntry.name.charAt(0).toLowerCase() + targetEntry.name.slice(1);
      this.registry.declare({
        namespace: "Field",
        name,
        scopeKey: owner.name,
        kind: "relation",
        origin: "spec",
        file: item.file,
        line: item.line,
        data: { target: targetEntry.name },
      });
    }
  }

  private recordOutput(item: PendingItem): void {
    const { rule, match } = item;
    const scalars = Object.entries(match.slots).filter(
      ([name]) => match.kinds[name]?.capture === "entry",
    );
    if (rule.output === "contexts" && rule.context !== undefined) {
      this.contexts[rule.context] = Object.fromEntries(scalars);
    } else if (rule.output === "actors") {
      const keyNamespace = rule.declares?.[0] ?? "Actor";
      const name = match.slots[keyNamespace];
      const fields = scalars.filter(([slot]) => slot !== keyNamespace);
      name !== undefined && (this.actors[name] = { ...Object.fromEntries(fields), extra: {} });
    } else if (rule.output === "policies") {
      this.recordPolicy(item);
    }
  }

  private recordPolicy(item: PendingItem): void {
    const entity = this.registry.lookup("Entity", item.match.slots["Entity"] ?? "", "")?.name;
    const role = item.match.slots["Role"];
    if (entity === undefined || role === undefined) {
      return;
    }
    const roles = (this.policies[entity] ??= {});
    const actions = (roles[role] ??= []);
    for (const action of valuesOf(item.match, "Action")) {
      actions.includes(action) || actions.push(action);
    }
  }

  private declarePolicies(item: PendingItem): void {
    const entity = this.registry.lookup("Entity", item.match.slots["Entity"] ?? "", "")?.name;
    const role = item.match.slots["Role"];
    if (entity === undefined || role === undefined) {
      return;
    }
    for (const action of valuesOf(item.match, "Action")) {
      this.analysis.declarations.push({
        kind: "Policy",
        key: `${entity}.${role}:${action}`,
        file: item.file,
        line: item.line,
        data: { Entity: entity, Role: role, Action: action },
      });
    }
  }

  private recordEntity(item: PendingItem): void {
    const name = item.match.slots["Entity"];
    if (!item.rule.declares?.includes("Entity") || name === undefined) {
      return;
    }
    const entity = this.entityNode(name);
    const canonicalName = this.registry.lookup("Entity", name, "")?.name ?? name;
    const specs = flatten(item.match.lists["Type"] ?? []);
    valuesOf(item.match, "Field").forEach((field, index) => {
      entity !== undefined &&
        this.recordField(item, canonicalName, entity, field, specs[index] ?? "");
    });
  }

  private recordField(
    item: PendingItem,
    entityName: string,
    entity: EntityNode,
    name: string,
    specText: string,
  ): void {
    const label = `${entityName}.${name}`;
    const parsed = parseFieldSpec(specText, label);
    const spec = typeof parsed === "string" ? {} : parsed;
    typeof parsed === "string" && this.report(item.file, item.line, parsed);
    const existing = entity.fields.find((field) => field.name === name);
    if (existing === undefined) {
      entity.fields.push(fieldNode(name, spec));
      this.fieldSites.set(label, { file: item.file, line: item.line });
    } else if (spec.type !== undefined) {
      this.mergeField(item, label, existing, spec);
    }
  }

  private mergeField(item: PendingItem, label: string, existing: FieldNode, spec: FieldSpec): void {
    if (existing.type === undefined) {
      Object.assign(existing, fieldNode(existing.name, spec));
    } else if (!sameFieldSpec(existing, spec)) {
      this.report(item.file, item.line, `${label} is already declared with a different type`);
    }
  }

  private recordRelation(item: PendingItem): void {
    const { owner, target, name: relationName } = relationEnds(item);
    const kind = item.rule.relation;
    if (kind === undefined || owner === undefined || target === undefined) {
      return;
    }
    const targetName = this.registry.lookup("Entity", target, "")?.name;
    const relations = this.entityNode(owner)?.relations;
    const name = relationName ?? (targetName === undefined ? "" : defaultRelationName(targetName));
    const known = relations?.some(
      (seen) => seen.kind === kind && seen.entity === targetName && seen.name === name,
    );
    targetName === undefined || known || relations?.push({ kind, entity: targetName, name });
  }

  private entityNode(name: string): EntityNode | undefined {
    const canonicalName = this.registry.lookup("Entity", name, "")?.name;
    if (canonicalName === undefined) {
      return undefined;
    }
    this.model[canonicalName] ??= { fields: [], relations: [], machines: {} };
    return this.model[canonicalName];
  }

  private recordMachine(item: PendingItem, entity: string, field: string, chains: string[][]) {
    const machines = this.entityNode(entity)?.machines;
    if (machines === undefined) {
      return;
    }
    this.machineSites.has(`${entity}.${field}`) ||
      this.machineSites.set(`${entity}.${field}`, { file: item.file, line: item.line });
    const machine = (machines[field] ??= { states: [], transitions: [] });
    for (const chain of chains) {
      chain.forEach((state) => machine.states.includes(state) || machine.states.push(state));
      chain.slice(1).forEach((to, index) => {
        const from = chain[index] as string;
        machine.transitions.some((seen) => seen.from === from && seen.to === to) ||
          machine.transitions.push({ from, to });
      });
    }
  }

  private reconcileMachineFields(): void {
    for (const [entityName, entity] of Object.entries(this.model)) {
      for (const [fieldName, machine] of Object.entries(entity.machines)) {
        const field = entity.fields.find((candidate) => candidate.name === fieldName);
        field !== undefined &&
          this.reconcileMachineField(`${entityName}.${fieldName}`, field, machine.states);
      }
    }
  }

  private reconcileMachineField(label: string, field: FieldNode, states: string[]): void {
    const site = this.machineSites.get(label);
    if (field.type === undefined) {
      field.type = "enum";
      field.values = [...states];
    } else if (site !== undefined && !sameSet(field.values ?? [], states)) {
      const declared = field.type === "enum" ? `one of ${field.values?.join(", ")}` : field.type;
      this.report(
        site.file,
        site.line,
        `${label} is declared as ${declared} but its states are one of ${states.join(", ")}`,
      );
    }
  }

  private declareTransitions(item: PendingItem): void {
    const entity = this.registry.lookup("Entity", item.match.slots["Entity"] ?? "", "")?.name;
    const field = this.registry.lookup(
      "Field",
      item.match.slots["Field"] ?? "",
      entity ?? "",
    )?.name;
    if (entity === undefined || field === undefined) {
      return;
    }
    const chains = chainsOf(item.match.lists["State"] ?? []);
    this.recordMachine(item, entity, field, chains);
    for (const chain of chains) {
      chain.slice(1).forEach((to, index) => {
        const from = chain[index] as string;
        this.analysis.declarations.push({
          kind: "Transition",
          key: `${entity}.${field}:${from}->${to}`,
          file: item.file,
          line: item.line,
          data: { Entity: entity, Field: field, From: from, To: to },
        });
      });
    }
  }

  private declareControls(item: PendingItem): void {
    const surface = this.registry.lookup("Surface", item.match.slots["Surface"] ?? "", "");
    if (surface === undefined) {
      return;
    }
    this.listedSurfaces.add(surface.name);
    const design = item.match.slots["Design"];
    design !== undefined && this.surfaceDesigns.set(surface.name, design);
    for (const name of valuesOf(item.match, "Control")) {
      const control = this.registry.lookup("Control", name, surface.name);
      control !== undefined &&
        this.analysis.declarations.push({
          kind: "Control",
          key: `${surface.name}/${control.name}`,
          file: item.file,
          line: item.line,
          data: { Surface: surface.name, Control: control.name },
        });
    }
  }

  private collectComposites(classified: ClassifiedSection): void {
    for (const item of classified.section.items) {
      const parsed = /^(.*\S)\s+means$/i.exec(item.text);
      if (parsed === null) {
        this.report(
          classified.file,
          item.line,
          `Composite step must end with "means": "${item.text}"`,
        );
        continue;
      }
      this.addComposite(classified.file, parsed[1] as string, item);
    }
  }

  private addComposite(file: string, header: string, item: Item): void {
    try {
      const children = item.children.map((child) => ({ text: child.text, line: child.line }));
      children.length === 0 &&
        this.report(file, item.line, `Composite step "${header}" has no child steps`);
      const matcher = compilePattern(header);
      this.rejectPrimitiveCollision(file, header, matcher, item.line);
      this.composites.push({ header, matcher, children, line: item.line, file });
    } catch (error) {
      if (!(error instanceof PatternError)) {
        throw error;
      }
      this.report(file, item.line, `Invalid composite step pattern: ${error.message}`);
    }
  }

  private rejectPrimitiveCollision(
    file: string,
    header: string,
    matcher: Matcher,
    line: number,
  ): void {
    const lexicon = { names: (namespace: string) => this.registry.names(namespace) };
    const collision = this.dialect.steps.find(
      (step) => step.matcher(matcher.sample, lexicon) !== null,
    );
    collision !== undefined &&
      this.report(file, line, `Composite step "${header}" collides with step "${collision.id}"`);
  }

  private bindScenario(classified: ClassifiedSection): Scenario {
    const { file, section, definition, match } = classified;
    const name = match.slots["Name"] ?? definition.name;
    this.rejectDuplicateScenario(file, section.line, name);
    const lines = scenarioLines(section);
    const resolver = new ScenarioResolver({
      dialect: this.dialect,
      registry: this.registry,
      composites: this.composites,
      analysis: this.analysis,
      usedSurfaces: this.usedSurfaces,
      scenarioName: name,
      file,
      report: (line, message) => this.report(file, line, message),
    });
    const { story, steps } = resolver.resolve(lines);
    const source = { file, line: section.line };
    return story === undefined ? { name, source, steps } : { name, source, story, steps };
  }

  private rejectDuplicateScenario(file: string, line: number, name: string): void {
    const key = name.toLowerCase();
    const earlier = this.scenarioSites.get(key);
    earlier === undefined
      ? this.scenarioSites.set(key, `${file}:${line}`)
      : this.report(file, line, `Scenario "${name}" is already declared in ${earlier}`);
  }

  private surfaceNodes(): Record<string, SurfaceNode> {
    const names = [
      ...new Set([
        ...Object.keys(this.dialect.surfaces),
        ...this.listedSurfaces,
        ...this.usedSurfaces,
      ]),
    ];
    return Object.fromEntries(names.map((name) => [name, this.surfaceNode(name)]));
  }

  private surfaceNode(name: string): SurfaceNode {
    const definition = this.dialect.surfaces[name];
    const controls = this.registry
      .inScope("Control", name)
      .map((entry) => [entry.name, controlNode(entry, definition)]);
    const shared = this.registry.lookup("Surface", name, "")?.shared === true;
    const design = this.surfaceDesigns.get(name);
    const node: SurfaceNode = {
      ...(design === undefined ? {} : { design }),
      ...(shared ? { shared: true as const } : {}),
      controls: Object.fromEntries(controls),
    };
    return definition?.route === undefined ? node : { route: definition.route, ...node };
  }

  private finish(scenarios: Scenario[]): BindResult {
    if (this.errors.length > 0) {
      return { ok: false, errors: this.sortedErrors() };
    }
    const ast: SpecAst = {
      dialect: {
        name: this.dialect.name,
        version: this.dialect.version,
        stepIds: [...this.dialect.stepIds],
      },
      contexts: this.contexts,
      actors: this.actors,
      surfaces: this.surfaceNodes(),
      model: this.model,
      policies: this.policies,
      invariants: this.invariants,
      derived: this.derived,
      scenarios,
    };
    const feature = this.sources[this.sources.length - 1] as ParsedSource;
    return { ok: true, file: feature.file, ast, analysis: this.analysis };
  }

  private sortedErrors(): BindError[] {
    const order = (error: BindError): number =>
      this.sources.findIndex((source) => source.file === error.file);
    return [...this.errors].sort(
      (first, second) => order(first) - order(second) || first.line - second.line,
    );
  }
}

function controlNode(
  entry: Entry,
  definition: Dialect["surfaces"][string] | undefined,
): SurfaceNode["controls"][string] {
  return {
    kind: entry.kind ?? "",
    locators: { ...(definition?.controls[entry.name]?.locators ?? {}) },
  };
}

function scenarioLines(section: Section): Line[] {
  const fromItems = section.items.map((item) => ({ text: item.text, line: item.line }));
  return [...fromItems, ...section.body].sort((first, second) => first.line - second.line);
}

function splitSentences(text: string): string[] {
  return text
    .split(/\.(?=\s|$)/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
}

function bestRule(
  rules: readonly ResolvedRule[],
  sentence: string,
): { rule: ResolvedRule; match: Match } | null {
  let best: { rule: ResolvedRule; match: Match } | null = null;
  for (const rule of rules) {
    const match = rule.matcher(sentence);
    const better =
      best === null || rule.matcher.literalWords.length > best.rule.matcher.literalWords.length;
    match !== null && better && (best = { rule, match });
  }
  return best;
}

function flatten(values: readonly ListValue[]): string[] {
  return values.flatMap((value) => (typeof value === "string" ? [value] : flatten(value)));
}

function relationEnds(item: PendingItem): { owner?: string; target?: string; name?: string } {
  const extensionTarget = item.match.slots["Target"];
  const name = item.match.slots["Relation"];
  const ends =
    extensionTarget === undefined
      ? { owner: item.entity, target: item.match.slots["Entity"] }
      : { owner: item.match.slots["Entity"], target: extensionTarget };
  return name === undefined ? ends : { ...ends, name };
}

function defaultRelationName(entityName: string): string {
  return entityName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function fieldNode(name: string, spec: FieldSpec): FieldNode {
  return {
    name,
    ...(spec.type === undefined ? {} : { type: spec.type }),
    ...(spec.required === undefined ? {} : { required: spec.required }),
    ...(spec.values === undefined ? {} : { values: spec.values }),
  };
}

function sameSet(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value) => second.includes(value));
}

function sameFieldSpec(field: FieldNode, spec: FieldSpec): boolean {
  return (
    field.type === spec.type &&
    (field.required ?? false) === (spec.required ?? false) &&
    sameSet(field.values ?? [], spec.values ?? [])
  );
}

/** Parses the text inside a field's parentheses: `<type>[, required]` or `one of a, b, c[, required]`. */
function parseFieldSpec(text: string, label: string): FieldSpec | string {
  if (text === "") {
    return {};
  }
  const parts = text.split(",").map((part) => part.trim());
  const required = parts[parts.length - 1]?.toLowerCase() === "required";
  const [head = "", ...rest] = required ? parts.slice(0, -1) : parts;
  const flag = required ? { required: true as const } : {};
  const enumeration = /^one of\s+(\S.*)$/i.exec(head);
  if (enumeration !== null) {
    const values = [enumeration[1] as string, ...rest];
    return values.some((value) => value === "")
      ? `Empty value in "one of" list "${text}" for ${label}`
      : { type: "enum", values, ...flag };
  }
  const type = FIELD_TYPES.find((known) => known === head.toLowerCase());
  return type !== undefined && rest.length === 0
    ? { type, ...flag }
    : `Unknown field type "${text}" for ${label} (expected ${FIELD_TYPES.join(", ")} or one of a, b, c)`;
}

function referencedValues(match: Match, namespace: string): string[] {
  return Object.values(match.kinds)
    .filter((slot) => slot.capture === "entry" && slot.namespace === namespace)
    .flatMap((slot) => valuesOf(match, slot.name));
}

function valuesOf(match: Match, namespace: string): string[] {
  const scalar = match.slots[namespace];
  return scalar === undefined ? flatten(match.lists[namespace] ?? []) : [scalar];
}

function chainsOf(values: readonly ListValue[]): string[][] {
  return values.every((value) => typeof value === "string")
    ? [values as string[]]
    : values.map((value) => flatten([value]));
}
