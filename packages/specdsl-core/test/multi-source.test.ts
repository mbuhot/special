import { describe, expect, it } from "vitest";
import { bindSources, bindSourcesSuccess, source } from "./helpers.js";

const BASE_FILE = "specs/base/invoicing.md";
const FEATURE_FILE = "specs/ticket-12.md";

const baseSpec = () =>
  source(
    BASE_FILE,
    "# Invoicing base",
    "",
    "## Model",
    "- Customer: name, email",
    "- Invoice: number, status, total. Belongs to Customer.",
    "- Invoice.status: draft -> sent -> paid",
    "",
    "## Surfaces",
    '- Archive: field "Search", button "Restore"',
    "",
    "## Actors",
    "- Accounts: role accountant",
    "",
    "## Policies",
    "- Invoice: accountant may read",
    "",
  );

const featureWith = (...lines: string[]) => source(FEATURE_FILE, "# Ticket 12", "", ...lines);

const restoringScenario = [
  "## Scenario: Restoring",
  "When Accounts opens Archive",
  'And Accounts clicks "Restore"',
];

describe("binding a feature spec against a base spec", () => {
  it("binds scenarios from a feature spec against a base spec's model", () => {
    const result = bindSourcesSuccess(baseSpec(), featureWith(...restoringScenario));
    expect(result.file).toBe(FEATURE_FILE);
    expect(Object.keys(result.ast.model)).toEqual(["Customer", "Invoice"]);
    expect(result.ast.actors["Accounts"]).toMatchObject({ Role: "accountant" });
    expect(result.ast.surfaces["Archive"]?.controls["Restore"]).toEqual({
      kind: "button",
      locators: {},
    });
    const [scenario] = result.ast.scenarios;
    expect(result.ast.scenarios).toHaveLength(1);
    expect(scenario?.name).toBe("Restoring");
    expect(scenario?.source).toEqual({ file: FEATURE_FILE, line: 3 });
    expect(scenario?.steps).toMatchObject([
      { id: "opens", line: 4, args: { Actor: "Accounts", Surface: "Archive" } },
      {
        id: "clicks",
        line: 5,
        args: { Actor: "Accounts", Surface: "Archive", Control: "Restore" },
      },
    ]);
  });

  it("attributes each scenario to the file that holds it", () => {
    const baseWithScenario = source(
      BASE_FILE,
      "## Model",
      "- Customer: name",
      "",
      "## Actors",
      "- Accounts: role accountant",
      "",
      "## Surfaces",
      '- Archive: field "Search", button "Restore"',
      "",
      ...restoringScenario,
    );
    const result = bindSourcesSuccess(
      baseWithScenario,
      featureWith("## Scenario: Restoring again", ...restoringScenario.slice(1)),
    );
    expect(result.ast.scenarios.map((scenario) => scenario.source.file)).toEqual([
      BASE_FILE,
      FEATURE_FILE,
    ]);
  });
});

describe("redeclaring across files", () => {
  it("rejects an entity the base already declares", () => {
    const result = bindSources(
      baseSpec(),
      featureWith("## Model", "- Invoice: reference", "", ...restoringScenario),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          file: FEATURE_FILE,
          line: 4,
          message: `Invoice is already declared in ${BASE_FILE}:5`,
        },
      ],
    });
  });

  it("rejects an actor the base already declares", () => {
    const result = bindSources(
      baseSpec(),
      featureWith("## Actors", "- Accounts: role admin", "", ...restoringScenario),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          file: FEATURE_FILE,
          line: 4,
          message: `Accounts is already declared in ${BASE_FILE}:12`,
        },
      ],
    });
  });

  it("rejects a surface an earlier file already lists", () => {
    const result = bindSources(
      baseSpec(),
      featureWith("## Surfaces", '- Archive: button "Purge"', "", ...restoringScenario),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          file: FEATURE_FILE,
          line: 4,
          message: `Archive is already declared in ${BASE_FILE}:9`,
        },
      ],
    });
  });

  it("rejects a duplicate scenario name across files", () => {
    const baseWithScenario = source(
      BASE_FILE,
      "## Actors",
      "- Accounts: role accountant",
      "",
      "## Surfaces",
      '- Archive: field "Search", button "Restore"',
      "",
      ...restoringScenario,
    );
    const result = bindSources(baseWithScenario, featureWith(...restoringScenario));
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          file: FEATURE_FILE,
          line: 3,
          message: `Scenario "Restoring" is already declared in ${BASE_FILE}:7`,
        },
      ],
    });
  });
});

describe("extending the base from a feature spec", () => {
  it("merges policy lines for the same entity and role across files", () => {
    const { ast } = bindSourcesSuccess(
      baseSpec(),
      featureWith("## Policies", "- Invoice: accountant may export", "- Invoice: admin may void"),
    );
    expect(ast.policies).toEqual({
      Invoice: { accountant: ["read", "export"], admin: ["void"] },
    });
  });

  it("a transition line in a feature spec extends the base machine", () => {
    const { ast } = bindSourcesSuccess(
      baseSpec(),
      featureWith("## Model", "- Invoice.status: draft -> void", "", ...restoringScenario),
    );
    expect(ast.model["Invoice"]?.machines["status"]).toEqual({
      states: ["draft", "sent", "paid", "void"],
      transitions: [
        { from: "draft", to: "sent" },
        { from: "sent", to: "paid" },
        { from: "draft", to: "void" },
      ],
    });
  });
});
