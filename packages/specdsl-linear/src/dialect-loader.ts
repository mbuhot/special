import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Dialect } from "@special/specdsl-core";

/** Imports a dialect module (.ts or .js) and returns its default or `dialect` export. */
export async function loadDialect(dialectPath: string): Promise<Dialect> {
  const absolute = resolve(dialectPath);
  const loaded: Record<string, unknown> = absolute.endsWith(".ts")
    ? await (await import("tsx/esm/api")).tsImport(pathToFileURL(absolute).href, import.meta.url)
    : await import(pathToFileURL(absolute).href);
  const exported = findDialect(loaded);
  if (exported === undefined) {
    throw new Error(`${dialectPath} has no default or "dialect" export`);
  }
  return exported;
}

function findDialect(loaded: Record<string, unknown>): Dialect | undefined {
  const candidate = loaded["dialect"] ?? loaded["default"];
  if (isDialect(candidate)) {
    return candidate;
  }
  const nested = (candidate as Record<string, unknown> | undefined)?.["default"];
  return isDialect(nested) ? nested : undefined;
}

function isDialect(value: unknown): value is Dialect {
  return typeof value === "object" && value !== null && "stepIds" in value;
}
