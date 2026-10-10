import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  bindSource,
  bindSourcesSuccess,
  bindSuccess,
  DRAFT_INVOICE,
  lineOf,
  specWith,
} from "./helpers.js";
import { baseSourcesFor, type SpecSource } from "../src/index.js";

const INVOICING_FEATURE_FILES = [
  "invoicing/line-totals.md",
  "invoicing/sending.md",
  "invoicing/settling.md",
  "invoicing/invoice-list.md",
];

function readSpecSource(name: string): SpecSource {
  return {
    file: `specs/${name}`,
    markdown: readFileSync(new URL(`../../../specs/${name}`, import.meta.url), "utf8"),
  };
}

const invoicingBaseSources = baseSourcesFor(
  fileURLToPath(new URL("../../../specs/invoicing", import.meta.url)),
);
const invoicingSources = [...invoicingBaseSources, ...INVOICING_FEATURE_FILES.map(readSpecSource)];
const lineTotalsSource = readSpecSource("invoicing/line-totals.md");

describe("binding the invoicing spec", () => {
  const { ast } = bindSourcesSuccess(...invoicingSources);

  it("produces one scenario per Scenario section", () => {
    const names = ast.scenarios.map((scenario) => scenario.name);
    expect(names).toContain("Line total updates as quantity changes");
    expect(names).toContain("Sending a draft invoice marks it sent");
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves each scenario line to its step", () => {
    expect(ast.scenarios[0]?.steps.map((entry) => entry.id)).toEqual([
      "given-entity",
      "given-entity",
      "given-entity",
      "opens",
      "narrate",
      "sees",
      "narrate",
      "enters",
      "narrate",
      "sees",
      "narrate",
      "enters",
      "narrate",
      "sees",
      "narrate",
    ]);
  });

  it("records the scenario source line", () => {
    expect(ast.scenarios[0]?.source).toEqual({
      file: lineTotalsSource.file,
      line: lineOf(lineTotalsSource.markdown, "## Scenario: Line total"),
    });
  });

  it("captures entity declarations with their field pairs", () => {
    expect(ast.scenarios[0]?.steps[1]).toEqual({
      id: "given-entity",
      line: lineOf(lineTotalsSource.markdown, 'Given an Invoice "INV-001"'),
      args: {
        Entity: "Invoice",
        Ref: "INV-001",
        pairs: [
          ["status", "draft"],
          ["company", "Acme"],
        ],
      },
    });
  });

  it("binds the slots of a step into arguments", () => {
    expect(ast.scenarios[0]?.steps[3]).toEqual({
      id: "opens",
      line: lineOf(lineTotalsSource.markdown, "When Accounts opens Invoice editor"),
      args: { Actor: "Accounts", Surface: "Invoice editor", Ref: "INV-001" },
    });
  });

  it("carries a Narrate item as demo-only narration text", () => {
    expect(ast.scenarios[0]?.steps[14]).toEqual({
      id: "narrate",
      line: lineOf(
        lineTotalsSource.markdown,
        "Narrate: The totals region updates to one hundred and fifty",
      ),
      text: "The totals region updates to one hundred and fifty. The total follows the quantity and the unit price.",
      modes: ["demo"],
    });
  });

  it("emits actors and the surfaces the spec uses", () => {
    expect(ast.actors).toEqual({
      "Sales rep": { Role: "sales", extra: {} },
      "Sales manager": { Role: "manager", extra: {} },
      Accounts: { Role: "accountant", extra: {} },
      Admin: { Role: "admin", extra: {} },
    });
    expect(ast.surfaces["Invoice editor"]?.route).toBe("/invoices/{id}/edit");
    const quantity = ast.surfaces["Invoice editor"]?.controls["Quantity"];
    expect(quantity?.kind).toBe("field");
    expect(Object.keys(quantity?.locators ?? {}).sort()).toEqual(["css", "form", "lv"]);
  });

  it("emits each Model entity with its fields and relations", () => {
    expect(ast.model["Invoice"]).toMatchObject({
      fields: [
        { name: "number", type: "text", required: true },
        { name: "status", type: "enum", values: ["draft", "sent", "paid", "void"] },
        { name: "issue date", type: "date", required: true },
        { name: "due date", type: "date" },
        { name: "notes", type: "text" },
        { name: "total", type: "money" },
      ],
      relations: [
        { kind: "belongs-to", entity: "Company", name: "company" },
        { kind: "has-many", entity: "LineItem", name: "line_item" },
      ],
    });
    expect(ast.model["LineItem"]).toMatchObject({
      fields: [
        { name: "description", type: "text", required: true },
        { name: "quantity", type: "integer", required: true },
        { name: "unit price", type: "money", required: true },
        { name: "total", type: "money" },
      ],
      relations: [{ kind: "belongs-to", entity: "Invoice", name: "invoice" }],
    });
    expect(ast.model["Company"]).toEqual({
      fields: [
        { name: "name", type: "text", required: true },
        { name: "domain", type: "url" },
        { name: "industry", type: "text" },
      ],
      relations: [
        { kind: "has-many", entity: "Contact", name: "contact" },
        { kind: "has-many", entity: "Invoice", name: "invoice" },
      ],
      machines: {},
    });
  });

  it("emits a state machine per transition line", () => {
    expect(ast.model["Invoice"]?.machines).toEqual({
      status: {
        states: ["draft", "sent", "paid", "void"],
        transitions: [
          { from: "draft", to: "sent" },
          { from: "sent", to: "paid" },
          { from: "draft", to: "void" },
        ],
      },
    });
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
    const source = specWith("## Scenario: Gibberish", "Then the moon wanes");
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "the moon"),
          message: 'No step matches "Then the moon wanes"',
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
    const { ast } = bindSourcesSuccess(...invoicingSources);
    expect(Object.keys(ast.surfaces["Login"]?.controls ?? {})).toEqual(["Email", "Log in"]);
    expect(ast.surfaces["Login"]?.controls["Email"]?.locators).toEqual({
      css: "#login-email",
      lv: "login[email]",
      form: "#login-form",
    });
  });
});

