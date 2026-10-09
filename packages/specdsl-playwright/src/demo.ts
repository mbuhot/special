import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import type { Scenario, SpecAst } from "@special/specdsl-core";
import { assemble } from "./demo/assemble.js";
import { planNarration, scenarioSlug } from "./demo/narration.js";
import { DemoRecorder } from "./demo/recorder.js";
import { synthesizeAll } from "./demo/tts.js";
import type { WebAppServices } from "./handlers/web-app.js";
import { demoOutputDirectory } from "./paths.js";
import { loadSpecs, webAppRuntime } from "./specs.js";
import type { WebAppRuntime } from "./specs.js";

const VIDEO_SIZE = { width: 1280, height: 800 };
const SCENARIO_FILTER = process.env["DEMO_SCENARIO"];

async function produceDemo(
  specRuntime: WebAppRuntime,
  spec: SpecAst,
  scenario: Scenario,
  services: Omit<WebAppServices, "recording">,
): Promise<void> {
  const outputDirectory = join(demoOutputDirectory, scenarioSlug(scenario.name));
  const rawVideoDirectory = join(outputDirectory, "raw");
  const screenshotDirectory = join(outputDirectory, "steps");
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(screenshotDirectory, { recursive: true });

  const narrationByLine = planNarration(scenario);
  const clipsByText = await synthesizeAll(narrationByLine.values());
  const recorder = new DemoRecorder({ narrationByLine, clipsByText, screenshotDirectory });

  await specRuntime.runScenario(
    spec,
    scenario,
    { ...services, recording: { directory: rawVideoDirectory, size: VIDEO_SIZE } },
    { modes: ["demo"], hooks: recorder },
  );

  const rawVideoPath = await recorder.video?.path();
  if (rawVideoPath === undefined) throw new Error(`no video recorded for "${scenario.name}"`);
  await assemble({
    rawVideo: rawVideoPath,
    trimStartSeconds: recorder.trimStartSeconds,
    placements: recorder.placements,
    outputPath: join(outputDirectory, "demo.mp4"),
  });
  rmSync(rawVideoDirectory, { recursive: true, force: true });
  writeFileSync(
    join(outputDirectory, "timeline.json"),
    `${JSON.stringify(recorder.timeline, null, 2)}\n`,
  );
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
