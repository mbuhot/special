import { expect, test } from "@playwright/test";
import type { SpecAst } from "@special/specdsl-core";
import { applyEffects } from "./records.js";
import type { Records } from "./records.js";

const spec: SpecAst = {
  dialect: { name: "", version: "", stepIds: [] },
  contexts: {},
  actors: {},
  surfaces: {},
  policies: {},
  invariants: [],
  derived: { predicates: [], counts: [] },
  scenarios: [],
  model: {
    Company: { fields: [{ name: "name" }], relations: [], machines: {} },
    Contact: {
      fields: [{ name: "name" }],
      relations: [{ kind: "belongs-to", entity: "Company", name: "company" }],
      machines: {},
    },
    Activity: {
      fields: [{ name: "kind" }, { name: "body", type: "text", required: true }],
      relations: [{ kind: "belongs-to", entity: "Contact", name: "contact" }],
      machines: {},
    },
    Invoice: {
      fields: [{ name: "number" }],
      relations: [{ kind: "belongs-to", entity: "Company", name: "company" }],
      machines: {
        status: { states: ["sent", "paid"], transitions: [{ from: "sent", to: "paid" }] },
      },
    },
  },
  effects: [
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
      file: "",
      line: 0,
    },
  ],
};

const records = (): Records =>
  new Map([
    ["Acme", { entity: "Company", fields: new Map() }],
    ["Ada", { entity: "Contact", fields: new Map([["company", "Acme"]]) }],
    [
      "INV-001",
      {
        entity: "Invoice",
        fields: new Map([
          ["number", "INV-001"],
          ["company", "Acme"],
          ["status", "paid"],
        ]),
      },
    ],
  ]);

const context = { now: "2026-01-15T09:00:00.000Z" };

test("logs a note on the company's first contact when an invoice is marked paid", () => {
  const held = records();
  applyEffects(spec, held, "INV-001", "paid", context);
  const note = held.get("Invoice INV-001 paid");
  expect(note?.entity).toBe("Activity");
  expect(note?.fields.get("kind")).toBe("note");
  expect(note?.fields.get("contact")).toBe("Ada");
});

test("does nothing for a state no effect is declared on", () => {
  const held = records();
  applyEffects(spec, held, "INV-001", "sent", context);
  expect(held.size).toBe(3);
});

test("does nothing when the company has no contact", () => {
  const held = records();
  held.delete("Ada");
  applyEffects(spec, held, "INV-001", "paid", context);
  expect(held.size).toBe(2);
});
