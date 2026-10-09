import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpecAst } from "../src/index.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDirectory, "../bin/specdsl.js");
const dialectPath = resolve(testDirectory, "../../../dialects/invoicing.ts");

const sharedMarkdown = [
  "# Shared",
  "",
  "## Model",
  "",
  "- Customer: name, email.",
  "",
  "## Actors",
  "",
  "- Accounts: role accountant",
  "",
].join("\n");

const invoiceMarkdown = [
  "# Billing",
  "",
  "## Model",
  "",
  "- Invoice: number, status, total. Belongs to Customer.",
  "- Invoice.status: draft -> sent",
  "",
].join("\n");

const customerOnlyMarkdown = (scenarioName: string) =>
  ["# Shipping", "", `## Scenario: ${scenarioName}`, "", 'Given a Customer "Acme"', ""].join("\n");

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
  let specsRoot: string;

  beforeEach(() => {
    specsRoot = mkdtempSync(join(tmpdir(), "specdsl-tree-"));
    writeFileSync(join(specsRoot, "specdsl.json"), JSON.stringify({ dialect: dialectPath }));
    writeFileSync(join(specsRoot, "shared.md"), sharedMarkdown);
    mkdirSync(join(specsRoot, "billing"));
    writeFileSync(join(specsRoot, "billing", "model.md"), invoiceMarkdown);
    writeFileSync(join(specsRoot, "billing", "first.md"), featureMarkdown("First", "INV-001"));
    mkdirSync(join(specsRoot, "shipping"));
    writeFileSync(join(specsRoot, "shipping", "second.md"), customerOnlyMarkdown("Second"));
  });

  afterEach(() => {
    rmSync(specsRoot, { recursive: true, force: true });
  });

  it("writes an AST beside each feature file, each carrying the shared model", () => {
    execFileSync("node", [cliPath, "bind-all", specsRoot], { stdio: "pipe" });

    const billingAst = readAst(join(specsRoot, "billing", "first.ast.json"));
    const shippingAst = readAst(join(specsRoot, "shipping", "second.ast.json"));
    expect(Object.keys(billingAst.model)).toEqual(["Customer", "Invoice"]);
    expect(Object.keys(shippingAst.model)).toEqual(["Customer"]);
    expect(billingAst.scenarios.map((scenario) => scenario.name)).toEqual(["First"]);
    expect(shippingAst.scenarios.map((scenario) => scenario.name)).toEqual(["Second"]);
  });

  it("names each scenario's source file relative to the parent of the tree root", () => {
    execFileSync("node", [cliPath, "bind-all", specsRoot], { stdio: "pipe" });

    const billingAst = readAst(join(specsRoot, "billing", "first.ast.json"));
    expect(billingAst.scenarios.map((scenario) => scenario.source.file)).toEqual([
      join(basename(specsRoot), "billing", "first.md"),
    ]);
  });
});

describe("specdsl bind", () => {
  let specsRoot: string;

  beforeEach(() => {
    specsRoot = mkdtempSync(join(tmpdir(), "specdsl-tree-"));
    writeFileSync(join(specsRoot, "specdsl.json"), JSON.stringify({ dialect: dialectPath }));
    writeFileSync(join(specsRoot, "shared.md"), sharedMarkdown);
    writeFileSync(join(specsRoot, "feature.md"), customerOnlyMarkdown("Only"));
  });

  afterEach(() => {
    rmSync(specsRoot, { recursive: true, force: true });
  });

  it("binds a feature file against the tree's base files and dialect without flags", () => {
    const output = execFileSync("node", [cliPath, "bind", join(specsRoot, "feature.md")], {
      stdio: "pipe",
    });

    const ast = JSON.parse(output.toString()) as SpecAst;
    expect(Object.keys(ast.model)).toEqual(["Customer"]);
    expect(ast.scenarios.map((scenario) => scenario.name)).toEqual(["Only"]);
  });
});
