import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const designOutputDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../design-output",
);

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

function reports() {
  if (!existsSync(designOutputDirectory)) return [];
  return readdirSync(designOutputDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(designOutputDirectory, entry.name, "report.json"))
    .filter((file) => existsSync(file))
    .map((file) => JSON.parse(readFileSync(file, "utf8")))
    .filter((report) => scenarioName === undefined || report.scenario === scenarioName);
}

const mismatched = reports()
  .filter((report) => report.mismatches.length > 0)
  .sort((left, right) => left.source.localeCompare(right.source));

const mismatchCount = mismatched.reduce((sum, report) => sum + report.mismatches.length, 0);
writeFileSync(
  join(designOutputDirectory, "mismatches.json"),
  `${JSON.stringify(mismatched, null, 2)}\n`,
);

console.log(
  `\nDesign mismatches: ${mismatchCount} in ${mismatched.length} scenarios (design-output/mismatches.json)`,
);
for (const report of mismatched) {
  console.log(`\n  ${report.scenario} (${report.source})`);
  for (const mismatch of report.mismatches) {
    console.log(
      `    line ${mismatch.line} ${mismatch.step} on ${mismatch.artboard}: expected ${mismatch.expected}, found ${mismatch.found}`,
    );
  }
}

process.exit(result.status ?? 1);
