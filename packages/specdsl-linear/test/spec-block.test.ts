import { describe, expect, it } from "vitest";
import { extractSpec, replaceSpec } from "../src/spec-block.js";

const FENCED_DESCRIPTION = [
  "Customers need line totals.",
  "",
  "```spec",
  "# Invoicing",
  "",
  "## Scenario: Totals",
  "```",
  "",
  "Notes for the team.",
].join("\n");

describe("spec block", () => {
  it("extracts a fenced spec block and replaces it leaving surrounding text intact", () => {
    const extracted = extractSpec(FENCED_DESCRIPTION);

    expect(extracted?.markdown).toBe("# Invoicing\n\n## Scenario: Totals");

    const replaced = replaceSpec(FENCED_DESCRIPTION, "# Billing\n\n## Scenario: Paid");

    expect(replaced).toBe(
      [
        "Customers need line totals.",
        "",
        "```spec",
        "# Billing",
        "",
        "## Scenario: Paid",
        "```",
        "",
        "Notes for the team.",
      ].join("\n"),
    );
  });

  it("treats a description beginning with a heading and no fence as the whole spec", () => {
    const description = '# Invoicing\n\n## Scenario: Totals\nGiven a Customer "Acme"';

    const extracted = extractSpec(description);

    expect(extracted).toEqual({
      markdown: description,
      range: { start: 0, end: description.length },
    });
    expect(replaceSpec(description, "# Billing")).toBe("# Billing");
  });

  it("finds no spec in free-form text", () => {
    expect(extractSpec("Please add line totals.\n\n```ts\nconst a = 1;\n```")).toBeNull();
  });
});
