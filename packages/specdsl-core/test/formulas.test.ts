import { describe, expect, it } from "vitest";
import {
  computationOrder,
  evaluateFormula,
  holds,
  policyActions,
  policyScope,
} from "../src/index.js";
import type { FormulaNode, InvariantNode } from "../src/index.js";
import { bindSource, bindSuccess } from "./helpers.js";

const MODEL = [
  "# Test",
  "",
  "## Model",
  "- Invoice: number, gst rate (decimal), prices (one of exclude gst, include gst), taxable (money), subtotal (money), gst (money), total (money). Has many LineItem.",
  "- LineItem: quantity (integer), unit price (money), tax code (one of gst, gst-free, exempt), total (money). Belongs to Invoice.",
  "- User: name, role",
  "- Task: title, status, estimate (integer). Belongs to User as assignee.",
  "- Task.status: open -> done",
  "",
  "## Policies",
  "- Invoice: admin may read",
  "- Task: sales may read, create",
  "- Task: admin may read",
  "",
];

const GST_FORMULAS = [
  "- LineItem.total = quantity \\* unit price",
  "- Invoice.taxable = sum of LineItem.total where tax code is gst",
  "- Invoice.gst = taxable \\* gst rate / 100 when prices is exclude gst",
  "- Invoice.gst = taxable \\* gst rate / (100 + gst rate) when prices is include gst",
  "- Invoice.subtotal = sum of LineItem.total when prices is exclude gst",
  "- Invoice.subtotal = sum of LineItem.total - gst when prices is include gst",
  "- Invoice.total = subtotal + gst",
];

const withSection = (heading: string, ...lines: string[]) =>
  [...MODEL, `## ${heading}`, ...lines, ""].join("\n");

const invariantsOf = (...lines: string[]) =>
  bindSuccess(withSection("Invariants", ...lines)).ast.invariants;

const errorsOf = (heading: string, ...lines: string[]) => {
  const result = bindSource(withSection(heading, ...lines));
  return result.ok ? [] : result.errors.map((error) => error.message);
};

const field = (name: string): FormulaNode => ({ op: "field", field: name });

describe("formula invariants", () => {
  it("binds the GST formulas of an invoice with their conditions", () => {
    const invariants = invariantsOf(...GST_FORMULAS);
    expect(invariants.filter((invariant) => invariant.kind === "formula")).toHaveLength(6);
    expect(invariants[2]).toMatchObject({
      kind: "formula",
      entity: "Invoice",
      field: "gst",
      expression: {
        op: "/",
        left: { op: "*", left: field("taxable"), right: field("gst rate") },
        right: { op: "number", value: 100 },
      },
      when: { op: "is", field: "prices", value: "exclude gst" },
    });
  });

  it("records a filtered sum with its condition over the target", () => {
    expect(invariantsOf(...GST_FORMULAS)[1]).toMatchObject({
      kind: "formula",
      field: "taxable",
      expression: {
        op: "sum",
        relation: "line_item",
        target: "LineItem",
        field: "total",
        where: { op: "is", field: "tax code", value: "gst" },
      },
    });
  });

  it("parses parentheses and gives multiplication precedence over addition", () => {
    const [invariant] = invariantsOf("- Invoice.total = subtotal + gst \\* 2 - (gst + 1)");
    expect(invariant).toMatchObject({
      expression: {
        op: "-",
        left: {
          op: "+",
          left: field("subtotal"),
          right: { op: "*", left: field("gst"), right: { op: "number", value: 2 } },
        },
        right: { op: "+", left: field("gst"), right: { op: "number", value: 1 } },
      },
    });
  });

  it("keeps the product shape for a plain product", () => {
    expect(invariantsOf("- LineItem.total = quantity \\* unit price")[0]?.kind).toBe("product");
  });

  it("rejects two unconditional lines for one field", () => {
    expect(
      errorsOf("Invariants", "- Invoice.total = subtotal + gst", "- Invoice.total = gst"),
    ).toEqual(["Invoice.total is already computed by spec.md:16"]);
  });

  it("rejects a dependency cycle between computed fields", () => {
    expect(errorsOf("Invariants", "- Invoice.gst = total", "- Invoice.total = gst")).toEqual([
      "Invoice.total -> Invoice.gst is a dependency cycle",
    ]);
  });

  it("rejects an unknown field in an expression", () => {
    expect(errorsOf("Invariants", "- Invoice.total = subtotal + tip")).toEqual([
      'Unknown Field "tip" of Invoice',
    ]);
  });

  it("rejects a non-numeric field in an expression", () => {
    expect(errorsOf("Invariants", "- LineItem.total = tax code + quantity")).toEqual([
      "LineItem.tax code is not a number and cannot be used in a formula",
    ]);
  });

  it("rejects a sum over a child the entity does not have", () => {
    expect(errorsOf("Invariants", "- Invoice.total = sum of Task.estimate")).toEqual([
      "Invoice has no has-many Task relation",
    ]);
  });

  it("rejects an unbalanced expression", () => {
    expect(errorsOf("Invariants", "- Invoice.total = (subtotal + gst")).toEqual([
      'Unrecognized expression "("',
    ]);
  });
});

