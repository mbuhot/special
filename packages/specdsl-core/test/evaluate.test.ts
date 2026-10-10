import { describe, expect, it } from "vitest";
import type { PredicateNode } from "../src/ast.js";
import { holds } from "../src/evaluate.js";

const overdue: PredicateNode = {
  entity: "Task",
  name: "overdue",
  file: "derived.md",
  line: 1,
  condition: {
    op: "and",
    left: { op: "is", field: "status", value: "open" },
    right: { op: "before", field: "due date", value: "today" },
  },
};

const openDeal: PredicateNode["condition"] = {
  op: "or",
  left: { op: "is", field: "stage", value: "lead" },
  right: { op: "is", field: "stage", value: "qualified" },
};

describe("holds", () => {
  it("is true for an open task due before today", () => {
    expect(holds(overdue, { status: "open", "due date": "2026-01-16" }, "2026-01-18")).toBe(true);
  });

  it("is false when the due date is today", () => {
    expect(holds(overdue, { status: "open", "due date": "2026-01-18" }, "2026-01-18")).toBe(false);
  });

  it("is false when a conjunct fails", () => {
    expect(holds(overdue, { status: "done", "due date": "2026-01-16" }, "2026-01-18")).toBe(false);
  });

  it("is false when the date is missing", () => {
    expect(holds(overdue, { status: "open" }, "2026-01-18")).toBe(false);
  });

  it("reads the date part of a datetime", () => {
    expect(
      holds(overdue, { status: "open", "due date": "2026-01-16T10:00:00Z" }, "2026-01-18"),
    ).toBe(true);
  });

  it("holds an or-condition when either side holds", () => {
    expect(holds(openDeal, { stage: "qualified" }, "2026-01-18")).toBe(true);
    expect(holds(openDeal, { stage: "won" }, "2026-01-18")).toBe(false);
  });

  it("compares enum values ignoring case and spacing", () => {
    expect(
      holds({ op: "is", field: "stage", value: "in_review" }, { stage: "In Review" }, "x"),
    ).toBe(true);
  });

  it("negates with is not, including for a missing value", () => {
    const notWon: PredicateNode["condition"] = { op: "is not", field: "stage", value: "won" };
    expect(holds(notWon, { stage: "lead" }, "2026-01-18")).toBe(true);
    expect(holds(notWon, { stage: "won" }, "2026-01-18")).toBe(false);
    expect(holds(notWon, {}, "2026-01-18")).toBe(true);
  });

  it("supports after and literal dates", () => {
    const after: PredicateNode["condition"] = {
      op: "after",
      field: "close date",
      value: "2026-03-01",
    };
    expect(holds(after, { "close date": "2026-03-31" }, "2026-01-18")).toBe(true);
    expect(holds(after, { "close date": "2026-03-01" }, "2026-01-18")).toBe(false);
  });

  it("matches a date field against today with is", () => {
    const dueToday: PredicateNode["condition"] = { op: "is", field: "due date", value: "today" };
    expect(holds(dueToday, { "due date": "2026-01-18" }, "2026-01-18")).toBe(true);
  });
});
