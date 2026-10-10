#!/usr/bin/env node
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { BindSuccess } from "./ast.js";
import { bindSpec, type SpecSource } from "./bind.js";
import { designLint } from "./design.js";
import type { Dialect } from "./dialect.js";
import { lint } from "./lint.js";
import { lockFile } from "./lock.js";
import { baseSourcesFor, featureFiles, locateTreeRoot, treeConfig, treeSourceOf } from "./tree.js";

interface Arguments {
  command: string;
  specPath: string | undefined;
  basePatterns: string[];
  dialectPath: string | undefined;
  outPath: string | undefined;
}

const USAGE = [
  "specdsl bind <spec.md> [--base <path>]... [--dialect <path.ts>] [--out <file>]",
  "specdsl lint <spec.md> [--base <path>]... [--dialect <path.ts>]",
  "specdsl bind-all <root> [--dialect <path.ts>]",
  "specdsl design-lint <root> [--dialect <path.ts>]",
  "specdsl lock --dialect <path.ts> --out <file>",
].join("\n");

function parseArguments(argv: string[]): Arguments {
  const [command = "", ...rest] = argv;
  const parsed: Arguments = {
    command,
    specPath: undefined,
    basePatterns: [],
    dialectPath: undefined,
    outPath: undefined,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] as string;
    if (argument === "--dialect") {
      parsed.dialectPath = rest[++index];
    } else if (argument === "--base") {
      parsed.basePatterns.push(rest[++index] as string);
    } else if (argument === "--out") {
      parsed.outPath = rest[++index];
    } else {
      parsed.specPath = argument;
    }
  }
  return parsed;
}

async function loadDialect(dialectPath: string): Promise<Dialect> {
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

function readFile(file: string): SpecSource {
  return { file, markdown: readFileSync(file, "utf8") };
}

function explicitBases(parsed: Arguments, specPath: string): SpecSource[] {
  return parsed.basePatterns
    .flatMap((pattern) => globSync(pattern).sort())
    .filter((file) => resolve(file) !== resolve(specPath))
    .map(readFile);
}

function cascadedBases(specPath: string): SpecSource[] {
  const inTree = locateTreeRoot(dirname(resolve(specPath))) !== undefined;
  return inTree ? baseSourcesFor(specPath) : [];
}

function readSources(parsed: Arguments, specPath: string): SpecSource[] {
  const bases =
    parsed.basePatterns.length === 0 ? cascadedBases(specPath) : explicitBases(parsed, specPath);
  return [...bases, readFile(specPath)];
}

function emit(json: unknown, outPath: string | undefined): void {
  const text = `${JSON.stringify(json, null, 2)}\n`;
  outPath === undefined ? process.stdout.write(text) : writeFileSync(outPath, text);
}

function runBind(
  parsed: Arguments,
  dialect: Dialect,
  specPath: string,
  mode: "bind" | "lint",
): number {
  const result = bindSpec(readSources(parsed, specPath), dialect);
  if (!result.ok) {
    printErrors(result.errors);
    return 1;
  }
  if (mode === "bind") {
    emit(result.ast, parsed.outPath);
    return 0;
  }
  printWarnings(lint(result, dialect));
  return 0;
}

interface Diagnostic {
  file: string;
  line: number;
  message: string;
}

function printErrors(errors: Diagnostic[]): void {
  errors.forEach((error) => console.error(`${error.file}:${error.line}: error: ${error.message}`));
}

function printWarnings(warnings: Diagnostic[]): void {
  warnings.forEach((warning) =>
    console.error(`${warning.file}:${warning.line}: warning: ${warning.message}`),
  );
}

function astPathFor(featureFile: string): string {
  return join(dirname(featureFile), `${basename(featureFile, ".md")}.ast.json`);
}

function uniqueByFile(sources: SpecSource[]): SpecSource[] {
  return [...new Map(sources.map((source) => [source.file, source])).values()];
}

function bindWhole(
  root: string,
  featurePaths: string[],
  featureSources: SpecSource[],
  dialect: Dialect,
) {
  const baseSources = uniqueByFile([
    ...baseSourcesFor(root),
    ...featurePaths.flatMap((path) => baseSourcesFor(path)),
  ]);
  return bindSpec([...baseSources, ...featureSources], dialect);
}

function designWarnings(root: string, whole: BindSuccess): Diagnostic[] {
  const { designsPath } = treeConfig(root);
  return designsPath === undefined ? [] : designLint(whole, designsPath);
}

function runDesignLint(root: string, dialect: Dialect): number {
  const featurePaths = featureFiles(root);
  const featureSources = featurePaths.map((path) => treeSourceOf(root, path));
  const whole = bindWhole(root, featurePaths, featureSources, dialect);
  if (!whole.ok) {
    printErrors(whole.errors);
    return 1;
  }
  printWarnings(designWarnings(root, whole));
  return 0;
}

function runBindAll(root: string, dialect: Dialect): number {
  const featurePaths = featureFiles(root);
  const featureSources = featurePaths.map((path) => treeSourceOf(root, path));
  const whole = bindWhole(root, featurePaths, featureSources, dialect);
  if (!whole.ok) {
    printErrors(whole.errors);
    return 1;
  }
  printWarnings([...lint(whole, dialect), ...designWarnings(root, whole)]);
  let status = 0;
  featurePaths.forEach((path, index) => {
    const result = bindSpec(
      [...baseSourcesFor(path), featureSources[index] as SpecSource],
      dialect,
    );
    if (result.ok) {
      emit(result.ast, astPathFor(path));
    } else {
      printErrors(result.errors);
      status = 1;
    }
  });
  return status;
}

function defaultDialectPath(command: string, specPath: string): string | undefined {
  const root =
    command === "bind-all" || command === "design-lint"
      ? resolve(specPath)
      : locateTreeRoot(dirname(resolve(specPath)));
  return root === undefined ? undefined : treeConfig(root).dialectPath;
}

async function main(): Promise<number> {
  const parsed = parseArguments(process.argv.slice(2));
  const { command, specPath, outPath } = parsed;
  if (!["bind", "bind-all", "design-lint", "lint", "lock"].includes(command)) {
    console.error(USAGE);
    return 2;
  }
  if (command === "lock") {
    if (parsed.dialectPath === undefined) {
      console.error(USAGE);
      return 2;
    }
    emit(lockFile(await loadDialect(parsed.dialectPath)), outPath);
    return 0;
  }
  const dialectPath =
    parsed.dialectPath ??
    (specPath === undefined ? undefined : defaultDialectPath(command, specPath));
  if (specPath === undefined || dialectPath === undefined) {
    console.error(USAGE);
    return 2;
  }
  const dialect = await loadDialect(dialectPath);
  if (command === "bind-all") {
    return runBindAll(resolve(specPath), dialect);
  }
  if (command === "design-lint") {
    return runDesignLint(resolve(specPath), dialect);
  }
  return runBind(parsed, dialect, specPath, command as "bind" | "lint");
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
