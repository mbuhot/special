import { describe, expect, it } from "vitest";
import { lint } from "../src/index.js";
import invoicing from "../../../dialects/invoicing.ts";
import { bindSuccess, DRAFT_INVOICE, lineOf, specWith } from "./helpers.js";

const STORY = "Story: As the accountant, I need to review invoices, so that I stay in control.";

describe("lint", () => {
  it("warns about declared transitions no scenario observes", () => {
    const source = specWith("## Scenario: Looking", STORY, ...DRAFT_INVOICE);
    const line = lineOf(source, "Invoice.status:");
    expect(lint(bindSuccess(source), invoicing)).toEqual([
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->sent is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:sent->paid is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->void is not covered by any TransitionUse",
      },
    ]);
  });

  it("counts an observed change from the given state as covering the transition", () => {
    const source = specWith(
      "## Scenario: Sending",
      STORY,
      ...DRAFT_INVOICE,
      "Then INV-001 has status sent",
    );
    const line = lineOf(source, "Invoice.status:");
    expect(lint(bindSuccess(source), invoicing)).toEqual([
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:sent->paid is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->void is not covered by any TransitionUse",
      },
    ]);
  });

  it("warns when an observed state change skips a state", () => {
    const source = specWith(
      "## Scenario: Skipping",
      STORY,
      ...DRAFT_INVOICE,
      "Then INV-001 has status paid",
    );
    const line = lineOf(source, "Invoice.status:");
    expect(lint(bindSuccess(source), invoicing)).toEqual([
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->sent is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:sent->paid is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->void is not covered by any TransitionUse",
      },
      {
        file: "spec.md",
        line: lineOf(source, "has status paid"),
        message: "Invoice.status moves draft -> paid, skipping sent",
      },
    ]);
  });

  it("accepts consecutive observations that follow the state machine", () => {
    const source = specWith(
      "## Scenario: Lifecycle",
      STORY,
      ...DRAFT_INVOICE,
      "Then INV-001 has status sent",
      "And INV-001 has status paid",
    );
    const line = lineOf(source, "Invoice.status:");
    expect(lint(bindSuccess(source), invoicing)).toEqual([
      {
        file: "spec.md",
        line,
        message: "Transition Invoice.status:draft->void is not covered by any TransitionUse",
      },
    ]);
  });

  it("warns about listed controls no step references", () => {
    const source = specWith(
      "## Surfaces",
      '- Invoice editor: field "Quantity", button "Send"',
      "## Scenario: Sending",
      STORY,
      ...DRAFT_INVOICE,
      'And Accounts clicks "Send"',
    );
    const warnings = lint(bindSuccess(source), invoicing).filter((warning) =>
      warning.message.startsWith("Control"),
    );
    expect(warnings).toEqual([
      {
        file: "spec.md",
        line: lineOf(source, "- Invoice editor:"),
        message: "Control Invoice editor/Quantity is not referenced by any step",
      },
    ]);
  });
});

describe("lint stories", () => {
  it("warns about a scenario with no Story line", () => {
    const source = specWith("## Scenario: Looking", ...DRAFT_INVOICE);
    const warnings = lint(bindSuccess(source), invoicing).filter((warning) =>
      warning.message.includes("Story"),
    );
    expect(warnings).toEqual([
      {
        file: "spec.md",
        line: lineOf(source, "## Scenario: Looking"),
        message: 'Scenario "Looking" has no Story line',
      },
    ]);
  });

  it("does not warn about a scenario that has a Story line", () => {
    const source = specWith("## Scenario: Looking", STORY, ...DRAFT_INVOICE);
    const warnings = lint(bindSuccess(source), invoicing).filter((warning) =>
      warning.message.includes("Story"),
    );
    expect(warnings).toEqual([]);
  });
});
