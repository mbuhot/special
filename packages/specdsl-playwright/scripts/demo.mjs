import { spawnSync } from "node:child_process";

const argumentList = process.argv.slice(2);
const scenarioFlagIndex = argumentList.indexOf("--scenario");
const scenarioName = scenarioFlagIndex === -1 ? undefined : argumentList[scenarioFlagIndex + 1];

const environment = { ...process.env };
if (scenarioName !== undefined) environment.DEMO_SCENARIO = scenarioName;

const result = spawnSync("playwright", ["test", "--project=demo"], {
  stdio: "inherit",
  env: environment,
});
process.exit(result.status ?? 1);
