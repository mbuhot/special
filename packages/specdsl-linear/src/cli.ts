#!/usr/bin/env node
import { parseArgs } from "node:util";
import type { SpecSource } from "@special/specdsl-core";
import { baseSourcesFromGlobs, baseSourcesFromSpecsDir } from "./base-sources.js";
import {
  attach,
  lint,
  pull,
  type CommandContext,
  type ExitCode,
  type SpecDestination,
} from "./commands.js";
import { createLinearClient } from "./linear.js";

const DEFAULT_DIALECT_PATH = "dialects/invoicing.ts";
const DEFAULT_OUT_DIR = "specs";

const USAGE = [
  "specdsl-linear pull <ISSUE> (--specs <dir> | --out-dir <dir>) [--base <glob>]... [--dialect <path.ts>]",
  "specdsl-linear lint <ISSUE> (--specs <dir> | --base <glob>...) [--dialect <path.ts>] [--comment]",
  "specdsl-linear attach <ISSUE> <file>... [--title <title>]",
].join("\n");

function baseSources(specsDir: string | undefined, patterns: string[]): SpecSource[] {
  const fromSpecsDir = specsDir === undefined ? [] : baseSourcesFromSpecsDir(specsDir);
  return [...fromSpecsDir, ...baseSourcesFromGlobs(patterns)];
}

function destinationOf(specsDir: string | undefined, outDir: string): SpecDestination {
  return specsDir === undefined ? { kind: "out-dir", outDir } : { kind: "specs-dir", specsDir };
}

async function run(argv: string[], environment: NodeJS.ProcessEnv): Promise<ExitCode | 2> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dialect: { type: "string", default: DEFAULT_DIALECT_PATH },
      "out-dir": { type: "string", default: DEFAULT_OUT_DIR },
      specs: { type: "string" },
      base: { type: "string", multiple: true, default: [] },
      comment: { type: "boolean", default: false },
      title: { type: "string" },
    },
  });
  const [command, identifier, ...files] = positionals;
  const apiKey = environment["LINEAR_API_KEY"];
  if (command === undefined || identifier === undefined || apiKey === undefined) {
    console.error(`${USAGE}\nLINEAR_API_KEY must be set`);
    return 2;
  }
  const context: CommandContext = {
    client: createLinearClient({ apiKey, fetch }),
    print: (line) => console.log(line),
    printError: (line) => console.error(line),
  };
  switch (command) {
    case "pull":
      return pull(
        identifier,
        {
          dialectPath: values.dialect,
          bases: baseSources(values.specs, values.base),
          destination: destinationOf(values.specs, values["out-dir"]),
        },
        context,
      );
    case "lint":
      return lint(
        identifier,
        {
          dialectPath: values.dialect,
          bases: baseSources(values.specs, values.base),
          comment: values.comment,
        },
        context,
      );
    case "attach":
      return attach(identifier, { files, title: values.title }, context);
    default:
      console.error(USAGE);
      return 2;
  }
}

run(process.argv.slice(2), process.env).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
