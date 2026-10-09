import { compilePattern, PatternError, type Matcher, type SlotDescriptor } from "./pattern.js";

export type ContextScope = "suite" | "scenario" | "actor";
export type NamespaceResolution = "declared" | "free";
export type SectionOccurrence = "once" | "many";
export type SectionBody = "steps" | "composites";
export type ControlKind = "field" | "button" | "region" | "table" | "link";
export type StepMode = "test" | "demo" | "domain";
export type ItemRelation = "belongs-to" | "has-many";
export type ItemOutput = "actors" | "contexts" | "policies";

export interface NamespaceDefinition {
  scope?: string;
  kinds?: readonly string[];
  resolution: NamespaceResolution;
}

export interface ContextDefinition {
  scope: ContextScope;
  keyedBy?: string;
  requires: readonly string[];
  config: readonly string[];
}

export interface ItemRule {
  pattern: string;
  declares?: readonly string[];
  references?: readonly string[];
  emits?: string;
  context?: string;
  output?: ItemOutput;
  relation?: ItemRelation;
}

export interface SectionDefinition {
  heading?: string;
  occurs: SectionOccurrence;
  body?: SectionBody;
  items: readonly ItemRule[];
}

export interface ControlDefinition {
  kind: ControlKind;
  locators: Readonly<Record<string, string>>;
}

export interface SurfaceDefinition {
  route?: string;
  shared?: true;
  controls: Readonly<Record<string, ControlDefinition>>;
}

export interface EmissionRule {
  kind: string;
  fields: Readonly<Record<string, string>>;
}

export interface StepDefinition {
  pattern: string;
  id?: string;
  uses?: readonly string[];
  declares?: readonly string[];
  emits?: EmissionRule;
  modes?: readonly StepMode[];
}

export type CheckDefinition =
  | { check: "coverage"; declared: string; usedBy: string }
  | { check: "sequence"; machine: string; observed: string; within: "scenario" }
  | { check: "referenced"; declared: string };

export interface DialectDefinition {
  name: string;
  version: string;
  namespaces: Readonly<Record<string, NamespaceDefinition>>;
  contexts?: Readonly<Record<string, ContextDefinition>>;
  sections: Readonly<Record<string, SectionDefinition>>;
  surfaces?: Readonly<Record<string, SurfaceDefinition>>;
  steps: readonly StepDefinition[];
  checks?: readonly CheckDefinition[];
}

export interface ResolvedRule extends ItemRule {
  matcher: Matcher;
}

export interface ResolvedSection extends SectionDefinition {
  name: string;
  headingMatcher: Matcher;
  rules: readonly ResolvedRule[];
}

export interface ResolvedStep extends StepDefinition {
  id: string;
  matcher: Matcher;
}

export interface Dialect extends DialectDefinition {
  contexts: Readonly<Record<string, ContextDefinition>>;
  sections: Readonly<Record<string, ResolvedSection>>;
  surfaces: Readonly<Record<string, SurfaceDefinition>>;
  steps: readonly ResolvedStep[];
  checks: readonly CheckDefinition[];
  stepIds: readonly string[];
}

export class DialectError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid dialect:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
  }
}

/** Declares a namespace; `resolution: "free"` accepts any value. */
export function ns(
  options: { scope?: string; kinds?: readonly string[]; resolution?: NamespaceResolution } = {},
): NamespaceDefinition {
  return { resolution: "declared", ...options };
}

/** Declares a runtime context with its scope and setup dependencies. */
export function context(options: {
  scope: ContextScope;
  keyedBy?: string;
  requires?: readonly string[];
  config?: readonly string[];
}): ContextDefinition {
  return { requires: [], config: [], ...options };
}

/** Declares a spec section kind. */
export function section(options: {
  heading?: string;
  occurs: SectionOccurrence;
  body?: SectionBody;
  items?: readonly ItemRule[];
}): SectionDefinition {
  return { items: [], ...options };
}

/** Declares a UI surface with an optional route template and located controls; a shared surface is present on every page. */
export function surface(options: {
  route?: string;
  controls: Record<string, ControlDefinition>;
  shared?: true;
}): SurfaceDefinition {
  return options;
}

function controlBuilder(kind: ControlKind) {
  return (locators: Record<string, string>): ControlDefinition => ({ kind, locators });
}

export const field = controlBuilder("field");
export const button = controlBuilder("button");
export const region = controlBuilder("region");
export const table = controlBuilder("table");
export const link = controlBuilder("link");

