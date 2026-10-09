import type { NamespaceDefinition } from "./dialect.js";

export type EntryOrigin = "dialect" | "spec";

export interface Entry {
  namespace: string;
  name: string;
  scopeKey: string;
  kind?: string;
  origin: EntryOrigin;
  file?: string;
  line: number;
  data: Record<string, string>;
}

export type ScopeKey = { key: string } | { missing: string };

/** Stores declared namespace entries; names and scope keys compare case-insensitively. */
export class Registry {
  private readonly entries = new Map<string, Entry[]>();

  declare(entry: Entry): Entry {
    const existing = this.lookup(entry.namespace, entry.name, entry.scopeKey);
    if (existing !== undefined) {
      return existing;
    }
    this.entries.set(entry.namespace, [...(this.entries.get(entry.namespace) ?? []), entry]);
    return entry;
  }

  lookup(namespace: string, name: string, scopeKey: string): Entry | undefined {
    return this.inScope(namespace, scopeKey).find((entry) => sameText(entry.name, name));
  }

  names(namespace: string): string[] {
    return (this.entries.get(namespace) ?? []).map((entry) => entry.name);
  }

  inScope(namespace: string, scopeKey: string): Entry[] {
    return (this.entries.get(namespace) ?? []).filter((entry) =>
      sameText(entry.scopeKey, scopeKey),
    );
  }
}

function sameText(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** Computes the scope key of a namespace from the values of its ancestor namespaces. */
export function scopeKeyOf(
  namespaces: Readonly<Record<string, NamespaceDefinition>>,
  namespace: string,
  valueOf: (ancestor: string) => string | undefined,
): ScopeKey {
  const parent = namespaces[namespace]?.scope;
  if (parent === undefined || parent === "scenario") {
    return { key: "" };
  }
  const parentValue = valueOf(parent);
  if (parentValue === undefined) {
    return { missing: parent };
  }
  const grandparent = scopeKeyOf(namespaces, parent, valueOf);
  if ("missing" in grandparent) {
    return grandparent;
  }
  return { key: grandparent.key === "" ? parentValue : `${grandparent.key}.${parentValue}` };
}
