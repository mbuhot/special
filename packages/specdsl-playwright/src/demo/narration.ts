import type { Scenario } from "@special/specdsl-core";

/** Maps each step's source line to the text of the `Narrate:` line directly after it. */
export function planNarration(scenario: Scenario): Map<number, string> {
  const narrationByLine = new Map<number, string>();
  scenario.steps.forEach((node, index) => {
    if ("text" in node) return;
    const following = scenario.steps[index + 1];
    if (following && "text" in following && following.id === "narrate" && following.text !== "") {
      narrationByLine.set(node.line, following.text);
    }
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
export function signInNarration(actorName: string): string {
  return `Signed in as ${actorName}.`;
}

export function scenarioSlug(scenarioName: string): string {
  return scenarioName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
