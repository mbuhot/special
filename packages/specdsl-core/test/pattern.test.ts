import { describe, expect, it } from "vitest";
import { compilePattern } from "../src/index.js";

describe("pattern matching", () => {
  it("matches literal words regardless of case", () => {
    const match = compilePattern("time advances")("Time Advances");
    expect(match?.slots).toEqual({});
  });

  it("rejects text that differs from the literal words", () => {
    expect(compilePattern("time advances")("time stops")).toBeNull();
  });

  it("captures slot values and their namespaces", () => {
    const match = compilePattern("<Actor> opens <Surface>")("Accounts opens Invoice editor");
    expect(match?.slots).toEqual({ Actor: "Accounts", Surface: "Invoice editor" });
    expect(match?.kinds["Surface"]?.namespace).toBe("Surface");
  });

  it("records the kind constraint of a constrained slot", () => {
    const match = compilePattern('<Actor> enters <Value> into "<Control:field>"')(
      'Accounts enters 3 into "Quantity"',
    );
    expect(match?.slots).toEqual({ Actor: "Accounts", Value: "3", Control: "Quantity" });
    expect(match?.kinds["Control"]?.constraint).toBe("field");
  });

  it("captures the kind of a kind-capturing slot", () => {
    const match = compilePattern('<Surface>: <Control.kind> "<Control>"')(
      'Invoice list: table "Invoices"',
    );
    expect(match?.slots).toEqual({
      Surface: "Invoice list",
      "Control.kind": "table",
      Control: "Invoices",
    });
    expect(match?.kinds["Control.kind"]?.capture).toBe("kind");
  });

  it("requires double quotes around a quoted slot", () => {
    const matcher = compilePattern('<Actor> clicks "<Control>"');
    expect(matcher('Accounts clicks "Send"')?.slots).toEqual({
      Actor: "Accounts",
      Control: "Send",
    });
    expect(matcher("Accounts clicks Send")).toBeNull();
  });

  it("matches without an optional group and reports it absent", () => {
    const match = compilePattern("<Actor> opens <Surface> [for <Ref>]")(
      "Accounts opens Invoice editor",
    );
    expect(match?.slots).toEqual({ Actor: "Accounts", Surface: "Invoice editor" });
    expect(match?.optionals).toEqual([false]);
  });

  it("matches with an optional group and reports it present", () => {
    const match = compilePattern("<Actor> opens <Surface> [for <Ref>]")(
      "Accounts opens Invoice editor for INV-001",
    );
    expect(match?.slots).toEqual({ Actor: "Accounts", Surface: "Invoice editor", Ref: "INV-001" });
    expect(match?.optionals).toEqual([true]);
  });

  it("collects a comma separated repeat as pairs", () => {
    const matcher = compilePattern('<Entity> "<Ref>" [with <Field> <Value>, ...]');
    const match = matcher('Invoice "INV-001" with status draft, customer Acme');
    expect(match?.slots).toEqual({ Entity: "Invoice", Ref: "INV-001" });
    expect(match?.pairs).toEqual([
      ["status", "draft"],
      ["customer", "Acme"],
    ]);
  });

  it("yields no pairs when the repeat group is absent", () => {
    const match = compilePattern('<Entity> "<Ref>" [with <Field> <Value>, ...]')('Customer "Acme"');
    expect(match?.pairs).toEqual([]);
  });

  it("collects a repeated single slot as a list", () => {
    const match = compilePattern("<Entity>: <Field>, ...")(
      "LineItem: description, quantity, unit price",
    );
    expect(match?.slots).toEqual({ Entity: "LineItem" });
    expect(match?.lists["Field"]).toEqual(["description", "quantity", "unit price"]);
  });

  it("collects arrow separated chains inside a comma separated repeat", () => {
    const match = compilePattern("<Entity>.<Field>: <State> -> ..., ...")(
      "Invoice.status: draft -> sent -> paid, draft -> void",
    );
    expect(match?.slots).toEqual({ Entity: "Invoice", Field: "status" });
    expect(match?.lists["State"]).toEqual([
      ["draft", "sent", "paid"],
      ["draft", "void"],
    ]);
  });

  it("accepts the values of an inline enumeration", () => {
    const matcher = compilePattern("switch <Mode=on|off>");
    expect(matcher("switch ON")?.slots).toEqual({ Mode: "ON" });
    expect(matcher("switch maybe")).toBeNull();
  });

  it.each(["Given", "When", "Then", "And", "But"])("ignores a leading %s", (keyword) => {
    const match = compilePattern("<Actor> opens <Surface>")(
      `${keyword} Accounts opens Invoice list`,
    );
    expect(match?.slots).toEqual({ Actor: "Accounts", Surface: "Invoice list" });
  });
});

describe("pattern matching against declared names", () => {
  const lexicon = {
    names: (namespace: string): string[] =>
      ({
        Field: ["quantity", "unit price", "unit"],
        Surface: ["Invoice editor", "Invoice list"],
      })[namespace] ?? [],
  };

  it("matches a multi-word declared name in a pairs repeat", () => {
    const matcher = compilePattern('<Entity> "<Ref>" [with <Field> <Value>, ...]');
    const match = matcher('LineItem "Consulting" with quantity 1, unit price 100', lexicon);
    expect(match?.pairs).toEqual([
      ["quantity", "1"],
      ["unit price", "100"],
    ]);
  });

  it("prefers the longest declared name at a position", () => {
    const match = compilePattern("<Field> <Value>")("unit price 100", lexicon);
    expect(match?.slots).toEqual({ Field: "unit price", Value: "100" });
  });

  it("matches a two-word declared surface before an optional group", () => {
    const matcher = compilePattern("<Actor> opens <Surface> [for <Ref>]");
    const match = matcher("Accounts opens Invoice editor for INV-001", lexicon);
    expect(match?.slots).toEqual({ Actor: "Accounts", Surface: "Invoice editor", Ref: "INV-001" });
  });

  it("keeps quoted slots as written inside quotes", () => {
    const match = compilePattern('<Field> "<Ref>"')('unit price "A B"', lexicon);
    expect(match?.slots).toEqual({ Field: "unit price", Ref: "A B" });
  });
});

describe("pattern matching parenthesised annotations", () => {
  const fieldList = compilePattern("<Entity>: <Field> [(<Type>)], ...");

  it("captures each field with its annotation and a blank for an unannotated field", () => {
    const match = fieldList("Contact: first name (text, required), email, phone (phone)");
    expect(match?.slots).toEqual({ Entity: "Contact" });
    expect(match?.lists["Field"]).toEqual(["first name", "email", "phone"]);
    expect(match?.lists["Type"]).toEqual(["text, required", "", "phone"]);
  });

  it("keeps the commas of an annotation inside it", () => {
    const match = fieldList("Activity: kind (one of note, call, meeting, required), body");
    expect(match?.lists["Field"]).toEqual(["kind", "body"]);
    expect(match?.lists["Type"]).toEqual(["one of note, call, meeting, required", ""]);
  });

  it("matches a literal parenthesised word in a pattern", () => {
    const match = compilePattern('<Surface>[ (shared)]: <Control.kind> "<Control>"')(
      'Sidebar (shared): link "Home"',
    );
    expect(match?.slots["Surface"]).toBe("Sidebar");
    expect(match?.optionals).toEqual([true]);
  });
});
