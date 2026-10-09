import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess, DRAFT_INVOICE, lineOf, specWith } from "./helpers.js";

const invoicingSpec = readFileSync(new URL("../../../specs/invoicing.md", import.meta.url), "utf8");

describe("binding the invoicing spec", () => {
  const { ast } = bindSuccess(invoicingSpec);

  it("produces one scenario per Scenario section", () => {
    expect(ast.scenarios.map((scenario) => scenario.name)).toEqual([
      "Line total updates as quantity changes",
      "Sending a draft invoice marks it sent",
    ]);
  });

  it("resolves each scenario line to its step", () => {
    expect(ast.scenarios.map((scenario) => scenario.steps.map((entry) => entry.id))).toEqual([
      [
        "given-entity",
        "given-entity",
        "given-entity",
        "opens",
        "sees",
        "enters",
        "sees",
        "narrate",
      ],
      ["given-entity", "given-entity", "opens", "clicks", "sees", "has-field", "narrate"],
    ]);
  });

  it("records the scenario source line", () => {
    expect(ast.scenarios[0]?.source).toEqual({
      file: "spec.md",
      line: lineOf(invoicingSpec, "## Scenario: Line total"),
    });
  });

  it("captures entity declarations with their field pairs", () => {
    expect(ast.scenarios[0]?.steps[1]).toEqual({
      id: "given-entity",
      line: lineOf(invoicingSpec, 'Given an Invoice "INV-001"'),
      args: {
        Entity: "Invoice",
        Ref: "INV-001",
        pairs: [
          ["status", "draft"],
          ["customer", "Acme"],
        ],
      },
    });
  });

  it("renders the narration template of a step", () => {
    expect(ast.scenarios[0]?.steps[3]).toEqual({
      id: "opens",
      line: lineOf(invoicingSpec, "When Accounts opens Invoice editor"),
      args: { Actor: "Accounts", Surface: "Invoice editor", Ref: "INV-001" },
      narrate: "Accounts opens the Invoice editor.",
    });
  });

  it("carries a Narrate item as demo-only narration text", () => {
    expect(ast.scenarios[0]?.steps[7]).toEqual({
      id: "narrate",
      line: lineOf(invoicingSpec, "Narrate: The line total"),
      text: "The line total updates as the quantity changes.",
      modes: ["demo"],
    });
  });

  it("emits actors and the surfaces the spec uses", () => {
    expect(ast.actors).toEqual({ Accounts: { Role: "accountant", extra: {} } });
    expect(ast.surfaces["Invoice editor"]?.route).toBe("/invoices/{id}/edit");
    const quantity = ast.surfaces["Invoice editor"]?.controls["Quantity"];
    expect(quantity?.kind).toBe("field");
    expect(Object.keys(quantity?.locators ?? {}).sort()).toEqual(["css", "form", "lv"]);
  });
});

