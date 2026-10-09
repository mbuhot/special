import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { SpecSource } from "./bind.js";

const CONFIG_FILE = "specdsl.json";
const SCENARIO_HEADING = /^## Scenario\b/m;

export type SpecFileKind = "base" | "feature";

export interface TreeConfig {
  dialectPath: string;
}

/** Says whether Markdown is a base file (no scenarios) or a feature file. */
export function classify(markdown: string): SpecFileKind {
  return SCENARIO_HEADING.test(markdown) ? "feature" : "base";
}

/** Nearest ancestor directory holding specdsl.json, or undefined when there is none. */
export function locateTreeRoot(startDir: string): string | undefined {
  const directory = resolve(startDir);
  if (isFile(join(directory, CONFIG_FILE))) {
    return directory;
  }
  const parent = dirname(directory);
  return parent === directory ? undefined : locateTreeRoot(parent);
}

/** Nearest ancestor directory holding specdsl.json; throws when there is none. */
export function findTreeRoot(startDir: string): string {
  const root = locateTreeRoot(startDir);
  if (root === undefined) {
    throw new Error(`no ${CONFIG_FILE} found in ${resolve(startDir)} or any parent directory`);
  }
  return root;
}

/** Reads the root's specdsl.json, resolving the dialect path against the root. */
export function treeConfig(root: string): TreeConfig {
  const configPath = join(root, CONFIG_FILE);
  const config: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  const dialect = (config as { dialect?: unknown } | null)?.dialect;
  if (typeof dialect !== "string") {
    throw new Error(`${configPath} must hold { "dialect": "<path>" }`);
  }
  return { dialectPath: resolve(root, dialect) };
}

/** Base files of the tree root and each directory down to the file or directory, in cascade order. */
export function baseSourcesFor(fileOrDir: string): SpecSource[] {
  const target = resolve(fileOrDir);
  const directory = statSync(target).isDirectory() ? target : dirname(target);
  const root = findTreeRoot(directory);
  return directoriesFromRoot(root, directory)
    .flatMap(baseFilesIn)
    .filter((file) => file !== target)
    .map((file) => treeSourceOf(root, file));
}

/** Reads a file under the root as a source named relative to the root's parent directory. */
export function treeSourceOf(root: string, file: string): SpecSource {
  return {
    file: relative(dirname(resolve(root)), file),
    markdown: readFileSync(file, "utf8"),
  };
}

/** Every feature file under the root, recursively, sorted by path. */
export function featureFiles(root: string): string[] {
  return markdownFilesUnder(resolve(root))
    .filter((file) => classify(readFileSync(file, "utf8")) === "feature")
    .sort();
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function directoriesFromRoot(root: string, directory: string): string[] {
  const steps = relative(root, directory).split(sep).filter(Boolean);
  return steps.reduce((chain, step) => [...chain, join(chain.at(-1) as string, step)], [root]);
}

function markdownFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(directory, entry.name))
    .sort();
}

function markdownFilesUnder(directory: string): string[] {
  const subdirectories = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(directory, entry.name));
  return [...markdownFilesIn(directory), ...subdirectories.flatMap(markdownFilesUnder)];
}

function baseFilesIn(directory: string): string[] {
  return markdownFilesIn(directory).filter(
    (file) => classify(readFileSync(file, "utf8")) === "base",
  );
}
