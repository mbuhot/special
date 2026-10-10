import { join } from "node:path";
import { test } from "@playwright/test";
import type { Scenario, SpecAst } from "@special/specdsl-core";
import { produceVideo } from "./demo/produce.js";
import { scenarioSlug } from "./demo/narration.js";
import type { WebAppServices } from "./handlers/web-app.js";
import { demoOutputDirectory } from "./paths.js";
import { loadSpecs, webAppRuntime } from "./specs.js";
import type { WebAppRuntime } from "./specs.js";

const SCENARIO_FILTER = process.env["DEMO_SCENARIO"];

async function produceDemo(
  specRuntime: WebAppRuntime,
  spec: SpecAst,
  scenario: Scenario,
  services: Omit<WebAppServices, "recording">,
): Promise<void> {
  await produceVideo({
    scenario,
    outputDirectory: join(demoOutputDirectory, scenarioSlug(scenario.name)),
    videoName: "demo.mp4",
    run: (recording, recorder) =>
      specRuntime.runScenario(
        spec,
        scenario,
        { ...services, recording },
        { modes: ["demo"], hooks: recorder },
      ),
  });
}

function selected(scenario: Scenario): boolean {
  return (
    SCENARIO_FILTER === undefined || scenario.name.toLowerCase() === SCENARIO_FILTER.toLowerCase()
  );
}

for (const { spec, lock } of loadSpecs()) {
  const specRuntime = webAppRuntime(lock);

  test.describe(`demo ${spec.dialect.name}`, () => {
    test.afterAll(async () => {
      await specRuntime.dispose();
    });

    for (const scenario of spec.scenarios.filter(selected)) {
      test(scenario.name, async ({ browser, request, baseURL }) => {
        await produceDemo(specRuntime, spec, scenario, {
          browser,
          request,
          baseURL: baseURL ?? "http://127.0.0.1:4012",
        });
      });
    }
  });
}
