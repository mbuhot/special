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

/** Texts of the scenario's `Caption:` lines. */
export function planCaptions(scenario: Scenario): string[] {
  return scenario.steps.flatMap((node) =>
    "text" in node && node.id === "caption" ? [node.text] : [],
  );
}

/** Names of the actors that perform steps in the scenario, in order of first appearance. */
export function scenarioActors(scenario: Scenario): string[] {
  const actorNames = scenario.steps.flatMap((node) => {
    const actorName = "text" in node ? undefined : node.args["Actor"];
    return typeof actorName === "string" ? [actorName] : [];
  });
  return [...new Set(actorNames)];
}

/** Narration of the title card that opens an actor's recording. */
export function signInNarration(actorName: string, email: string): string {
  return `${actorName} is signed in as ${email}.`;
}

export function scenarioSlug(scenarioName: string): string {
  return scenarioName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
