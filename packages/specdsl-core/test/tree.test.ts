import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseSourcesFor, classify, featureFiles, findTreeRoot, treeConfig } from "../src/index.js";

const BASE_MARKDOWN = "# Shared\n\n## Model\n\n- Customer: name.\n";
const FEATURE_MARKDOWN = '# Shared\n\n## Scenario: Something\n\nGiven a Customer "Acme"\n';

function writeAt(root: string, relativePath: string, markdown: string): string {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, markdown);
  return path;
}

function specsTree(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "specdsl-tree-")));
  writeAt(root, "specdsl.json", '{ "dialect": "../dialects/invoicing.ts" }');
  writeAt(root, "b-customer.md", BASE_MARKDOWN);
  writeAt(root, "a-actors.md", "# Shared\n\n## Actors\n\n- Accounts: role accountant\n");
  writeAt(root, "root-feature.md", FEATURE_MARKDOWN);
  writeAt(root, "billing/model.md", BASE_MARKDOWN);
  writeAt(root, "billing/sending.md", FEATURE_MARKDOWN);
  writeAt(root, "billing/archive/old-feature.md", FEATURE_MARKDOWN);
  writeAt(root, "shipping/model.md", BASE_MARKDOWN);
  writeAt(root, "shipping/notes.txt", "ignored");
  return root;
}

describe("classify", () => {
  it("calls a file with a scenario heading a feature", () => {
    expect(classify(FEATURE_MARKDOWN)).toBe("feature");
  });

  it("calls a file without a scenario heading a base", () => {
    expect(classify(BASE_MARKDOWN)).toBe("base");
  });
});

describe("findTreeRoot", () => {
  it("finds the directory holding specdsl.json from a nested directory", () => {
    const root = specsTree();

    expect(findTreeRoot(join(root, "billing", "archive"))).toBe(root);
  });

  it("fails when no parent directory holds specdsl.json", () => {
    const orphan = mkdtempSync(join(tmpdir(), "specdsl-orphan-"));

    expect(() => findTreeRoot(orphan)).toThrow(/no specdsl.json found/);
  });
});

describe("treeConfig", () => {
  it("resolves the dialect path against the root", () => {
    const root = specsTree();

    expect(treeConfig(root)).toEqual({ dialectPath: join(root, "..", "dialects", "invoicing.ts") });
  });
});

describe("baseSourcesFor", () => {
  it("cascades root base files then project base files, each sorted by name", () => {
    const root = specsTree();

    const sources = baseSourcesFor(join(root, "billing", "sending.md"));
    const treeName = basename(root);

    expect(sources.map((source) => source.file)).toEqual([
      join(treeName, "a-actors.md"),
      join(treeName, "b-customer.md"),
      join(treeName, "billing", "model.md"),
    ]);
  });

  it("gives a project directory the same cascade as its feature files", () => {
    const root = specsTree();

    const sources = baseSourcesFor(join(root, "shipping"));
    const treeName = basename(root);

    expect(sources.map((source) => source.file)).toEqual([
      join(treeName, "a-actors.md"),
      join(treeName, "b-customer.md"),
      join(treeName, "shipping", "model.md"),
    ]);
  });
});

describe("featureFiles", () => {
  it("lists every feature file under the root, recursively and sorted", () => {
    const root = specsTree();

    expect(featureFiles(root)).toEqual([
      join(root, "billing", "archive", "old-feature.md"),
      join(root, "billing", "sending.md"),
      join(root, "root-feature.md"),
    ]);
  });
});