describe("binding errors", () => {
  it("reports an unknown control at the line of the step", () => {
    const source = specWith(
      "## Scenario: Typo",
      ...DRAFT_INVOICE,
      'And Accounts enters 3 into "Qty"',
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, '"Qty"'),
          message: 'Unknown Control "Qty" on Invoice editor',
        },
      ],
    });
  });

  it("reports a control of the wrong kind", () => {
    const source = specWith(
      "## Scenario: Wrong kind",
      ...DRAFT_INVOICE,
      'And Accounts enters 3 into "Send"',
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, '"Send"'),
          message: 'Control "Send" is a button, expected field',
        },
      ],
    });
  });

  it("reports a Ref no earlier step in the scenario declared", () => {
    const source = specWith(
      "## Scenario: Missing ref",
      "When Accounts opens Invoice editor for INV-009",
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "INV-009"),
          message: 'Ref "INV-009" is not declared by an earlier step in this scenario',
        },
      ],
    });
  });

  it("reports a Ref declared only in another scenario", () => {
    const source = specWith(
      "## Scenario: Declares",
      ...DRAFT_INVOICE,
      "## Scenario: Uses",
      "When Accounts opens Invoice editor for INV-001",
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line:
            source.split("\n").lastIndexOf("When Accounts opens Invoice editor for INV-001") + 1,
          message: 'Ref "INV-001" is not declared by an earlier step in this scenario',
        },
      ],
    });
  });

  it("reports a state outside the declared state machine", () => {
    const source = specWith(
      "## Scenario: Bad state",
      'Given a Customer "Acme"',
      'Given an Invoice "INV-001" with status archived',
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "archived"),
          message: '"archived" is not a state of Invoice.status',
        },
      ],
    });
  });

  it("reports an unknown section heading", () => {
    const source = specWith("## Wishlist", "- more features");
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "## Wishlist"),
          message: 'Unknown section "Wishlist"',
        },
      ],
    });
  });

  it("reports a step no pattern matches", () => {
    const source = specWith("## Scenario: Gibberish", "Then the moon is full");
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "the moon"),
          message: 'No step matches "Then the moon is full"',
        },
      ],
    });
  });

  it("reports an unknown control listed in the Surfaces section", () => {
    const source = specWith("## Surfaces", '- Invoice editor: field "Qty"');
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, '"Qty"'),
          message: 'Unknown Control "Qty" on Invoice editor',
        },
      ],
    });
  });
});

describe("composite steps", () => {
  const source = specWith(
    "## Steps",
    "- <Actor> fills in the quantity <Quantity> means",
    "  - <Actor> opens Invoice editor",
    '  - <Actor> enters <Quantity> into "Quantity"',
    "",
    "## Scenario: Composite",
    'Given a Customer "Acme"',
    "When Accounts fills in the quantity 5",
  );

  it("expands into the child steps of the composite", () => {
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.map((entry) => entry.id)).toEqual(["given-entity", "opens", "enters"]);
  });

  it("substitutes the composite arguments into the child steps", () => {
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.[2]).toEqual({
      id: "enters",
      line: lineOf(source, "fills in the quantity 5"),
      args: { Actor: "Accounts", Value: "5", Surface: "Invoice editor", Control: "Quantity" },
      narrate: "Accounts enters 5 into Quantity.",
    });
  });
});

describe("controls and the open surface", () => {
  it("emits the open surface alongside the control", () => {
    const source = specWith(
      "## Scenario: Typing",
      ...DRAFT_INVOICE,
      'And Accounts enters 3 into "Quantity"',
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.[3]).toEqual({
      id: "enters",
      line: lineOf(source, '"Quantity"'),
      args: { Actor: "Accounts", Value: "3", Surface: "Invoice editor", Control: "Quantity" },
      narrate: "Accounts enters 3 into Quantity.",
    });
  });

  it("reports a control step before the actor opened any surface", () => {
    const source = specWith("## Scenario: Too early", 'Accounts enters 3 into "Quantity"');
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, '"Quantity"'),
          message: "No surface open for Accounts",
        },
      ],
    });
  });

  it("reports a control missing from the surface the actor has open", () => {
    const source = specWith(
      "## Scenario: Wrong page",
      "When Accounts opens Invoice list",
      'And Accounts enters 3 into "Quantity"',
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, '"Quantity"'),
          message: 'Unknown Control "Quantity" on Invoice list',
        },
      ],
    });
  });
});

describe("context section", () => {
  it("emits configured contexts", () => {
    const source = specWith("## Context", "- Clock: 2026-01-15T09:00:00Z");
    expect(bindSuccess(source).ast.contexts).toEqual({
      clock: { DateTime: "2026-01-15T09:00:00Z" },
    });
  });
});

describe("surfaces in the AST", () => {
  it("includes every surface the dialect declares", () => {
    const { ast } = bindSuccess(invoicingSpec);
    expect(Object.keys(ast.surfaces["Login"]?.controls ?? {})).toEqual(["Email", "Log in"]);
    expect(ast.surfaces["Login"]?.controls["Email"]?.locators).toEqual({
      css: "#login-email",
      lv: "login[email]",
      form: "#login-form",
    });
  });
});
