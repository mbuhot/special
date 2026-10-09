import { describe, expect, it } from "vitest";
import { lint } from "../src/index.js";
import invoicing from "../../../dialects/invoicing.ts";
import { bindSource, bindSuccess, DRAFT_INVOICE, lineOf, specWith } from "./helpers.js";

describe("shared surfaces", () => {
  it("resolves a shared control while another surface is open", () => {
    const source = specWith(
      "## Scenario: Navigating",
      ...DRAFT_INVOICE,
      'And Accounts clicks "Companies"',
      'And Accounts enters 3 into "Quantity"',
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.[3]?.args).toEqual({
      Actor: "Accounts",
      Surface: "Sidebar",
      Control: "Companies",
    });
    expect(steps?.[4]?.args).toEqual({
      Actor: "Accounts",
      Value: "3",
      Surface: "Invoice editor",
      Control: "Quantity",
    });
  });

  it("resolves a shared control when no surface is open", () => {
    const source = specWith(
      "## Scenario: Reading the shell",
      'Then Accounts sees "Accounts" in "Signed in as"',
    );
    const steps = bindSuccess(source).ast.scenarios[0]?.steps;
    expect(steps?.[0]?.args).toEqual({
      Actor: "Accounts",
      Text: "Accounts",
      Surface: "Sidebar",
      Control: "Signed in as",
    });
  });

  it("names the open surface when a control is on neither it nor a shared surface", () => {
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

  it("marks a surface shared in the AST when the spec lists it as shared", () => {
    const source = specWith(
      "## Surfaces",
      '- Archive (shared): button "Restore"',
      '- Sidebar (shared): link "Dashboard"',
      '- Invoice list: table "Invoices"',
    );
    const { surfaces } = bindSuccess(source).ast;
    expect(surfaces["Archive"]?.shared).toBe(true);
    expect(surfaces["Sidebar"]?.shared).toBe(true);
    expect(surfaces["Invoice list"]).not.toHaveProperty("shared");
  });

  it("warns about a listed shared control no step references", () => {
    const source = specWith(
      "## Surfaces",
      '- Sidebar (shared): link "Dashboard", link "Companies"',
      "## Scenario: Navigating",
      'When Accounts clicks "Companies"',
    );
    const warnings = lint(bindSuccess(source), invoicing).filter((warning) =>
      warning.message.startsWith("Control"),
    );
    expect(warnings).toEqual([
      {
        file: "spec.md",
        line: lineOf(source, "- Sidebar"),
        message: "Control Sidebar/Dashboard is not referenced by any step",
      },
    ]);
  });
});
