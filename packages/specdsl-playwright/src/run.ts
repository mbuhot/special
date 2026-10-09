import { test } from "@playwright/test";
import { loadSpecs, webAppRuntime } from "./specs.js";

for (const { spec, lock } of loadSpecs()) {
  const specRuntime = webAppRuntime(lock);

  test.describe(spec.dialect.name, () => {
    test.afterAll(async () => {
      await specRuntime.dispose();
    });

    for (const scenario of spec.scenarios) {
      test(scenario.name, async ({ browser, request, baseURL }, testInfo) => {
        testInfo.annotations.push({
          type: "spec",
          description: `${scenario.source.file}:${scenario.source.line}`,
        });
        await specRuntime.runScenario(
          spec,
          scenario,
          { browser, request, baseURL: baseURL ?? "http://127.0.0.1:4012" },
          { modes: ["test"] },
        );
      });
    }
  });
}
