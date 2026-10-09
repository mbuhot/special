import type {
  Dialect,
  NamespaceDefinition,
  SectionOccurrence,
  SectionBody,
  ContextScope,
} from "./dialect.js";
import type { SlotDescriptor } from "./pattern.js";

export interface LockSlot {
  name: string;
  namespace: string;
  kind?: string;
  source: SlotDescriptor["source"];
  occurrence: SlotDescriptor["occurrence"];
  enumeration?: readonly string[];
}

export interface LockStep {
  id: string;
  pattern: string;
  slots: LockSlot[];
  uses: readonly string[];
  declares: readonly string[];
  emits?: string;
}

export interface LockContext {
  scope: ContextScope;
  keyedBy?: string;
  requires: readonly string[];
  config: string[];
}

export interface LockSection {
  heading: string;
  occurs: SectionOccurrence;
  body?: SectionBody;
}

export interface LockFile {
  dialect: { name: string; version: string };
  namespaces: Record<string, Pick<NamespaceDefinition, "scope" | "kinds" | "resolution">>;
  contexts: Record<string, LockContext>;
  sections: Record<string, LockSection>;
  steps: LockStep[];
}

/** Builds the lock file runtimes use to check handler coverage. */
export function lockFile(dialect: Dialect): LockFile {
  return {
    dialect: { name: dialect.name, version: dialect.version },
    namespaces: lockNamespaces(dialect),
    contexts: lockContexts(dialect),
    sections: lockSections(dialect),
    steps: dialect.steps.map((resolved) => lockStep(resolved)),
  };
}

function lockNamespaces(dialect: Dialect): LockFile["namespaces"] {
  return Object.fromEntries(
    Object.entries(dialect.namespaces).map(([name, definition]) => [
      name,
      withoutUndefined({ ...definition }),
    ]),
  );
}

function withoutUndefined<Value extends object>(value: Value): Value {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Value;
}

function lockContexts(dialect: Dialect): Record<string, LockContext> {
  return Object.fromEntries(
    Object.entries(dialect.contexts).map(([name, definition]) => {
      const itemKeys = Object.values(dialect.sections)
        .flatMap((section) => section.rules)
        .filter((rule) => rule.context === name)
        .flatMap((rule) =>
          rule.matcher.slots.filter((slot) => slot.capture === "entry").map((slot) => slot.name),
        );
      const config = [...new Set([...definition.config, ...itemKeys])];
      return [name, withoutUndefined({ ...definition, config })];
    }),
  );
}

function lockSections(dialect: Dialect): Record<string, LockSection> {
  return Object.fromEntries(
    Object.values(dialect.sections).map((section) => [
      section.name,
      withoutUndefined({
        heading: section.heading ?? section.name,
        occurs: section.occurs,
        body: section.body,
      }),
    ]),
  );
}

function lockStep(resolved: Dialect["steps"][number]): LockStep {
  return withoutUndefined({
    id: resolved.id,
    pattern: resolved.pattern,
    slots: resolved.matcher.slots.map(lockSlot),
    uses: resolved.uses ?? [],
    declares: resolved.declares ?? [],
    emits: resolved.emits?.kind,
  });
}

function lockSlot(descriptor: SlotDescriptor): LockSlot {
  return withoutUndefined({
    name: descriptor.name,
    namespace: descriptor.namespace,
    kind: descriptor.constraint,
    source: descriptor.source,
    occurrence: descriptor.occurrence,
    enumeration: descriptor.capture === "enumeration" ? descriptor.enumeration : undefined,
  });
}
