import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess } from "./helpers.js";

const MODEL = [
  "# Test",
  "",
  "## Model",
  "- Company: name",
  "- Contact: name. Belongs to Company.",
  "- Deal: name, stage. Belongs to Company. Belongs to Contact.",
  "- Deal.stage: lead -> qualified -> won",
  "- Invoice: number, status, total. Belongs to Company. Has many LineItem.",
  "- Invoice.status: draft -> sent -> paid",
  "- LineItem: quantity (integer), unit price (money), total (money). Belongs to Invoice.",
  "",
  "## Policies",
  "- Invoice: admin may read, send, mark paid",
  "- Deal: admin may qualify, win",
  "",
];

const withInvariants = (...lines: string[]) => [...MODEL, "## Invariants", ...lines, ""].join("\n");

const invariantsOf = (...lines: string[]) => bindSuccess(withInvariants(...lines)).ast.invariants;

const errorsOf = (...lines: string[]) => {
  const result = bindSource(withInvariants(...lines));
  return result.ok ? [] : result.errors.map((error) => error.message);
};

describe("invariants", () => {
  it("emits no invariants when the spec has no Invariants section", () => {
    expect(bindSuccess(MODEL.join("\n")).ast.invariants).toEqual([]);
  });

  it("records a product invariant with its operand fields", () => {
    expect(invariantsOf("- LineItem.total = quantity * unit price")).toEqual([
      {
        kind: "product",
        entity: "LineItem",
        field: "total",
        left: "quantity",
        right: "unit price",
        file: "spec.md",
        line: 17,
      },
    ]);
  });

  it("reads a Markdown-escaped operator as the operator itself", () => {
    expect(invariantsOf("- LineItem.total = quantity \\* unit price")).toEqual(
      invariantsOf("- LineItem.total = quantity * unit price"),
    );
  });

  it("records a sum invariant over a has-many relation", () => {
    expect(invariantsOf("- Invoice.total = sum of LineItem.total")).toEqual([
      {
        kind: "sum",
        entity: "Invoice",
        field: "total",
        relation: "line_item",
        target: "LineItem",
        targetField: "total",
        file: "spec.md",
        line: 17,
      },
    ]);
  });

  it("records a unique invariant", () => {
    expect(invariantsOf("- Invoice.number is unique")).toMatchObject([
      { kind: "unique", entity: "Invoice", field: "number" },
    ]);
  });

  it("records a frozen-except invariant with actions resolved in the entity's actions", () => {
    expect(invariantsOf("- Invoice.status only changes through send, mark paid")).toMatchObject([
      { kind: "frozen-except", entity: "Invoice", field: "status", actions: ["send", "mark paid"] },
    ]);
  });

  it("records a same-parent invariant with both parent relations", () => {
    expect(invariantsOf("- Deal belongs to the same Company as its contact")).toMatchObject([
      {
        kind: "same-parent",
        entity: "Deal",
        target: "Company",
        relation: "contact",
        parent: "company",
        relationEntity: "Contact",
        relationParent: "company",
      },
    ]);
  });

  it("records a sequence invariant with its prefix and width", () => {
    expect(
      invariantsOf(
        '- Invoice.number is assigned on creation as "INV-" followed by a 3 digit sequence',
      ),
    ).toMatchObject([
      { kind: "sequence", entity: "Invoice", field: "number", prefix: "INV-", width: 3 },
    ]);
  });

  it("rejects a line that matches no invariant shape, naming the line", () => {
    const result = bindSource(withInvariants("- Invoice.number is lovely"));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      {
        file: "spec.md",
        line: 17,
        message: 'Unrecognized Invariants item "Invoice.number is lovely"',
      },
    ]);
  });

  it("rejects a field the entity does not declare", () => {
    expect(errorsOf("- Invoice.colour is unique")).toEqual(['Unknown Field "colour" of Invoice']);
  });

  it("rejects an action no policy declares for the entity", () => {
    expect(errorsOf("- Invoice.status only changes through void")).toEqual([
      'Unknown Action "void" of Invoice; declare it in Policies',
    ]);
  });

  it("rejects a sum over an entity that is not a has-many of the summing entity", () => {
    expect(errorsOf("- Deal.name = sum of LineItem.total")).toEqual([
      "Deal has no has-many LineItem relation",
    ]);
  });

  it("rejects a same-parent line whose entity does not belong to the target", () => {
    expect(errorsOf("- LineItem belongs to the same Company as its invoice")).toEqual([
      "LineItem does not belong to Company",
    ]);
  });

  it("rejects a sequence with a non-numeric width", () => {
    expect(
      errorsOf(
        '- Invoice.number is assigned on creation as "INV-" followed by a many digit sequence',
      ),
    ).toEqual(['"many" is not a digit count']);
  });
});
