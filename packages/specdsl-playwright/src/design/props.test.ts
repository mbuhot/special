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
import { createRecord, editorEntity, ensureActorUser, roleOfActor, saveRecord } from "./records.js";
import type { Records } from "./records.js";
import { assignDefaultUsers, withNaturalKey } from "./rules.js";

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
  effects: [],
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

const billing = {
  actors: { "Sales rep": { Role: "sales", extra: {} } },
  model: {
    User: {
      fields: [{ name: "role", type: "enum", values: ["sales"], required: true }],
      relations: [],
      machines: {},
    },
    Contact: {
      fields: [{ name: "first name", type: "text", required: true }],
      relations: [{ kind: "has-many", entity: "Activity", name: "activity" }],
      machines: {},
    },
    Activity: {
      fields: [
        { name: "body", type: "text", required: true },
        { name: "occurred at", type: "datetime", required: true },
        { name: "reviewed on", type: "date" },
      ],
      relations: [
        { kind: "belongs-to", entity: "Contact", name: "contact" },
        { kind: "belongs-to", entity: "User", name: "author" },
      ],
      machines: {},
      order: { field: "occurred at", direction: "newest first" },
    },
    Invoice: {
      fields: [
        { name: "number", type: "text", required: true },
        { name: "status", type: "enum", values: ["draft", "sent"] },
        { name: "issue date", type: "date" },
        { name: "total", type: "money" },
      ],
      relations: [{ kind: "has-many", entity: "LineItem", name: "line item" }],
      machines: { status: { states: ["draft", "sent"], transitions: [] } },
    },
    LineItem: {
      fields: [
        { name: "description", type: "text", required: true },
        { name: "quantity", type: "integer", required: true },
        { name: "unit price", type: "money", required: true },
        { name: "total", type: "money" },
      ],
      relations: [{ kind: "belongs-to", entity: "Invoice", name: "invoice" }],
      machines: {},
    },
  },
  policies: {},
  invariants: [
    { kind: "product", entity: "LineItem", field: "total", left: "quantity", right: "unit price" },
    {
      kind: "sum",
      entity: "Invoice",
      field: "total",
      relation: "line item",
      target: "LineItem",
      targetField: "total",
    },
    { kind: "sequence", entity: "Invoice", field: "number", prefix: "INV-", width: 3 },
  ],
  derived: { predicates: [], counts: [] },
  effects: [],
  surfaces: {},
  contexts: {},
  scenarios: [],
  dialect: { name: "", version: "", stepIds: [] },
} as unknown as SpecAst;

const invoiceRecords = () =>
  new Map<string, GivenEntity>([
    ["INV-001", { entity: "Invoice", fields: new Map([["status", "draft"]]) }],
    [
      "Consulting",
      {
        entity: "LineItem",
        fields: new Map([
          ["invoice", "INV-001"],
          ["quantity", "2"],
          ["unit price", "100"],
        ]),
      },
    ],
    [
      "Support",
      {
        entity: "LineItem",
        fields: new Map([
          ["invoice", "INV-001"],
          ["quantity", "3"],
          ["unit price", "40"],
        ]),
      },
    ],
  ]);

test("line totals and the invoice total follow the declared product and sum", () => {
  const props = buildProps(billing, invoiceRecords(), "INV-001", TODAY);
  const lines = props["lineItems"] as Record<string, unknown>[];
  expect(lines.map((line) => line["total"])).toEqual(["$200.00", "$120.00"]);
  expect((props["invoice"] as Record<string, unknown>)["total"]).toBe("$320.00");
});

test("totals follow an edited quantity", () => {
  const edited = invoiceRecords();
  saveRecord(billing, edited, "Consulting", new Map([["quantity", "3"]]));
  const props = buildProps(billing, edited, "INV-001", TODAY);
  expect((props["invoice"] as Record<string, unknown>)["total"]).toBe("$420.00");
});

test("an invoice without lines totals zero", () => {
  const props = buildProps(
    billing,
    new Map([["INV-001", { entity: "Invoice", fields: new Map<string, string>() }]]),
    "INV-001",
    TODAY,
  );
  expect((props["invoice"] as Record<string, unknown>)["total"]).toBe("$0.00");
});

const timeline = () =>
  new Map<string, GivenEntity>([
    ["Ada", { entity: "Contact", fields: new Map([["first name", "Ada"]]) }],
    [
      "Older",
      {
        entity: "Activity",
        fields: new Map([
          ["contact", "Ada"],
          ["occurred at", "2026-01-10T10:00:00Z"],
        ]),
      },
    ],
    [
      "Newer",
      {
        entity: "Activity",
        fields: new Map([
          ["contact", "Ada"],
          ["occurred at", "2026-01-12T10:00:00Z"],
        ]),
      },
    ],
  ]);

test("child rows and list rows follow the order the model declares", () => {
  const page = buildProps(billing, timeline(), "Ada", TODAY);
  expect((page["activities"] as Record<string, unknown>[]).map((row) => row["name"])).toEqual([
    "Newer",
    "Older",
  ]);
  const list = buildListProps(billing, timeline(), ["Activity"], TODAY);
  expect((list["activities"] as Record<string, unknown>[]).map((row) => row["name"])).toEqual([
    "Newer",
    "Older",
  ]);
});