describe("formula evaluation", () => {
  const invariants = invariantsOf(...GST_FORMULAS);

  it("orders computed fields after the fields they read", () => {
    const order = computationOrder([...invariants].reverse()).map(
      (invariant) => `${invariant.entity}.${invariant.field}`,
    );
    expect(order.indexOf("Invoice.total")).toBeGreaterThan(order.indexOf("Invoice.gst"));
    expect(order.indexOf("Invoice.gst")).toBeGreaterThan(order.indexOf("Invoice.taxable"));
    expect(order.indexOf("Invoice.taxable")).toBeGreaterThan(order.indexOf("LineItem.total"));
  });

  it("evaluates arithmetic over scope values", () => {
    const [, , gst] = invariants as [
      InvariantNode,
      InvariantNode,
      Extract<InvariantNode, { kind: "formula" }>,
    ];
    const values: Record<string, number> = { taxable: 200, "gst rate": 10 };
    const scope = { field: (name: string) => values[name] ?? 0, sum: () => 0 };
    expect(evaluateFormula(gst.expression, scope)).toBe(20);
  });

  it("is undefined when dividing by zero", () => {
    const scope = { field: () => 0, sum: () => 0 };
    expect(
      evaluateFormula({ op: "/", left: { op: "number", value: 1 }, right: field("x") }, scope),
    ).toBeUndefined();
  });
});

describe("numeric comparisons in Derived", () => {
  it("records above and below with numeric values", () => {
    const { ast } = bindSuccess(
      withSection(
        "Derived",
        "- Invoice is tax invoice when gst is above 0",
        "- Invoice is small when total is below 99.5",
      ),
    );
    expect(ast.derived.predicates.map((predicate) => predicate.condition)).toEqual([
      { op: "above", field: "gst", value: 0 },
      { op: "below", field: "total", value: 99.5 },
    ]);
  });

  it("rejects a comparison on a field that is not a number", () => {
    expect(errorsOf("Derived", "- Task is big when status is above 3")).toEqual([
      "Task.status is not a number and cannot be compared with above",
    ]);
  });

  it("rejects a non-numeric comparison value", () => {
    expect(errorsOf("Derived", "- Invoice is tax invoice when gst is above lots")).toEqual([
      '"lots" is not a number for Invoice.gst',
    ]);
  });

  it("holds when the amount is above the value", () => {
    const condition = { op: "above", field: "gst", value: 0 } as const;
    expect(holds(condition, { gst: "10.5" }, "2026-01-15")).toBe(true);
    expect(holds(condition, { gst: "0" }, "2026-01-15")).toBe(false);
    expect(holds(condition, {}, "2026-01-15")).toBe(false);
  });

  it("holds when the amount is below the value", () => {
    const condition = { op: "below", field: "total", value: 100 } as const;
    expect(holds(condition, { total: "$99.99" }, "2026-01-15")).toBe(true);
    expect(holds(condition, { total: "100" }, "2026-01-15")).toBe(false);
  });
});

describe("read scope", () => {
  const MINE = "- Task is mine when assignee is me";

  it("records an is-me condition on a belongs-to User relation", () => {
    const { ast } = bindSuccess(withSection("Derived", MINE));
    expect(ast.derived.predicates[0]?.condition).toEqual({ op: "is me", field: "assignee" });
  });

  it("holds only for the signed-in user", () => {
    const condition = { op: "is me", field: "assignee" } as const;
    expect(holds(condition, { assignee: "Sam" }, "2026-01-15", "Sam")).toBe(true);
    expect(holds(condition, { assignee: "Sam" }, "2026-01-15", "Morgan")).toBe(false);
    expect(holds(condition, { assignee: "Sam" }, "2026-01-15")).toBe(false);
  });

  it("rejects me on a relation to another entity", () => {
    expect(errorsOf("Derived", "- LineItem is mine when invoice is me")).toEqual([
      "LineItem.invoice is a relation and cannot be compared",
    ]);
  });

  it("scopes a role's reads to a predicate while keeping its other actions", () => {
    const source = [
      ...MODEL.slice(0, -1),
      "- Task: sales may read only mine",
      "",
      "## Derived",
      MINE,
      "",
    ].join("\n");
    const { ast } = bindSuccess(source);
    const sales = ast.policies["Task"]?.["sales"];
    expect(sales).toEqual({ actions: ["read", "create"], scope: "mine" });
    expect(policyActions(sales)).toEqual(["read", "create"]);
    expect(policyScope(sales)).toBe("mine");
    expect(ast.policies["Task"]?.["admin"]).toEqual(["read"]);
  });

  it("rejects a scope naming a predicate the entity does not declare", () => {
    const source = [...MODEL.slice(0, -1), "- Task: sales may read only mine", ""].join("\n");
    const result = bindSource(source);
    expect(!result.ok && result.errors.map((error) => error.message)).toEqual([
      'Unknown Predicate "mine"',
    ]);
  });
});