/** Declares a step pattern; the id defaults to a slug of the pattern's literal words. */
export function step(
  pattern: string,
  options: Omit<StepDefinition, "pattern"> = {},
): StepDefinition {
  return { pattern, ...options };
}

export const check = {
  coverage: (options: { declared: string; usedBy: string }): CheckDefinition => ({
    check: "coverage",
    ...options,
  }),
  sequence: (options: {
    machine: string;
    observed: string;
    within: "scenario";
  }): CheckDefinition => ({
    check: "sequence",
    ...options,
  }),
  referenced: (options: { declared: string }): CheckDefinition => ({
    check: "referenced",
    ...options,
  }),
};

/**
 * Validates and compiles a dialect definition.
 * Issues: duplicate step ids, unknown namespaces or contexts, malformed patterns, and ambiguous steps.
 * Two steps are ambiguous when each matches the sample text generated from the other (a conservative check:
 * it detects duplicated and mutually-overlapping patterns, not every possible overlap).
 */
export function dialect(definition: DialectDefinition): Dialect {
  const issues: string[] = [];
  const contexts = definition.contexts ?? {};
  const surfaces = definition.surfaces ?? {};
  const checks = definition.checks ?? [];
  validateNamespaces(definition.namespaces, issues);
  validateContexts(contexts, definition.namespaces, issues);
  validateSurfaces(surfaces, definition.namespaces, issues);
  const steps = resolveSteps(definition.steps, issues);
  const sections = resolveSections(definition.sections, issues);
  const resolved = { ...definition, contexts, surfaces, checks, steps, sections };
  validateSlots(resolved, issues);
  validateStepReferences(steps, contexts, definition.namespaces, issues);
  validateSectionReferences(sections, contexts, definition.namespaces, issues);
  validateStepIds(steps, issues);
  validateAmbiguity(steps, issues);
  if (issues.length > 0) {
    throw new DialectError(issues);
  }
  return { ...resolved, stepIds: steps.map((resolvedStep) => resolvedStep.id) };
}

function validateNamespaces(namespaces: DialectDefinition["namespaces"], issues: string[]): void {
  for (const [name, definition] of Object.entries(namespaces)) {
    const scope = definition.scope;
    if (scope !== undefined && scope !== "scenario" && !(scope in namespaces)) {
      issues.push(`Namespace "${name}" has unknown scope "${scope}"`);
    }
  }
}

function validateContexts(
  contexts: Readonly<Record<string, ContextDefinition>>,
  namespaces: DialectDefinition["namespaces"],
  issues: string[],
): void {
  for (const [name, definition] of Object.entries(contexts)) {
    for (const required of definition.requires) {
      required in contexts ||
        issues.push(`Context "${name}" requires unknown context "${required}"`);
    }
    if (definition.keyedBy !== undefined && !(definition.keyedBy in namespaces)) {
      issues.push(`Context "${name}" is keyed by unknown namespace "${definition.keyedBy}"`);
    }
  }
}

function validateSurfaces(
  surfaces: Readonly<Record<string, SurfaceDefinition>>,
  namespaces: DialectDefinition["namespaces"],
  issues: string[],
): void {
  const kinds = namespaces["Control"]?.kinds;
  for (const [surfaceName, definition] of Object.entries(surfaces)) {
    for (const [controlName, control] of Object.entries(definition.controls)) {
      if (kinds !== undefined && !kinds.includes(control.kind)) {
        issues.push(
          `Control "${controlName}" on "${surfaceName}" has kind "${control.kind}" outside the Control kinds`,
        );
      }
    }
  }
}

