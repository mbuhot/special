import { describe, expect, it } from "vitest";
import { bindSource, bindSuccess } from "./helpers.js";

const MODEL = [
  "# Test",
  "",
  "## Model",
  "- Deal: name, stage, close date (date), amount (money). Belongs to Company.",
  "- Company: name",
  "- Deal.stage: lead -> qualified -> won",
  "- Task: title, due date (date), status. Belongs to Deal.",
  "- Task.status: open -> done",
  "",
];

const withDerived = (...lines: string[]) => [...MODEL, "## Derived", ...lines, ""].join("\n");

const derivedOf = (...lines: string[]) => bindSuccess(withDerived(...lines)).ast.derived;

const errorsOf = (...lines: string[]) => {
  const result = bindSource(withDerived(...lines));
  return result.ok ? [] : result.errors.map((error) => `${error.line}: ${error.message}`);
};

describe("derived", () => {
  it("is empty when the spec has no Derived section", () => {
    expect(bindSuccess(MODEL.join("\n")).ast.derived).toEqual({ predicates: [], counts: [] });
  });

  it("records a predicate with its condition tree and source line", () => {
    expect(
      derivedOf("- Task is overdue when status is open and due date is before today").predicates,
    ).toEqual([
      {
        entity: "Task",
        name: "overdue",
        condition: {
          op: "and",
          left: { op: "is", field: "status", value: "open" },
          right: { op: "before", field: "due date", value: "today" },
        },
        file: "spec.md",
        line: 11,
      },
    ]);
  });

  it("binds and tighter than or", () => {
    const [predicate] = derivedOf(
      "- Deal is hot when stage is lead or stage is qualified and close date is after today",
    ).predicates;
    expect(predicate?.condition).toEqual({
      op: "or",
      left: { op: "is", field: "stage", value: "lead" },
      right: {
        op: "and",
        left: { op: "is", field: "stage", value: "qualified" },
        right: { op: "after", field: "close date", value: "today" },
      },
    });
  });

  it("records is not comparisons", () => {
    const [predicate] = derivedOf("- Deal is live when stage is not won").predicates;
    expect(predicate?.condition).toEqual({ op: "is not", field: "stage", value: "won" });
  });

  it("records a within-days comparison on a date field", () => {
    const [predicate] = derivedOf(
      "- Task is soon when status is open and due date is within 7 days of today",
    ).predicates;
    expect(predicate?.condition).toEqual({
      op: "and",
      left: { op: "is", field: "status", value: "open" },
      right: { op: "within", field: "due date", days: 7 },
    });
  });

  it("accepts a single day", () => {
    const [predicate] = derivedOf(
      "- Task is soon when due date is within 1 day of today",
    ).predicates;
    expect(predicate?.condition).toEqual({ op: "within", field: "due date", days: 1 });
  });

  it("rejects within on a field that is not a date", () => {
    expect(errorsOf("- Task is soon when title is within 7 days of today")).toEqual([
      "11: Task.title is not a date and cannot be compared with within",
    ]);
  });

  it("rejects a day count that is not a positive integer", () => {
    expect(errorsOf("- Task is soon when due date is within many days of today")).toEqual([
      '11: "many" is not a positive whole number of days',
    ]);
    expect(errorsOf("- Task is soon when due date is within 0 days of today")).toEqual([
      '11: "0" is not a positive whole number of days',
    ]);
    expect(errorsOf("- Task is soon when due date is within 2.5 days of today")).toEqual([
      '11: "2.5" is not a positive whole number of days',
    ]);
  });

  it("records a count over a declared predicate", () => {
    const derived = derivedOf(
      "- Task is overdue when status is open and due date is before today",
      "- Overdue tasks counts Task that are overdue",
    );
    expect(derived.counts).toEqual([
      { name: "Overdue tasks", entity: "Task", predicate: "overdue", file: "spec.md", line: 12 },
    ]);
  });

  it("records a count that precedes its predicate", () => {
    const derived = derivedOf(
      "- Overdue tasks counts Task that are overdue",
      "- Task is overdue when status is open",
    );
    expect(derived.counts).toHaveLength(1);
  });

  it("rejects a line that matches no derived shape, naming the line", () => {
    expect(errorsOf("- Task is lovely")).toEqual([
      '11: Unrecognized Derived item "Task is lovely"',
    ]);
  });

  it("rejects a field the entity does not declare", () => {
    expect(errorsOf("- Task is odd when colour is red")).toEqual([
      '11: Unknown Field "colour" of Task',
    ]);
  });

  it("rejects a value that is not a state of the field", () => {
    expect(errorsOf("- Task is odd when status is lost")).toEqual([
      '11: "lost" is not a value of Task.status',
    ]);
  });

  it("rejects before on a field that is not a date", () => {
    expect(errorsOf("- Task is odd when status is before today")).toEqual([
      "11: Task.status is not a date and cannot be compared with before",
    ]);
  });

  it("rejects a date value that is neither today nor an ISO date", () => {
    expect(errorsOf("- Task is odd when due date is before tomorrow")).toEqual([
      '11: "tomorrow" is not a date for Task.due date; use today or YYYY-MM-DD',
    ]);
  });

  it("rejects a condition without a comparison", () => {
    expect(errorsOf("- Task is odd when status")).toEqual([
      '11: Unrecognized condition "status"; expected "<Field> is [not|before|after] <Value>"',
    ]);
  });

  it("rejects a count over an undeclared predicate", () => {
    expect(errorsOf("- Late tasks counts Task that are late")).toEqual([
      '11: Unknown Predicate "late"',
    ]);
  });

  it("rejects a predicate of an unknown entity", () => {
    expect(errorsOf("- Ghost is odd when status is open")).toEqual(['11: Unknown Entity "Ghost"']);
  });

  it("rejects a predicate declared twice", () => {
    expect(
      errorsOf("- Task is odd when status is open", "- Task is odd when status is done"),
    ).toEqual(['12: Predicate "odd" of Task is already declared in spec.md:11']);
  });
});

describe("predicate steps", () => {
  const scenario = (...steps: string[]) =>
    [
      withDerived("- Task is overdue when status is open and due date is before today"),
      "## Scenario: Late",
      'Given a Task "Report" with title Report, due date 2026-01-01, status open',
      ...steps,
    ].join("\n");

  it("binds a predicate assertion on a Ref in domain mode", () => {
    const result = bindSuccess(scenario("Then Report is overdue", "And Report is not overdue"));
    const steps = result.ast.scenarios[0]?.steps.slice(1);
    expect(steps).toMatchObject([
      { id: "is-predicate", args: { Ref: "Report", Predicate: "overdue" }, modes: ["domain"] },
      { id: "is-not-predicate", args: { Ref: "Report", Predicate: "overdue" }, modes: ["domain"] },
    ]);
  });

  it("rejects a predicate the Ref's entity does not declare", () => {
    const result = bindSource(scenario("Then Report is stale"));
    expect(!result.ok && result.errors.map((error) => error.message)).toEqual([
      'Unknown Predicate "stale" on Task',
    ]);
  });
});
