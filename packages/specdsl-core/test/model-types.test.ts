import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess, lineOf } from "./helpers.js";

function modelSpec(...lines: string[]): string {
  return ["# Test", "", "## Model", ...lines, ""].join("\n");
}

function errorsOf(source: string): { line: number; message: string }[] {
  const result = bindSource(source);
  return result.ok ? [] : result.errors.map(({ line, message }) => ({ line, message }));
}

describe("typed model fields", () => {
  const { ast } = bindSuccess(
    modelSpec(
      "- Contact: first name (text, required), email (email), phone. Belongs to Company.",
      "- Company: name (text, required), domain (url)",
      "- Activity: kind (one of note, call, email, meeting, required), occurred at (datetime, required), score (integer)",
    ),
  );

  it("records the type and requiredness of a typed field", () => {
    expect(ast.model["Contact"]?.fields).toEqual([
      { name: "first name", type: "text", required: true },
      { name: "email", type: "email" },
      { name: "phone" },
    ]);
  });

  it("records the values of an enum field", () => {
    expect(ast.model["Activity"]?.fields).toEqual([
      {
        name: "kind",
        type: "enum",
        values: ["note", "call", "email", "meeting"],
        required: true,
      },
      { name: "occurred at", type: "datetime", required: true },
      { name: "score", type: "integer" },
    ]);
  });

  it("reports an unknown type at the line of the field list", () => {
    const source = modelSpec("- Company: name (text), size (huge)");
    expect(errorsOf(source)).toEqual([
      {
        line: lineOf(source, "Company"),
        message:
          'Unknown field type "huge" for Company.size (expected text, email, phone, url, money, integer, decimal, date, datetime, boolean or one of a, b, c)',
      },
    ]);
  });
});

describe("named relations", () => {
  const { ast } = bindSuccess(
    modelSpec(
      "- User: email (email)",
      "- Contact: name (text)",
      "- Deal: name (text). Belongs to User as owner. Belongs to Contact. Has many Task as work.",
      "- Task: title (text)",
      "- Contact has many Deal as deals",
    ),
  );

  it("records the role a relation is given", () => {
    expect(ast.model["Deal"]?.relations).toEqual([
      { kind: "belongs-to", entity: "User", name: "owner" },
      { kind: "belongs-to", entity: "Contact", name: "contact" },
      { kind: "has-many", entity: "Task", name: "work" },
    ]);
  });

  it("names an unnamed relation after its entity", () => {
    expect(ast.model["Contact"]?.relations).toEqual([
      { kind: "has-many", entity: "Deal", name: "deals" },
    ]);
  });
});

describe("state machine fields", () => {
  it("types an undeclared state field as the enumeration of its states", () => {
    const { ast } = bindSuccess(
      modelSpec("- Invoice: number (text), status", "- Invoice.status: draft -> sent -> paid"),
    );
    expect(ast.model["Invoice"]?.fields).toContainEqual({
      name: "status",
      type: "enum",
      values: ["draft", "sent", "paid"],
    });
  });

  it("accepts a declared enumeration that matches the states", () => {
    const { ast } = bindSuccess(
      modelSpec(
        "- Invoice: status (one of paid, draft, sent, required)",
        "- Invoice.status: draft -> sent -> paid",
      ),
    );
    expect(ast.model["Invoice"]?.fields).toEqual([
      { name: "status", type: "enum", values: ["paid", "draft", "sent"], required: true },
    ]);
  });

  it("reports a declared enumeration that conflicts with the states", () => {
    const source = modelSpec(
      "- Invoice: status (one of draft, sent)",
      "- Invoice.status: draft -> sent -> paid",
    );
    expect(errorsOf(source)).toEqual([
      {
        line: lineOf(source, "Invoice.status"),
        message:
          "Invoice.status is declared as one of draft, sent but its states are one of draft, sent, paid",
      },
    ]);
  });

  it("reports a declared scalar type on a state field", () => {
    const source = modelSpec("- Invoice: status (text)", "- Invoice.status: draft -> sent");
    expect(errorsOf(source)).toEqual([
      {
        line: lineOf(source, "Invoice.status"),
        message: "Invoice.status is declared as text but its states are one of draft, sent",
      },
    ]);
  });
});
