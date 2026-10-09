import type { Analysis, BindError, BindResult, Scenario, SpecAst, SurfaceNode } from "./ast.js";
import type { Dialect, ResolvedRule, ResolvedSection } from "./dialect.js";
import type { Item, Line, MarkdownTree, Section } from "./markdown.js";
import { compilePattern, PatternError, type ListValue, type Match } from "./pattern.js";
import { Registry, scopeKeyOf, type Entry } from "./registry.js";
import { ScenarioResolver, type Composite } from "./scenario.js";

export interface BindOptions {
  file: string;
}

interface ClassifiedSection {
  section: Section;
  definition: ResolvedSection;
  match: Match;
}

interface PendingItem {
  line: number;
  rule: ResolvedRule;
  match: Match;
  entity: string | undefined;
}

/**
 * Binds a parsed spec to a dialect: matches sections, declares namespace entries, expands composite steps
 * and resolves scenario steps. Surfaces and controls come from the dialect's `Surface` and `Control` namespaces.
 */
export function bind(tree: MarkdownTree, dialect: Dialect, options: BindOptions): BindResult {
  return new Binder(tree, dialect, options.file).run();
}

class Binder {
  private readonly errors: BindError[] = [];
  private readonly registry = new Registry();
  private readonly analysis: Analysis = { declarations: [], emissions: [], references: [] };
  private readonly contexts: SpecAst["contexts"] = {};
  private readonly actors: SpecAst["actors"] = {};
  private readonly listedSurfaces = new Set<string>();
  private readonly usedSurfaces = new Set<string>();
  private readonly composites: Composite[] = [];

  constructor(
    private readonly tree: MarkdownTree,
    private readonly dialect: Dialect,
    private readonly file: string,
  ) {}

  run(): BindResult {
    const sections = this.classifySections();
    this.preloadSurfaces();
    const pending = sections
      .filter((classified) => classified.definition.body === undefined)
      .flatMap((classified) => this.matchItems(classified));
    pending.forEach((item) => this.declare(item));
    pending.forEach((item) => this.complete(item));
    sections
      .filter((classified) => classified.definition.body === "composites")
      .forEach((classified) => this.collectComposites(classified.section));
    const scenarios = sections
      .filter((classified) => classified.definition.body === "steps")
      .map((classified) => this.bindScenario(classified));
    return this.finish(scenarios);
  }

  private report(line: number, message: string): void {
    this.errors.push({ file: this.file, line, message });
  }

  private classifySections(): ClassifiedSection[] {
    const classified: ClassifiedSection[] = [];
    const seenOnce = new Set<string>();
    for (const section of this.tree.sections) {
      const found = this.matchHeading(section);
      if (found === null) {
        this.report(section.line, `Unknown section "${section.heading}"`);
      } else if (found.definition.occurs === "once" && seenOnce.has(found.definition.name)) {
        this.report(section.line, `Section "${found.definition.name}" may occur only once`);
      } else {
        seenOnce.add(found.definition.name);
        classified.push(found);
      }
    }
    return classified;
  }