describe("surfaces declared only by the spec", () => {
  const source = specWith(
    "## Surfaces",
    '- Archive: field "Search", button "Restore"',
    "",
    "## Scenario: Restoring",
    "When Accounts opens Archive",
    'And Accounts clicks "Restore"',
  );

  it("includes a surface the spec declares that the dialect does not", () => {
    const { ast } = bindSuccess(source);
    expect(ast.surfaces["Archive"]).toEqual({
      controls: {
        Search: { kind: "field", locators: {} },
        Restore: { kind: "button", locators: {} },
      },
    });
  });

  it("binds a scenario that opens the surface and uses its control", () => {
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.map((entry) => entry.id)).toEqual(["opens", "clicks"]);
    expect(steps?.[1]?.args).toEqual({ Actor: "Accounts", Surface: "Archive", Control: "Restore" });
  });
});

describe("policies", () => {
  const POLICIES = [
    "## Policies",
    "- Invoice: admin may read, mark paid",
    "- Invoice: accountant may read",
    "- Invoice: admin may void",
    "",
  ];

  it("emits policies keyed by entity and role", () => {
    const { ast } = bindSuccess(specWith(...POLICIES));
    expect(ast.policies).toEqual({
      Invoice: { admin: ["read", "mark paid", "void"], accountant: ["read"] },
    });
  });

  it("resolves an action in the scope of the ref's entity", () => {
    const source = specWith(
      ...POLICIES,
      "## Scenario: Admin rights",
      ...DRAFT_INVOICE,
      "Then Accounts may mark paid INV-001",
    );
    const step = bindSuccess(source).ast.scenarios[0]?.steps[3];
    expect(step).toEqual({
      id: "may",
      line: lineOf(source, "Then Accounts may mark paid"),
      args: { Actor: "Accounts", Action: "mark paid", Ref: "INV-001" },
      modes: ["domain", "demo"],
    });
  });

  it("reports an action no policy declares for the entity", () => {
    const source = specWith(
      ...POLICIES,
      "## Scenario: Unknown right",
      ...DRAFT_INVOICE,
      "Then Accounts may archive INV-001",
    );
    expect(bindSource(source)).toEqual({
      ok: false,
      errors: [
        {
          file: "spec.md",
          line: lineOf(source, "Accounts may archive"),
          message: 'Unknown Action "archive" on Invoice',
        },
      ],
    });
  });

  it("distinguishes may not from may", () => {
    const source = specWith(
      ...POLICIES,
      "## Scenario: Denied",
      ...DRAFT_INVOICE,
      "Then Accounts may not void INV-001",
      "And Accounts may read INV-001",
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps.slice(3);
    expect(steps?.map((entry) => entry.id)).toEqual(["may-not", "may"]);
    expect(steps?.[0]).toMatchObject({
      args: { Actor: "Accounts", Action: "void", Ref: "INV-001" },
    });
  });
});

describe("binding a Story line", () => {
  const story = "Story: As the accountant, I need to review invoices, so that I stay in control.";

  it("records the story on the scenario without adding a step", () => {
    const source = specWith("## Scenario: Looking", story, ...DRAFT_INVOICE);
    const [scenario] = bindSuccess(source).ast.scenarios;
    expect(scenario?.story).toBe(
      "As the accountant, I need to review invoices, so that I stay in control.",
    );
    expect(scenario?.steps.map((entry) => entry.id)).toEqual([
      "given-entity",
      "given-entity",
      "opens",
    ]);
  });

  it("rejects a Story line that follows a step", () => {
    const source = specWith("## Scenario: Looking", ...DRAFT_INVOICE, story);
    const result = bindSource(source);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual([
      {
        file: "spec.md",
        line: lineOf(source, "Story:"),
        message: "Story must be the first line of a scenario",
      },
    ]);
  });
});

describe("actor names", () => {
  const withActors = (...lines: string[]) =>
    ["# Test", "", "## Model", "- Customer: name", "", "## Actors", ...lines, ""].join("\n");

  it("records an actor's declared name beside its role", () => {
    const result = bindSuccess(
      withActors("- Sales rep: role sales, named Sam Rivera", "- Accounts: role accountant"),
    );
    expect(result.ast.actors).toEqual({
      "Sales rep": { Role: "sales", Name: "Sam Rivera", extra: {} },
      Accounts: { Role: "accountant", extra: {} },
    });
  });
});
