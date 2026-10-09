import type { Scenario } from "@special/specdsl-core";

/** Maps each step's source line to its narration; a `narrate` step overrides the step above it. */
export function planNarration(scenario: Scenario): Map<number, string> {
  const narrationByLine = new Map<number, string>();
  scenario.steps.forEach((node, index) => {
    if ("text" in node) return;
    const following = scenario.steps[index + 1];
    const override =
      following && "text" in following && following.id === "narrate" ? following : undefined;
    const text = override?.text ?? node.narrate;
    if (text !== undefined && text !== "") narrationByLine.set(node.line, text);
  });
  return narrationByLine;
}

export function scenarioSlug(scenarioName: string): string {
  return scenarioName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
