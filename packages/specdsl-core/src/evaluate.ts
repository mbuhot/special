import type { ConditionNode, PredicateNode } from "./ast.js";

export type FieldRecord = Readonly<Record<string, string | null | undefined>>;

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:$|T)/;
const ISO_DATE_LENGTH = 10;
const TODAY = "today";

/** Whether the record, keyed by field name, satisfies the predicate or condition on the ISO date `today`; `viewer` is the signed-in user's record ref that `is me` compares with. */
export function holds(
  predicate: PredicateNode | ConditionNode,
  record: FieldRecord,
  today: string,
  viewer?: string,
): boolean {
  const condition = "condition" in predicate ? predicate.condition : predicate;
  switch (condition.op) {
    case "and":
      return (
        holds(condition.left, record, today, viewer) &&
        holds(condition.right, record, today, viewer)
      );
    case "or":
      return (
        holds(condition.left, record, today, viewer) ||
        holds(condition.right, record, today, viewer)
      );
    case "is":
      return equal(record[condition.field], condition.value, today);
    case "is not":
      return !equal(record[condition.field], condition.value, today);
    case "before":
      return compareDates(record[condition.field], condition.value, today) < 0;
    case "after":
      return compareDates(record[condition.field], condition.value, today) > 0;
    case "above":
      return compareNumbers(record[condition.field], condition.value) > 0;
    case "below":
      return compareNumbers(record[condition.field], condition.value) < 0;
    case "is me":
      return viewer !== undefined && record[condition.field] === viewer;
    case "within":
      return withinDays(record[condition.field], condition.days, today);
  }
}

function withinDays(actual: string | null | undefined, days: number, today: string): boolean {
  const actualDate = dateOf(actual);
  if (actualDate === undefined) return false;
  const start = dateOf(today) ?? today;
  return actualDate >= start && actualDate <= addDays(start, days);
}

function addDays(isoDate: string, days: number): string {
  const shifted = new Date(`${isoDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, ISO_DATE_LENGTH);
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
  return value === null || value === undefined ? null : value.toLowerCase().replace(/[ -]/g, "_");
}

function compareNumbers(actual: string | null | undefined, expected: number): number {
  const cleaned = (actual ?? "").replace(/[$,\s]/g, "");
  const amount = Number(cleaned);
  return cleaned === "" || Number.isNaN(amount) ? Number.NaN : amount - expected;
}
