#!/usr/bin/env node
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { bindSpec, type SpecSource } from "./bind.js";
import type { Dialect } from "./dialect.js";
import { lint } from "./lint.js";
import { lockFile } from "./lock.js";

interface Arguments {
  command: string;
  specPath: string | undefined;
  basePatterns: string[];
  dialectPath: string | undefined;
  outPath: string | undefined;
}

const USAGE = [
  "specdsl bind <spec.md> [--base <path>]... --dialect <path.ts> [--out <file>]",
  "specdsl lint <spec.md> [--base <path>]... --dialect <path.ts>",
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

function readSources(parsed: Arguments, specPath: string): SpecSource[] {
  const baseFiles = parsed.basePatterns
    .flatMap((pattern) => globSync(pattern).sort())
    .filter((file) => resolve(file) !== resolve(specPath));
  return [...baseFiles, specPath].map((file) => ({ file, markdown: readFileSync(file, "utf8") }));
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
    result.errors.forEach((error) =>
      console.error(`${error.file}:${error.line}: error: ${error.message}`),
    );
    return 1;
  }
  if (mode === "bind") {
    emit(result.ast, parsed.outPath);
    return 0;
  }
  lint(result, dialect).forEach((warning) =>
    console.error(`${warning.file}:${warning.line}: warning: ${warning.message}`),
  );
  return 0;
}

async function main(): Promise<number> {
  const parsed = parseArguments(process.argv.slice(2));
  const { command, specPath, dialectPath } = parsed;
  if (dialectPath === undefined || !["bind", "lint", "lock"].includes(command)) {
    console.error(USAGE);
    return 2;
  }
  const dialect = await loadDialect(dialectPath);
  if (command === "lock") {
    emit(lockFile(dialect), parsed.outPath);
    return 0;
  }
  if (specPath === undefined) {
    console.error(USAGE);
    return 2;
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
