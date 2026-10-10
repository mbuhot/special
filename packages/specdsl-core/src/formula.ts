import type { ConditionNode, FormulaNode, InvariantNode } from "./ast.js";

export type ComputedInvariant = Extract<InvariantNode, { kind: "product" | "sum" | "formula" }>;

/** How an expression reads the record it is evaluated on. */
export interface FormulaScope {
  field: (name: string) => number;
  sum: (node: Extract<FormulaNode, { op: "sum" }>) => number;
}

const CENTS = 100;
const ROUNDING_TOLERANCE = 1e-9;

/** The value of the expression in `scope`; undefined when it divides by zero. */
export function evaluateFormula(node: FormulaNode, scope: FormulaScope): number | undefined {
  switch (node.op) {
    case "number":
      return node.value;
    case "field":
      return scope.field(node.field);
    case "sum":
      return scope.sum(node);
    default:
      return arithmetic(node, scope);
  }
}

function arithmetic(
  node: Extract<FormulaNode, { op: "+" | "-" | "*" | "/" }>,
  scope: FormulaScope,
): number | undefined {
  const left = evaluateFormula(node.left, scope);
  const right = evaluateFormula(node.right, scope);
  if (left === undefined || right === undefined) return undefined;
  switch (node.op) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? undefined : left / right;
  }
}

/** The amount rounded half away from zero to the cent. */
export function roundToCent(amount: number): number {
  const rounded = Math.round(Math.abs(amount) * CENTS + ROUNDING_TOLERANCE) / CENTS;
  return amount < 0 ? -rounded : rounded;
}

/** The fields of the entity an expression reads, without repeats. */
export function expressionFields(node: FormulaNode): string[] {
  switch (node.op) {
    case "number":
      return [];
    case "field":
      return [node.field];
    case "sum":
      return [];
    default:
      return [...new Set([...expressionFields(node.left), ...expressionFields(node.right)])];
  }
}

/** The has-many sums inside an expression. */
export function expressionSums(node: FormulaNode): Extract<FormulaNode, { op: "sum" }>[] {
  switch (node.op) {
    case "number":
    case "field":
      return [];
    case "sum":
      return [node];
    default:
      return [...expressionSums(node.left), ...expressionSums(node.right)];
  }
}

/** The fields a condition reads, without repeats. */
export function conditionFields(condition: ConditionNode): string[] {
  return "left" in condition
    ? [...new Set([...conditionFields(condition.left), ...conditionFields(condition.right)])]
    : [condition.field];
}

/** The `Entity.field` keys an invariant reads. */
export function invariantInputs(invariant: ComputedInvariant): string[] {
  const own = (field: string) => `${invariant.entity}.${field}`;
  if (invariant.kind === "product") return [own(invariant.left), own(invariant.right)];
  if (invariant.kind === "sum") return [`${invariant.target}.${invariant.targetField}`];
  return [
    ...expressionFields(invariant.expression).map(own),
    ...(invariant.when === undefined ? [] : conditionFields(invariant.when).map(own)),
    ...expressionSums(invariant.expression).flatMap((sum) => [
      `${sum.target}.${sum.field}`,
      ...(sum.where === undefined
        ? []
        : conditionFields(sum.where).map((field) => `${sum.target}.${field}`)),
    ]),
  ];
}

/** The `Entity.field` key an invariant computes. */
export function invariantOutput(invariant: ComputedInvariant): string {
  return `${invariant.entity}.${invariant.field}`;
}

/** Product, sum and formula invariants ordered so each follows the invariants computing the fields it reads. */
export function computationOrder(invariants: readonly InvariantNode[]): ComputedInvariant[] {
  const computed = invariants.filter(
    (invariant): invariant is ComputedInvariant =>
      invariant.kind === "product" || invariant.kind === "sum" || invariant.kind === "formula",
  );
  const ordered: ComputedInvariant[] = [];
  const visited = new Set<ComputedInvariant>();
  const visit = (invariant: ComputedInvariant): void => {
    if (visited.has(invariant)) return;
    visited.add(invariant);
    for (const input of invariantInputs(invariant)) {
      computed.filter((other) => invariantOutput(other) === input).forEach(visit);
    }
    ordered.push(invariant);
  };
  computed.forEach(visit);
  return ordered;
}

/** The `Entity.field` keys on a dependency cycle, empty when the invariants are acyclic. */
export function dependencyCycle(invariants: readonly InvariantNode[]): string[] {
  const computed = computationOrder(invariants);
  const path: string[] = [];
  const done = new Set<string>();
  const walk = (key: string): string[] => {
    const at = path.indexOf(key);
    if (at >= 0) return path.slice(at);
    if (done.has(key)) return [];
    path.push(key);
    for (const invariant of computed.filter((other) => invariantOutput(other) === key)) {
      for (const input of invariantInputs(invariant)) {
        const cycle = walk(input);
        if (cycle.length > 0) return cycle;
      }
    }
    path.pop();
    done.add(key);
    return [];
  };
  for (const invariant of computed) {
    const cycle = walk(invariantOutput(invariant));
    if (cycle.length > 0) return cycle;
  }
  return [];
}