  private matchHeading(section: Section): ClassifiedSection | null {
    for (const definition of Object.values(this.dialect.sections)) {
      const match = definition.headingMatcher(section.heading);
      if (match !== null) {
        return { section, definition, match };
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
          this.report(item.line, `Unrecognized ${classified.definition.name} item "${sentence}"`);
        } else {
          pending.push({ line: item.line, rule: found.rule, match: found.match, entity });
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
  }

  private declareValue(item: PendingItem, namespace: string, value: string, index: number): void {
    const scopeKey = scopeKeyOf(
      this.dialect.namespaces,
      namespace,
      (ancestor) => item.match.slots[ancestor],
    );
    if ("missing" in scopeKey) {
      this.report(item.line, `${namespace} "${value}" needs a ${scopeKey.missing}`);
    } else if (namespace === "Control") {
      this.declareControl(
        item,
        value,
        scopeKey.key,
        flatten(item.match.lists["Control.kind"] ?? [])[index],
      );
    } else {
      this.registry.declare({
        namespace,
        name: value,
        scopeKey: scopeKey.key,
        origin: "spec",
        line: item.line,
        data: {},
      });
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
      this.report(item.line, `"${kind}" is not a Control kind (${kinds.join(", ")})`);
      return;
    }
    const existing = this.registry.lookup("Control", name, surfaceName);
    const surface = this.registry.lookup("Surface", surfaceName, "");
    if (existing !== undefined && existing.kind !== kind.toLowerCase()) {
      this.report(
        item.line,
        `Control "${existing.name}" on ${surfaceName} is a ${existing.kind}, not a ${kind}`,
      );
    } else if (existing === undefined && surface?.origin === "dialect") {
      this.report(item.line, `Unknown Control "${name}" on ${surfaceName}`);
    } else if (existing === undefined) {
      this.registry.declare({
        namespace: "Control",
        name,
        scopeKey: surfaceName,
        kind: kind.toLowerCase(),
        origin: "spec",
        line: item.line,
        data: {},
      });
    }
  }

  private complete(item: PendingItem): void {
    this.checkReferences(item);
    this.applyRelation(item);
    this.recordOutput(item);
    if (item.rule.emits === "Transition") {
      this.declareTransitions(item);
    } else if (item.rule.emits === "Control") {
      this.declareControls(item);
    }
  }

  private checkReferences(item: PendingItem): void {
    for (const namespace of item.rule.references ?? []) {
      const scopeKey = scopeKeyOf(
        this.dialect.namespaces,
        namespace,
        (ancestor) => item.match.slots[ancestor],
      );
      for (const value of valuesOf(item.match, namespace)) {
        const known =
          "key" in scopeKey && this.registry.lookup(namespace, value, scopeKey.key) !== undefined;
        known || this.report(item.line, `Unknown ${namespace} "${value}"`);
      }
    }
  }

  private applyRelation(item: PendingItem): void {
    const target = item.match.slots["Entity"];
    if (item.rule.relation !== "belongs-to" || item.entity === undefined || target === undefined) {
      return;
    }
    const owner = this.registry.lookup("Entity", item.entity, "");
    const targetEntry = this.registry.lookup("Entity", target, "");
    if (owner !== undefined && targetEntry !== undefined) {
      const name = targetEntry.name.charAt(0).toLowerCase() + targetEntry.name.slice(1);
      this.registry.declare({
        namespace: "Field",
        name,
        scopeKey: owner.name,
        kind: "relation",
        origin: "spec",
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
    for (const chain of chainsOf(item.match.lists["State"] ?? [])) {
      chain.slice(1).forEach((to, index) => {
        const from = chain[index] as string;
        this.analysis.declarations.push({
          kind: "Transition",
          key: `${entity}.${field}:${from}->${to}`,
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
    for (const name of valuesOf(item.match, "Control")) {
      const control = this.registry.lookup("Control", name, surface.name);
      control !== undefined &&
        this.analysis.declarations.push({
          kind: "Control",
          key: `${surface.name}/${control.name}`,
          line: item.line,
          data: { Surface: surface.name, Control: control.name },
        });
    }
  }

  private collectComposites(section: Section): void {
    for (const item of section.items) {
      const parsed = /^(.*\S)\s+means$/i.exec(item.text);
      if (parsed === null) {
        this.report(item.line, `Composite step must end with "means": "${item.text}"`);
        continue;
      }
      this.addComposite(parsed[1] as string, item);
    }
  }

  private addComposite(header: string, item: Item): void {
    try {
      const children = item.children.map((child) => ({ text: child.text, line: child.line }));
      children.length === 0 &&
        this.report(item.line, `Composite step "${header}" has no child steps`);
      this.composites.push({ header, matcher: compilePattern(header), children, line: item.line });
    } catch (error) {
      if (!(error instanceof PatternError)) {
        throw error;
      }
      this.report(item.line, `Invalid composite step pattern: ${error.message}`);
    }
  }

  private bindScenario(classified: ClassifiedSection): Scenario {
    const { section, definition, match } = classified;
    const name = match.slots["Name"] ?? definition.name;
    const lines = scenarioLines(section);
    const resolver = new ScenarioResolver({
      dialect: this.dialect,
      registry: this.registry,
      composites: this.composites,
      analysis: this.analysis,
      usedSurfaces: this.usedSurfaces,
      scenarioName: name,
      report: (line, message) => this.report(line, message),
    });
    const steps = resolver.resolve(lines);
    return { name, source: { file: this.file, line: section.line }, steps };
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
    const node: SurfaceNode = { controls: Object.fromEntries(controls) };
    return definition?.route === undefined ? node : { route: definition.route, ...node };
  }

  private finish(scenarios: Scenario[]): BindResult {
    if (this.errors.length > 0) {
      const errors = [...this.errors].sort((first, second) => first.line - second.line);
      return { ok: false, errors };
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
      scenarios,
    };
    return { ok: true, file: this.file, ast, analysis: this.analysis };
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

function valuesOf(match: Match, namespace: string): string[] {
  const scalar = match.slots[namespace];
  return scalar === undefined ? flatten(match.lists[namespace] ?? []) : [scalar];
}

function chainsOf(values: readonly ListValue[]): string[][] {
  return values.every((value) => typeof value === "string")
    ? [values as string[]]
    : values.map((value) => flatten([value]));
}
