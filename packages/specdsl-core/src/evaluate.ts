import type { ConditionNode, PredicateNode } from "./ast.js";

export type FieldRecord = Readonly<Record<string, string | null | undefined>>;

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const TODAY = "today";

/** Whether the record, keyed by field name, satisfies the predicate or condition on the ISO date `today`. */
export function holds(
  predicate: PredicateNode | ConditionNode,
  record: FieldRecord,
  today: string,
): boolean {
  const condition = "condition" in predicate ? predicate.condition : predicate;
  switch (condition.op) {
    case "and":
      return holds(condition.left, record, today) && holds(condition.right, record, today);
    case "or":
      return holds(condition.left, record, today) || holds(condition.right, record, today);
    case "is":
      return equal(record[condition.field], condition.value, today);
    case "is not":
      return !equal(record[condition.field], condition.value, today);
    case "before":
      return compareDates(record[condition.field], condition.value, today) < 0;
    case "after":
      return compareDates(record[condition.field], condition.value, today) > 0;
  }
}

function equal(actual: string | null | undefined, value: string, today: string): boolean {
  const actualDate = dateOf(actual);
  return actualDate === undefined
    ? normalise(actual) === normalise(value)
    : actualDate === dateValue(value, today);
}

function compareDates(actual: string | null | undefined, value: string, today: string): number {
  const actualDate = dateOf(actual);
  if (actualDate === undefined) return Number.NaN;
  const expected = dateValue(value, today);
  return actualDate < expected ? -1 : actualDate > expected ? 1 : 0;
}

function dateOf(value: string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : ISO_DATE_PREFIX.exec(value)?.[1];
}

function dateValue(value: string, today: string): string {
  return value.toLowerCase() === TODAY ? (dateOf(today) ?? today) : (dateOf(value) ?? value);
}

function normalise(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toLowerCase().replace(/ /g, "_");
}
