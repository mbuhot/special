import { globSync, readFileSync } from "node:fs";
import type { SpecSource } from "@special/specdsl-core";

/** Reads every file matching the glob patterns, each pattern's matches sorted, duplicates dropped. */
export function baseSourcesFromGlobs(patterns: readonly string[]): SpecSource[] {
  const paths = patterns.flatMap((pattern) => globSync(pattern).sort());
  return [...new Set(paths)].map((path) => ({ file: path, markdown: readFileSync(path, "utf8") }));
}

/** Lowercase hyphenated form of an issue title, usable as a file name. */
export function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
