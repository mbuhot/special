import { globSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown, type SpecSource } from "@special/specdsl-core";

/** Reads every file matching the glob patterns, each pattern's matches sorted, duplicates dropped. */
export function baseSourcesFromGlobs(patterns: readonly string[]): SpecSource[] {
  const paths = patterns.flatMap((pattern) => globSync(pattern).sort());
  return readSources([...new Set(paths)]);
}

/** Reads the Markdown files in a directory that hold no scenario, sorted by name. */
export function baseSourcesFromSpecsDir(specsDir: string): SpecSource[] {
  const paths = readdirSync(specsDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(specsDir, name));
  return readSources(paths).filter((source) => !hasScenario(source.markdown));
}

/** Lowercase hyphenated form of an issue title, usable as a file name. */
export function slugOf(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readSources(paths: readonly string[]): SpecSource[] {
  return paths.map((path) => ({ file: path, markdown: readFileSync(path, "utf8") }));
}

function hasScenario(markdown: string): boolean {
  return parseMarkdown(markdown).sections.some((section) => section.heading.startsWith("Scenario"));
}
