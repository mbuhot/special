#!/usr/bin/env node
import { parseArgs } from "node:util";
import { attach, lint, pull, type CommandContext, type ExitCode } from "./commands.js";
import { createLinearClient } from "./linear.js";

const DEFAULT_DIALECT_PATH = "dialects/invoicing.ts";
const DEFAULT_OUT_DIR = "specs";

const USAGE = [
  "specdsl-linear pull <ISSUE> [--dialect <path.ts>] [--out <dir>]",
  "specdsl-linear lint <ISSUE> [--dialect <path.ts>] [--comment]",
  "specdsl-linear attach <ISSUE> <file>... [--title <title>]",
].join("\n");

async function run(argv: string[], environment: NodeJS.ProcessEnv): Promise<ExitCode | 2> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dialect: { type: "string", default: DEFAULT_DIALECT_PATH },
      out: { type: "string", default: DEFAULT_OUT_DIR },
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
      return pull(identifier, { dialectPath: values.dialect, outDir: values.out }, context);
    case "lint":
      return lint(identifier, { dialectPath: values.dialect, comment: values.comment }, context);
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
