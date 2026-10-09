import type { BindSuccess, Declaration, Emission } from "./ast.js";
import type { CheckDefinition, Dialect } from "./dialect.js";

export interface LintWarning {
  file: string;
  line: number;
  message: string;
}

/** Runs the dialect's checks (coverage, sequence, referenced) over a bound spec. */
export function lint(result: BindSuccess, dialect: Dialect): LintWarning[] {
  return dialect.checks
    .flatMap((definition) => runCheck(definition, result))
    .sort((first, second) => first.file.localeCompare(second.file) || first.line - second.line);
}

function runCheck(definition: CheckDefinition, result: BindSuccess): LintWarning[] {
  switch (definition.check) {
    case "coverage":
      return coverage(definition.declared, definition.usedBy, result);
    case "sequence":
      return sequence(definition.machine, definition.observed, result);
    case "referenced":
      return referenced(definition.declared, result);
  }
}

function coverage(declared: string, usedBy: string, result: BindSuccess): LintWarning[] {
  const used = new Set(
    result.analysis.emissions
      .filter((emission) => emission.kind === usedBy)
      .map((emission) => emission.key),
  );
  return result.analysis.declarations
    .filter((declaration) => declaration.kind === declared && !used.has(declaration.key))
    .map((declaration) => ({
      file: declaration.file,
      line: declaration.line,
      message: `${declared} ${declaration.key} is not covered by any ${usedBy}`,
    }));
}

function sequence(machine: string, observed: string, result: BindSuccess): LintWarning[] {
  const transitions = result.analysis.declarations.filter(
    (declaration) => declaration.kind === machine,
  );
  const declaredKeys = new Set(transitions.map((transition) => transition.key));
  return result.analysis.emissions
    .filter(
      (emission) =>
        emission.kind === observed && emission.key !== undefined && !declaredKeys.has(emission.key),
    )
    .map((emission) => ({
      file: emission.file,
      line: emission.line,
      message: undeclaredMove(emission, transitions),
    }));
}

function undeclaredMove(emission: Emission, transitions: Declaration[]): string {
  const { Entity: entity, Field: field, From: from, State: to } = emission.data;
  const subject = `${entity}.${field} moves ${from} -> ${to}`;
  const route = shortestRoute(transitions, `${entity}.${field}`, from as string, to as string);
  return route.length > 2
    ? `${subject}, skipping ${route.slice(1, -1).join(", ")}`
    : `${subject}, which is not a declared transition`;
}

function shortestRoute(
  transitions: Declaration[],
  machineKey: string,
  from: string,
  to: string,
): string[] {
  const edges = transitions.filter(
    (transition) => `${transition.data["Entity"]}.${transition.data["Field"]}` === machineKey,
  );
  const queue: string[][] = [[from]];
  const visited = new Set<string>([from]);
  for (const route of queue) {
    const last = route[route.length - 1] as string;
    if (last === to) {
      return route;
    }
    for (const edge of edges.filter((candidate) => candidate.data["From"] === last)) {
      const next = edge.data["To"] as string;
      visited.has(next) || (visited.add(next), queue.push([...route, next]));
    }
  }
  return [];
}

function referenced(declared: string, result: BindSuccess): LintWarning[] {
  const used = new Set(
    result.analysis.references
      .filter((reference) => reference.kind === declared)
      .map((reference) => reference.key),
  );
  return result.analysis.declarations
    .filter((declaration) => declaration.kind === declared && !used.has(declaration.key))
    .map((declaration) => ({
      file: declaration.file,
      line: declaration.line,
      message: `${declared} ${declaration.key} is not referenced by any step`,
    }));
}
