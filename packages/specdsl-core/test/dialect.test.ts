import { describe, expect, it } from "vitest";
import { dialect, DialectError, ns, step, type StepDefinition } from "../src/index.js";

function dialectWith(steps: StepDefinition[]) {
  return dialect({
    name: "sample",
    version: "1",
    namespaces: { Actor: ns(), Surface: ns() },
    sections: {},
    steps,
  });
}

function issuesOf(steps: StepDefinition[]): readonly string[] {
  try {
    dialectWith(steps);
  } catch (error) {
    if (error instanceof DialectError) {
      return error.issues;
    }
    throw error;
  }
  return [];
}

describe("dialect validation", () => {
  it("derives a step id from the literal words of the pattern", () => {
    const built = dialectWith([
      step("<Actor> opens <Surface>"),
      step("<Actor> enters <Surface> into <Surface>"),
    ]);
    expect(built.stepIds).toEqual(["opens", "enters-into"]);
  });

  it("prefers an explicit step id", () => {
    expect(dialectWith([step("<Actor> opens <Surface>", { id: "visits" })]).stepIds).toEqual([
      "visits",
    ]);
  });

  it("rejects duplicate step ids", () => {
    expect(
      issuesOf([
        step("<Actor> opens <Surface>"),
        step("<Actor> opens <Surface> quickly", { id: "opens" }),
      ]),
    ).toEqual(['Duplicate step id "opens"']);
  });

  it("rejects ambiguous step patterns", () => {
    expect(
      issuesOf([
        step("<Actor> opens <Surface>"),
        step("<Surface> opens <Actor>", { id: "opens-reversed" }),
      ]),
    ).toEqual(['Ambiguous steps "opens" and "opens-reversed"']);
  });

  it("rejects slots naming an unknown namespace", () => {
    expect(issuesOf([step("<Actor> opens <Page>")])).toEqual([
      'Step "<Actor> opens <Page>": slot <Page> names unknown namespace "Page"',
    ]);
  });

  it("rejects steps using an unknown context", () => {
    expect(issuesOf([step("<Actor> opens <Surface>", { uses: ["browser"] })])).toEqual([
      'Step "opens" uses unknown context "browser"',
    ]);
  });
});
