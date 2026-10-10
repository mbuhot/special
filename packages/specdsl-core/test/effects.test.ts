import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess } from "./helpers.js";

const MODEL = [
  "# Test",
  "",
  "## Model",
  "- Company: name",
  "- Contact: name. Belongs to Company.",
  "- Activity: kind, body. Belongs to Contact.",
  "- Contact has many Activity",
  "- Invoice: number, status. Belongs to Company.",
  "- Invoice.status: draft -> sent -> paid, draft -> void",
  "",
  "## Policies",
  "- Invoice: admin may read, mark paid, void",
  "",
];

const EFFECT =
  '- When Invoice mark paid: create Activity for the first Contact of its company with kind "note", body "Invoice {number} paid"';

const withEffects = (...lines: string[]) => [...MODEL, "## Effects", ...lines, ""].join("\n");

const effectsOf = (...lines: string[]) => bindSuccess(withEffects(...lines)).ast.effects;

const errorsOf = (...lines: string[]) => {
  const result = bindSource(withEffects(...lines));
  return result.ok ? [] : result.errors.map((error) => error.message);
};

describe("effects", () => {
  it("emits no effects when the spec has no Effects section", () => {
    expect(bindSuccess(MODEL.join("\n")).ast.effects).toEqual([]);
  });

  it("records the transition, the owner reached through the relation and the values to set", () => {
    expect(effectsOf(EFFECT)).toEqual([
      {
        entity: "Invoice",
        action: "mark paid",
        field: "status",
        state: "paid",
        target: "Activity",
        owner: "Contact",
        relation: "company",
        ownerRelation: "company",
        targetRelation: "contact",
        values: [
          { field: "kind", value: "note" },
          { field: "body", value: "Invoice {number} paid" },
        ],
        file: "spec.md",
        line: 15,
      },
    ]);
  });

  it("rejects an action that does not name a state it moves to", () => {
    expect(errorsOf(EFFECT.replace("mark paid", "void").replace("void", "send"))).toEqual([
      'Unknown Action "send" of Invoice; declare it in Policies',
    ]);
  });

  it("rejects a relation the entity does not have", () => {
    expect(errorsOf(EFFECT.replace("its company", "its owner"))).toEqual([
      'Invoice has no belongs-to relation "owner"',
    ]);
  });

  it("rejects an owner that does not belong to the relation's entity", () => {
    expect(errorsOf(EFFECT.replace("first Contact", "first Activity"))).toContain(
      "Activity does not belong to Company",
    );
  });

  it("rejects a target that does not belong to the owner", () => {
    expect(errorsOf(EFFECT.replace("create Activity", "create Invoice"))).toContain(
      "Invoice does not belong to Contact",
    );
  });

  it("rejects a value for a field the target lacks", () => {
    expect(errorsOf(EFFECT.replace("kind", "colour"))).toEqual([
      'Unknown Field "colour" of Activity',
    ]);
  });

  it("rejects a placeholder that is not a field of the triggering entity", () => {
    expect(errorsOf(EFFECT.replace("{number}", "{colour}"))).toEqual([
      'Unknown Field "colour" of Invoice',
    ]);
  });

  it("rejects an effect line outside the closed shape", () => {
    expect(errorsOf("- Invoice mark paid logs a note")).toEqual([
      'Unrecognized Effects item "Invoice mark paid logs a note"',
    ]);
  });
});
