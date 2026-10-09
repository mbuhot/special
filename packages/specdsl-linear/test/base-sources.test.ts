import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseSourcesFromGlobs, baseSourcesFromSpecsDir, slugOf } from "../src/base-sources.js";

const MODEL = "# Invoicing\n\n## Model\n\n- Customer: name.\n";
const FEATURE = '# Invoicing\n\n## Scenario: Something happens\n\nGiven a Customer "Acme"\n';

function projectDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "specdsl-linear-base-"));
  writeFileSync(join(directory, "b-model.md"), MODEL);
  writeFileSync(join(directory, "a-surfaces.md"), "# Invoicing\n\n## Surfaces\n");
  writeFileSync(join(directory, "feature.md"), FEATURE);
  writeFileSync(join(directory, "notes.txt"), "ignored");
  return directory;
}

describe("base sources", () => {
  it("selects the directory's Markdown files that hold no scenario, in name order", () => {
    const directory = projectDirectory();

    expect(baseSourcesFromSpecsDir(directory).map((source) => source.file)).toEqual([
      join(directory, "a-surfaces.md"),
      join(directory, "b-model.md"),
    ]);
  });

  it("reads files matching each glob, sorted, without duplicates", () => {
    const directory = projectDirectory();

    const sources = baseSourcesFromGlobs([join(directory, "b-*.md"), join(directory, "*.md")]);

    expect(sources.map((source) => source.file)).toEqual([
      join(directory, "b-model.md"),
      join(directory, "a-surfaces.md"),
      join(directory, "feature.md"),
    ]);
  });

  it("names a feature file after the issue title", () => {
    expect(slugOf("Invoice line totals (v2)!")).toBe("invoice-line-totals-v2");
  });
});
