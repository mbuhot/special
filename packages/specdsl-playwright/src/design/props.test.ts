import { expect, test } from "@playwright/test";
import type { SpecAst } from "@special/specdsl-core";
import {
  applyRowFilters,
  buildListProps,
  buildNewProps,
  buildProps,
  listEntities,
} from "./props.js";
import type { GivenEntity } from "./props.js";
import { createRecord, editorEntity, roleOfActor, saveRecord } from "./records.js";

const spec = {
  actors: { "Sales rep": { Role: "sales", extra: {} }, Admin: { Role: "admin", extra: {} } },
  model: {
    Company: {
      fields: [{ name: "name", type: "text" }],
      relations: [{ kind: "has-many", entity: "Deal", name: "deal" }],
      machines: {},
    },
    Deal: {
      fields: [
        { name: "name", type: "text" },
        { name: "close date", type: "date" },
      ],
      relations: [{ kind: "belongs-to", entity: "Company", name: "company" }],
      machines: {
        stage: {
          states: ["lead", "won"],
          transitions: [{ from: "lead", to: "won" }],
        },
      },
    },
    Task: {
      fields: [
        { name: "title", type: "text" },
        { name: "due date", type: "date" },
      ],
      relations: [],
      machines: { status: { states: ["open", "done"], transitions: [] } },
    },
  },
  policies: {
    Deal: { sales: ["read", "create", "update"], admin: ["read", "create", "update", "win"] },
    Task: { sales: ["read"] },
  },
  invariants: [],
  derived: {
    predicates: [
      {
        entity: "Task",
        name: "overdue",
        condition: { op: "before", field: "due date", value: "today" },
        file: "",
        line: 0,
      },
    ],
    counts: [{ name: "Overdue tasks", entity: "Task", predicate: "overdue", file: "", line: 0 }],
  },
  surfaces: {},
  contexts: {},
  scenarios: [],
  dialect: { name: "", version: "", stepIds: [] },
} as unknown as SpecAst;

const records = () =>
  new Map<string, GivenEntity>([
    ["Acme", { entity: "Company", fields: new Map([["name", "Acme"]]) }],
    ["Globex", { entity: "Company", fields: new Map([["name", "Globex"]]) }],
    [
      "Big deal",
      {
        entity: "Deal",
        fields: new Map([
          ["stage", "lead"],
          ["company", "Acme"],
        ]),
      },
    ],
    [
      "Won deal",
      {
        entity: "Deal",
        fields: new Map([
          ["stage", "won"],
          ["company", "Globex"],
        ]),
      },
    ],
    [
      "Send proposal",
      {
        entity: "Task",
        fields: new Map([
          ["status", "open"],
          ["due date", "2026-01-10"],
        ]),
      },
    ],
  ]);

const TODAY = "2026-02-01";

test("record surface exposes permission flags of the viewer's role on the record and its rows", () => {
  const sales = buildProps(spec, records(), "Big deal", TODAY, "sales");
  expect((sales["deal"] as Record<string, unknown>)["canUpdate"]).toBe(true);
  expect((sales["deal"] as Record<string, unknown>)["canWin"]).toBe(false);
  const admin = buildProps(spec, records(), "Big deal", TODAY, "admin");
  expect((admin["deal"] as Record<string, unknown>)["canWin"]).toBe(true);
});

test("list rows carry permission flags and the list carries create flags", () => {
  const sales = buildListProps(spec, records(), ["Deal"], TODAY, "sales");
  expect((sales["deals"] as Record<string, unknown>[])[0]?.["canWin"]).toBe(false);
  expect(sales["canCreateDeal"]).toBe(true);
  const none = buildListProps(spec, records(), ["Task"], TODAY, "sales");
  expect(none["canCreateTask"]).toBe(false);
});

test("pressing save applies pending values and create builds a named record", () => {
  const store = records();
  saveRecord(spec, store, "Big deal", new Map([["closeDate", "2026-03-01"]]));
  expect(store.get("Big deal")?.fields.get("close date")).toBe("2026-03-01");
  const created = createRecord(
    spec,
    store,
    "Deal",
    new Map([
      ["name", "New deal"],
      ["company", "Acme"],
    ]),
  );
  expect(created).toBe("New deal");
  expect(store.get("New deal")?.fields.get("stage")).toBe("lead");
  expect(createRecord(spec, store, "Deal", new Map([["name", "New deal"]]))).toBe("New deal 2");
});

test("text filter matches any string field case-insensitively and defaults to matching", () => {
  const props = buildListProps(spec, records(), ["Deal"], TODAY, "sales");
  const rows = props["deals"] as Record<string, unknown>[];
  expect(rows.every((row) => row["matches"] === true)).toBe(true);
  const filtered = applyRowFilters(props, [{ prop: "deals", kind: "text", text: "BIG" }]);
  expect((filtered["deals"] as Record<string, unknown>[]).map((row) => row["matches"])).toEqual([
    true,
    false,
  ]);
});

test("select filter matches by equality on the field, combined with text filters", () => {
  const props = buildListProps(spec, records(), ["Deal"], TODAY, "sales");
  const byCompany = applyRowFilters(props, [
    { prop: "deals", kind: "field", field: "company", value: "Globex" },
  ]);
  expect((byCompany["deals"] as Record<string, unknown>[]).map((row) => row["matches"])).toEqual([
    false,
    true,
  ]);
  const both = applyRowFilters(props, [
    { prop: "deals", kind: "field", field: "company", value: "Globex" },
    { prop: "deals", kind: "text", text: "big" },
  ]);
  expect((both["deals"] as Record<string, unknown>[]).map((row) => row["matches"])).toEqual([
    false,
    false,
  ]);
});

test("counts cover derived counts and one per machine state", () => {
  const props = buildListProps(spec, records(), ["Deal"], TODAY);
  expect(props["overdueTasks"]).toBe(1);
  expect(props["leadDealsCount"]).toBe(1);
  expect(props["wonDealsCount"]).toBe(1);
  expect(props["openTasksCount"]).toBe(1);
  expect(props["doneTasksCount"]).toBe(0);
});

test("belongs-to relation exposes the related record's name and object", () => {
  const deal = buildProps(spec, records(), "Big deal", TODAY)["deal"] as Record<string, unknown>;
  expect(deal["company"]).toBe("Acme");
  expect(deal["companyRecord"]).toEqual({ name: "Acme" });
  const row = (
    buildListProps(spec, records(), ["Deal"], TODAY)["deals"] as Record<string, unknown>[]
  )[0];
  expect(row?.["company"]).toBe("Acme");
  expect((row?.["companyRecord"] as Record<string, unknown>)["name"]).toBe("Acme");
});

test("list surface is a plural prop with no singular record prop", () => {
  expect(listEntities(spec, ["deals", "canCreateDeal"])).toEqual(["Deal"]);
  expect(listEntities(spec, ["deals", "deal"])).toEqual([]);
});

test("editor for a new record starts empty and the entity comes from the surface name", () => {
  expect(editorEntity(spec, "Deal editor")).toBe("Deal");
  expect(editorEntity(spec, "Deal page")).toBeUndefined();
  const props = buildNewProps(spec, records(), "Deal", TODAY, "sales");
  expect(props["deal"]).toMatchObject({ name: "", canCreate: true });
  expect(roleOfActor(spec, "Sales rep")).toBe("sales");
});