function compileOrIssue(pattern: string, label: string, issues: string[]): Matcher | null {
  try {
    return compilePattern(pattern);
  } catch (error) {
    if (error instanceof PatternError) {
      issues.push(`${label}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

function slugOf(matcher: Matcher): string {
  return matcher.literalWords.join("-").toLowerCase();
}

function resolveSteps(steps: readonly StepDefinition[], issues: string[]): ResolvedStep[] {
  return steps.flatMap((definition) => {
    const matcher = compileOrIssue(definition.pattern, `Step "${definition.pattern}"`, issues);
    if (matcher === null) {
      return [];
    }
    const id = definition.id ?? slugOf(matcher);
    return [{ ...definition, id, matcher }];
  });
}

function resolveSections(
  sections: DialectDefinition["sections"],
  issues: string[],
): Record<string, ResolvedSection> {
  const resolved: Record<string, ResolvedSection> = {};
  for (const [name, definition] of Object.entries(sections)) {
    const headingMatcher = compileOrIssue(
      definition.heading ?? name,
      `Section "${name}" heading`,
      issues,
    );
    const rules = definition.items.flatMap((rule) => {
      const matcher = compileOrIssue(
        rule.pattern,
        `Section "${name}" item "${rule.pattern}"`,
        issues,
      );
      return matcher === null ? [] : [{ ...rule, matcher }];
    });
    if (headingMatcher !== null) {
      resolved[name] = { ...definition, name, headingMatcher, rules };
    }
  }
  return resolved;
}

function validateSlot(
  descriptor: SlotDescriptor,
  label: string,
  namespaces: DialectDefinition["namespaces"],
  issues: string[],
): void {
  if (descriptor.capture === "enumeration") {
    return;
  }
  const namespace = namespaces[descriptor.namespace];
  if (namespace === undefined) {
    issues.push(
      `${label}: slot <${descriptor.name}> names unknown namespace "${descriptor.namespace}"`,
    );
    return;
  }
  const needsKinds = descriptor.constraint !== undefined || descriptor.capture === "kind";
  const unknownKind = (descriptor.constraint?.split("|") ?? []).find(
    (kind) => !namespace.kinds?.includes(kind),
  );
  if (needsKinds && namespace.kinds === undefined) {
    issues.push(`${label}: namespace "${descriptor.namespace}" has no kinds`);
  } else if (unknownKind !== undefined) {
    issues.push(`${label}: "${unknownKind}" is not a kind of namespace "${descriptor.namespace}"`);
  }
}

function validateSlots(
  resolved: Pick<Dialect, "steps" | "sections" | "namespaces">,
  issues: string[],
): void {
  for (const resolvedStep of resolved.steps) {
    for (const descriptor of resolvedStep.matcher.slots) {
      validateSlot(descriptor, `Step "${resolvedStep.pattern}"`, resolved.namespaces, issues);
    }
  }
  for (const resolvedSection of Object.values(resolved.sections)) {
    const matchers = [
      resolvedSection.headingMatcher,
      ...resolvedSection.rules.map((rule) => rule.matcher),
    ];
    for (const matcher of matchers) {
      for (const descriptor of matcher.slots) {
        validateSlot(
          descriptor,
          `Section "${resolvedSection.name}" pattern "${matcher.source}"`,
          resolved.namespaces,
          issues,
        );
      }
    }
  }
}

function validateStepReferences(
  steps: readonly ResolvedStep[],
  contexts: Readonly<Record<string, ContextDefinition>>,
  namespaces: DialectDefinition["namespaces"],
  issues: string[],
): void {
  for (const resolvedStep of steps) {
    for (const used of resolvedStep.uses ?? []) {
      used in contexts || issues.push(`Step "${resolvedStep.id}" uses unknown context "${used}"`);
    }
    for (const declared of resolvedStep.declares ?? []) {
      declared in namespaces ||
        issues.push(`Step "${resolvedStep.id}" declares unknown namespace "${declared}"`);
    }
  }
}

function validateSectionReferences(
  sections: Readonly<Record<string, ResolvedSection>>,
  contexts: Readonly<Record<string, ContextDefinition>>,
  namespaces: DialectDefinition["namespaces"],
  issues: string[],
): void {
  for (const resolvedSection of Object.values(sections)) {
    for (const rule of resolvedSection.rules) {
      const label = `Section "${resolvedSection.name}" item "${rule.pattern}"`;
      if (rule.context !== undefined && !(rule.context in contexts)) {
        issues.push(`${label} targets unknown context "${rule.context}"`);
      }
      for (const name of [...(rule.declares ?? []), ...(rule.references ?? [])]) {
        name in namespaces || issues.push(`${label} names unknown namespace "${name}"`);
      }
    }
  }
}

function validateStepIds(steps: readonly ResolvedStep[], issues: string[]): void {
  const seen = new Set<string>();
  for (const resolvedStep of steps) {
    if (seen.has(resolvedStep.id)) {
      issues.push(`Duplicate step id "${resolvedStep.id}"`);
    }
    seen.add(resolvedStep.id);
  }
}

function validateAmbiguity(steps: readonly ResolvedStep[], issues: string[]): void {
  steps.forEach((first, index) => {
    for (const second of steps.slice(index + 1)) {
      if (
        first.id !== second.id &&
        first.matcher(second.matcher.sample) &&
        second.matcher(first.matcher.sample)
      ) {
        issues.push(`Ambiguous steps "${first.id}" and "${second.id}"`);
      }
    }
  });
}