test("a new record starts in the first state with the next sequence number", () => {
  const records = invoiceRecords();
  const ref = createRecord(billing, records, "Invoice", new Map(), undefined, {
    now: "2026-01-15T00:00:00.000Z",
  });
  expect(ref).toBe("INV-001 2");
  expect(records.get(ref)?.fields.get("status")).toBe("draft");
  const blank = buildNewProps(billing, new Map(), "Invoice", TODAY)["invoice"] as Record<
    string,
    unknown
  >;
  expect(blank["number"]).toBe("INV-001");
});

test("sequence numbers continue after the highest number in use", () => {
  const records = new Map<string, GivenEntity>([
    ["INV-007", { entity: "Invoice", fields: new Map([["number", "INV-007"]]) }],
  ]);
  const blank = buildNewProps(billing, records, "Invoice", TODAY)["invoice"] as Record<
    string,
    unknown
  >;
  expect(blank["number"]).toBe("INV-008");
});

test("a created record takes the clock for datetimes, leaves dates empty and points at the viewing user", () => {
  const records = new Map<string, GivenEntity>();
  const ref = createRecord(billing, records, "Activity", new Map([["body", "Call"]]), undefined, {
    now: "2026-01-15T09:30:00.000Z",
    userRef: "Sales rep",
  });
  const fields = records.get(ref)?.fields;
  expect(fields?.get("occurred at")).toBe("2026-01-15T09:30:00.000Z");
  expect(fields?.has("reviewed on")).toBe(false);
  expect(fields?.get("author")).toBe("Sales rep");
});

test("a Given record without a required text field takes its Ref as the natural key", () => {
  const model = billing.model["LineItem"];
  expect(withNaturalKey(model, "Consulting", new Map([["quantity", "2"]])).get("description")).toBe(
    "Consulting",
  );
  expect(
    withNaturalKey(model, "Consulting", new Map([["description", "Advice"]])).get("description"),
  ).toBe("Advice");
});

test("an actor's user record carries the declared name when the model's User has a name field", () => {
  const user = billing.model["User"] as SpecAst["model"][string];
  const named: SpecAst = {
    ...billing,
    actors: { "Sales rep": { Role: "sales", Name: "Sam Rivera", extra: {} } },
    model: {
      ...billing.model,
      User: { ...user, fields: [...user.fields, { name: "name", type: "text" }] },
    },
  };
  const records: Records = new Map();
  ensureActorUser(named, records, "Sales rep");
  expect(records.get("Sales rep")?.fields.get("name")).toBe("Sam Rivera");
  const unnamed: Records = new Map();
  ensureActorUser(billing, unnamed, "Sales rep");
  expect(unnamed.get("Sales rep")?.fields.has("name")).toBe(false);
});

test("unset user relations point at the first actor's user", () => {
  const records = timeline();
  const user = ensureActorUser(billing, records, "Sales rep");
  assignDefaultUsers(billing, records, user as string);
  expect(records.get("Sales rep")?.fields.get("role")).toBe("sales");
  expect(records.get("Older")?.fields.get("author")).toBe("Sales rep");
  const row = (
    buildProps(billing, records, "Ada", TODAY)["activities"] as Record<string, unknown>[]
  )[0];
  expect(row?.["author"]).toBe("Sales rep");
});

test("saving a changed natural key renames the record and its references", () => {
  const records = timeline();
  const renamed = saveRecord(billing, records, "Ada", new Map([["firstName", "Ada-Byron"]]));
  expect(renamed).toBe("Ada-Byron");
  expect([...records.keys()]).toEqual(["Ada-Byron", "Older", "Newer"]);
  expect(records.get("Older")?.fields.get("contact")).toBe("Ada-Byron");
});

test("props carry every record for select options, raw input values and count flags", () => {
  const records = invoiceRecords();
  records.get("INV-001")?.fields.set("issue date", "2026-01-15");
  const props = buildProps(billing, records, "INV-001", TODAY);
  expect((props["allLineItems"] as Record<string, unknown>[]).map((row) => row["name"])).toEqual([
    "Consulting",
    "Support",
  ]);
  const invoice = props["invoice"] as Record<string, unknown>;
  expect(invoice["issueDate"]).toBe("15 Jan 2026");
  expect(invoice["issueDateValue"]).toBe("2026-01-15");
  expect(invoice["totalValue"]).toBe("320");
  expect(props["hasDraftInvoices"]).toBe(true);
  expect(props["hasSentInvoices"]).toBe(false);
});

test("a derived count has a boolean flag", () => {
  const props = buildListProps(spec, records(), ["Deal"], TODAY);
  expect(props["hasOverdueTasks"]).toBe(true);
  expect(props["hasLeadDeals"]).toBe(true);
});

test("flag filter keeps rows whose named flag is true, and an empty flag keeps every row", () => {
  const props = { tasks: [{ overdue: true }, { overdue: false }] };
  const overdue = applyRowFilters(props, [{ prop: "tasks", kind: "flag", flag: "overdue" }]);
  expect((overdue["tasks"] as Record<string, unknown>[]).map((row) => row["matches"])).toEqual([
    true,
    false,
  ]);
  const all = applyRowFilters(props, [{ prop: "tasks", kind: "flag", flag: "" }]);
  expect((all["tasks"] as Record<string, unknown>[]).map((row) => row["matches"])).toEqual([
    true,
    true,
  ]);
});
