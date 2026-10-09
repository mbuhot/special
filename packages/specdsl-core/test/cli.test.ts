import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpecAst } from "../src/index.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDirectory, "../bin/specdsl.js");
const dialectPath = resolve(testDirectory, "../../../dialects/invoicing.ts");

const baseMarkdown = [
  "# Invoicing",
  "",
  "## Model",
  "",
  "- Customer: name, email. Has many Invoice.",
  "- Invoice: number, status, total. Belongs to Customer.",
  "- Invoice.status: draft -> sent",
  "",
  "## Actors",
  "",
  "- Accounts: role accountant",
  "",
].join("\n");

const featureMarkdown = (scenarioName: string, invoiceNumber: string) =>
  [
    "# Invoicing",
    "",
    `## Scenario: ${scenarioName}`,
    "",
    'Given a Customer "Acme"',
    `Given an Invoice "${invoiceNumber}" with status draft, customer Acme`,
    "",
  ].join("\n");

function readAst(path: string): SpecAst {
  return JSON.parse(readFileSync(path, "utf8")) as SpecAst;
}

describe("specdsl bind-all", () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(join(tmpdir(), "specdsl-project-"));
    writeFileSync(join(projectDirectory, "model.md"), baseMarkdown);
    writeFileSync(join(projectDirectory, "first.md"), featureMarkdown("First", "INV-001"));
    writeFileSync(join(projectDirectory, "second.md"), featureMarkdown("Second", "INV-002"));
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it("writes one AST per feature file, each carrying the model from the base file", () => {
    execFileSync("node", [cliPath, "bind-all", projectDirectory, "--dialect", dialectPath], {
      stdio: "pipe",
    });

    const firstAst = readAst(join(projectDirectory, "first.ast.json"));
    const secondAst = readAst(join(projectDirectory, "second.ast.json"));
    expect(Object.keys(firstAst.model)).toEqual(["Customer", "Invoice"]);
    expect(Object.keys(secondAst.model)).toEqual(["Customer", "Invoice"]);
    expect(firstAst.scenarios.map((scenario) => scenario.name)).toEqual(["First"]);
    expect(secondAst.scenarios.map((scenario) => scenario.name)).toEqual(["Second"]);
  });
});
