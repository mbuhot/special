import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LockFile, SpecAst } from "@special/specdsl-core";
import { webAppContexts, webAppSteps } from "./handlers/web-app.js";
import type { WebAppContextStates, WebAppServices, WebAppStepArgs } from "./handlers/web-app.js";
import { dialectsDirectory, specsDirectory } from "./paths.js";
import { runtime } from "./runtime.js";
import type { Runtime } from "./runtime.js";

export type WebAppRuntime = Runtime<WebAppServices, WebAppContextStates>;

export interface LoadedSpec {
  spec: SpecAst;
  lock: LockFile;
}

function readJson<Parsed>(path: string): Parsed {
  return JSON.parse(readFileSync(path, "utf8")) as Parsed;
}

/** Loads every .ast.json under specs/ together with the lock file of its dialect. */
export function loadSpecs(): LoadedSpec[] {
  return readdirSync(specsDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ast.json"))
    .sort()
    .map((file) => {
      const spec = readJson<SpecAst>(join(specsDirectory, file));
      const lock = readJson<LockFile>(join(dialectsDirectory, `${spec.dialect.name}.lock.json`));
      return { spec, lock };
    });
}

export function webAppRuntime(lock: LockFile): WebAppRuntime {
  return runtime<WebAppStepArgs, WebAppServices, WebAppContextStates>(lock, {
    contexts: webAppContexts,
    steps: webAppSteps,
  });
}
