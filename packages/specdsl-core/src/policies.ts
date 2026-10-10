import type { PolicyEntry } from "./ast.js";

/** The actions a role may perform, whether or not its reads are scoped. */
export function policyActions(entry: PolicyEntry | undefined): string[] {
  return entry === undefined ? [] : Array.isArray(entry) ? entry : entry.actions;
}

/** The predicate a role's reads are limited to, when the role reads only some records. */
export function policyScope(entry: PolicyEntry | undefined): string | undefined {
  return entry === undefined || Array.isArray(entry) ? undefined : entry.scope;
}
