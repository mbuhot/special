import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { test } from "@playwright/test";
import type { Scenario, SpecAst } from "@special/specdsl-core";
import { scenarioSlug } from "./demo/narration.js";
import { produceVideo } from "./demo/produce.js";
import type { StepHooks } from "./runtime.js";
import { runtime } from "./runtime.js";
import { designContexts, designLocators, designSteps, MismatchLog } from "./handlers/artboards.js";
import type { DesignServices } from "./handlers/artboards.js";
import type { WebAppContextStates, WebAppStepArgs } from "./handlers/web-app.js";
import { designOutputDirectory, designsDirectory } from "./paths.js";
import { loadSpecs } from "./specs.js";

const SCENARIO_FILTER = process.env["DESIGN_SCENARIO"];
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

type DesignHooks = StepHooks<DesignServices, WebAppContextStates>;

async function serveDesigns(): Promise<{ baseURL: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    const relativePath = normalize(decodeURIComponent(request.url?.split("?")[0] ?? "/"));
    const file = join(designsDirectory, relativePath);
    if (!file.startsWith(designsDirectory) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "text/plain" });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseURL: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function lineTracking(hooks: DesignHooks, log: MismatchLog): DesignHooks {
  return {
    aroundStep: (invocation, perform, env) => {
      log.currentLine = invocation.line;
      return hooks.aroundStep?.(invocation, perform, env) ?? perform();
    },
    onNarration: (node, env) => hooks.onNarration?.(node, env) ?? Promise.resolve(),
  };
}

async function produceWalkthrough(
  spec: SpecAst,
  scenario: Scenario,
  services: Omit<DesignServices, "recording" | "log">,
  designRuntime: ReturnType<typeof runtime<WebAppStepArgs, DesignServices, WebAppContextStates>>,
): Promise<void> {
  const outputDirectory = join(designOutputDirectory, scenarioSlug(scenario.name));
  const log = new MismatchLog();
  await produceVideo({
    scenario,
    outputDirectory,
    videoName: "design.mp4",
    run: (recording, recorder) =>
      designRuntime.runScenario(
        designLocators(spec),
        scenario,
        { ...services, recording, log },
        { modes: ["demo"], hooks: lineTracking(recorder, log) },
      ),
  });
  writeFileSync(
    join(outputDirectory, "report.json"),
    `${JSON.stringify(
      {
        scenario: scenario.name,
        source: `${scenario.source.file}:${scenario.source.line}`,
        mismatches: log.entries,
      },
      null,
      2,
    )}\n`,
  );
}

function selected(scenario: Scenario): boolean {
  return (
    SCENARIO_FILTER === undefined || scenario.name.toLowerCase() === SCENARIO_FILTER.toLowerCase()
  );
}

for (const { spec, lock } of loadSpecs()) {
  const designRuntime = runtime<WebAppStepArgs, DesignServices, WebAppContextStates>(lock, {
    contexts: designContexts,
    steps: designSteps,
  });
  const scenarios = spec.scenarios.filter(selected);

  test.describe(`design ${spec.dialect.name}`, () => {
    let designServer: Awaited<ReturnType<typeof serveDesigns>>;

    test.beforeAll(async () => {
      designServer = await serveDesigns();
    });

    test.afterAll(async () => {
      await designRuntime.dispose();
      await designServer?.close();
    });

    for (const scenario of scenarios) {
      test(scenario.name, async ({ browser, request }) => {
        await produceWalkthrough(
          spec,
          scenario,
          { browser, request, baseURL: designServer.baseURL, designsDirectory },
          designRuntime,
        );
      });
    }
  });
}
