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

/** Outermost ancestor directory holding specdsl.json, or undefined when there is none. */
export function locateTreeRoot(startDir: string): string | undefined {
  const directory = resolve(startDir);
  const parent = dirname(directory);
  const outer = parent === directory ? undefined : locateTreeRoot(parent);
  return outer ?? (isFile(join(directory, CONFIG_FILE)) ? directory : undefined);
}

/** Outermost ancestor directory holding specdsl.json; throws when there is none. */
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

/** Base files of the root, then each project directory's used projects and own files, in cascade order. */
export function baseSourcesFor(fileOrDir: string): SpecSource[] {
  const target = resolve(fileOrDir);
  const directory = statSync(target).isDirectory() ? target : dirname(target);
  const root = findTreeRoot(directory);
  const files = [...baseFilesIn(root), ...projectCascade(root, directory, new Set())];
  return [...new Set(files)]
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

function projectCascade(root: string, project: string, visited: Set<string>): string[] {
  if (visited.has(project)) {
    return [];
  }
  visited.add(project);
  return directoriesFromRoot(root, project)
    .slice(1)
    .flatMap((directory) => [
      ...usedProjects(directory).flatMap((used) => projectCascade(root, used, visited)),
      ...baseFilesIn(directory),
    ]);
}

function usedProjects(directory: string): string[] {
  const configPath = join(directory, CONFIG_FILE);
  if (!isFile(configPath)) {
    return [];
  }
  const config = (JSON.parse(readFileSync(configPath, "utf8")) ?? {}) as {
    dialect?: unknown;
    uses?: unknown;
  };
  if (config.dialect !== undefined) {
    throw new Error(`${configPath} is a project config and must not set "dialect"`);
  }
  const uses = config.uses ?? [];
  if (!Array.isArray(uses) || !uses.every((entry) => typeof entry === "string")) {
    throw new Error(`${configPath} must hold { "uses": ["<path>", ...] }`);
  }
  return uses.map((entry) => resolve(directory, entry));
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
