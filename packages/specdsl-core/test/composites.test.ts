import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess, lineOf, specWith } from "./helpers.js";

const STEPS = [
  "## Steps",
  "- <Actor> fills in <Invoice=Ref> [with quantity <Quantity=Value>] [and price <Price=Value>] means",
  "  - <Actor> opens Invoice editor for <Invoice>",
  '  - <Actor> enters <Quantity> into "Quantity"',
  '  - <Actor> enters <Price> into "Unit price"',
  '  - <Actor> clicks "Send"',
  "",
];

const GIVEN = [
  'Given a Customer "Acme"',
  'Given an Invoice "INV-001" with status draft, customer Acme',
];

function ids(source: string): (string | undefined)[] {
  return bindSuccess(source).ast.scenarios[0]?.steps.map((step) => step.id);
}

function composite(...lines: string[]): string {
  return specWith(...STEPS, "## Scenario: Drafting", ...GIVEN, ...lines);
}

describe("composite steps", () => {
  it("expands every child when all optional groups are given", () => {
    const steps = bindSuccess(
      composite("And Accounts fills in INV-001 with quantity 3 and price 9"),
    ).ast.scenarios[0]?.steps;
    expect(steps?.slice(2).map((step) => step.args)).toEqual([
      { Actor: "Accounts", Surface: "Invoice editor", Ref: "INV-001" },
      { Actor: "Accounts", Surface: "Invoice editor", Value: "3", Control: "Quantity" },
      { Actor: "Accounts", Surface: "Invoice editor", Value: "9", Control: "Unit price" },
      { Actor: "Accounts", Surface: "Invoice editor", Control: "Send" },
    ]);
  });

  it("drops children that mention an omitted optional slot", () => {
    const source = composite("And Accounts fills in INV-001 with quantity 3");
    expect(ids(source)).toHaveLength(2 + 3);
    const bare = composite("And Accounts fills in INV-001");
    expect(ids(bare)).toHaveLength(2 + 2);
  });

  it("places a narration after a composite step after its last child", () => {
    const source = composite(
      "And Accounts fills in INV-001 with quantity 3",
      "Narrate: The invoice is saved.",
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps ?? [];
    const last = steps[steps.length - 1];
    expect(last).toMatchObject({ id: "narrate", text: "The invoice is saved." });
    expect(steps[steps.length - 2]?.args).toMatchObject({ Control: "Send" });
  });

  it("speaks a narration inside a composite in place with its slots substituted", () => {
    const source = specWith(
      "## Steps",
      "- <Actor> starts an invoice with total <Total=Value> means",
      "  - <Actor> opens Invoice list",
      "  - Narrate: The invoice list is open.",
      '  - <Actor> clicks "New invoice"',
      "  - Narrate: Total <Total> is typed next.",
      "",
      "## Scenario: Starting",
      ...GIVEN,
      "And Accounts starts an invoice with total 42",
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps ?? [];
    expect(steps.slice(2).map((step) => step.id)).toEqual([
      "opens",
      "narrate",
      "clicks",
      "narrate",
    ]);
    expect(steps[5]).toMatchObject({ text: "Total 42 is typed next." });
  });

  it("rejects a composite header that matches a primitive step", () => {
    const source = specWith(
      "## Steps",
      "- <Actor> opens <Surface> means",
      "  - <Actor> opens Invoice list",
      "",
      "## Scenario: Collision",
      ...GIVEN,
    );
    const result = bindSource(source);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]?.line).toBe(lineOf(source, "opens <Surface> means"));
  });

  it("reports a failing child at the scenario line and the composite definition", () => {
    const source = specWith(
      "## Steps",
      "- <Actor> makes a mess means",
      "  - <Actor> opens Invoice list",
      '  - <Actor> clicks "Nonexistent"',
      "",
      "## Scenario: Broken",
      ...GIVEN,
      "And Accounts makes a mess",
    );
    const result = bindSource(source);
    expect(result.ok).toBe(false);
    const error = !result.ok ? result.errors[0] : undefined;
    expect(error?.line).toBe(lineOf(source, "And Accounts makes a mess"));
    expect(error?.message).toContain('Unknown Control "Nonexistent"');
    expect(error?.message).toContain(`spec.md:${lineOf(source, "makes a mess means")}`);
  });

  it("rejects a composite that uses itself", () => {
    const source = specWith(
      "## Steps",
      "- <Actor> loops means",
      "  - <Actor> loops",
      "",
      "## Scenario: Looping",
      ...GIVEN,
      "And Accounts loops",
    );
    const result = bindSource(source);
    expect(!result.ok && result.errors[0]?.message).toContain("expands recursively");
  });
});
