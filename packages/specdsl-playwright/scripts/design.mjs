import { spawnSync } from "node:child_process";

const argumentList = process.argv.slice(2);
const scenarioFlagIndex = argumentList.indexOf("--scenario");
const scenarioName = scenarioFlagIndex === -1 ? undefined : argumentList[scenarioFlagIndex + 1];

const environment = { ...process.env };
if (scenarioName !== undefined) environment.DESIGN_SCENARIO = scenarioName;

environment.SPECDSL_STATIC_ONLY = "1";

const workersFlagIndex = argumentList.indexOf("--workers");
const workers = workersFlagIndex === -1 ? "32" : argumentList[workersFlagIndex + 1];

const result = spawnSync("playwright", ["test", "--project=design", `--workers=${workers}`], {
  stdio: "inherit",
  env: environment,
});
process.exit(result.status ?? 1);
