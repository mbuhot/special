import { describe, expect, it } from "vitest";
import { lockFile } from "../src/index.js";
import webApp from "../../../dialects/web-app.ts";

describe("lock file", () => {
  const lock = lockFile(webApp);

  it("lists every step id of the dialect", () => {
    expect(lock.steps.map((entry) => entry.id)).toEqual([
      "opens",
      "is-on",
      "enters",
      "clicks",
      "selects",
      "sees",
      "sees-before",
      "no-longer-sees",
      "given-entity",
      "has-field",
      "time-advances",
      "job-runs",
      "may",
      "may-not",
      "does-not-see",
    ]);
  });

  it("describes the slots of a step with their namespaces", () => {
    const enters = lock.steps.find((entry) => entry.id === "enters");
    expect(enters?.slots.map((slot) => [slot.name, slot.namespace, slot.kind])).toEqual([
      ["Actor", "Actor", undefined],
      ["Value", "Value", undefined],
      ["Control", "Control", "field"],
    ]);
  });

  it("lists contexts with their scopes and config keys", () => {
    expect(lock.contexts["clock"]).toEqual({
      scope: "scenario",
      requires: ["app"],
      config: ["DateTime"],
    });
    expect(lock.contexts["actor"]).toEqual({
      scope: "actor",
      keyedBy: "Actor",
      requires: ["data"],
      config: [],
    });
  });

  it("lists the section kinds", () => {
    expect(lock.sections["Scenario"]).toEqual({
      heading: "Scenario: <Name>",
      occurs: "many",
      body: "steps",
    });
  });
});
