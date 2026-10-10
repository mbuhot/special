import { computationOrder, evaluateFormula, holds, roundToCent } from "@special/specdsl-core";
import type { EntityNode, FormulaScope, InvariantNode, SpecAst } from "@special/specdsl-core";
import type { GivenEntity } from "./props.js";

type Entities = ReadonlyMap<string, GivenEntity>;
type Entry = [string, GivenEntity];
type ProductInvariant = Extract<InvariantNode, { kind: "product" }>;
type FormulaInvariant = Extract<InvariantNode, { kind: "formula" }>;
type SumInvariant = Extract<InvariantNode, { kind: "sum" }>;
type SequenceInvariant = Extract<InvariantNode, { kind: "sequence" }>;

const CENTS = 100;
const NO_DATE = "";
const USER_ENTITY = "User";

/** Context a newly created record takes its defaults from: the scenario clock and the user on screen. */
export interface NewRecordContext {
  now: string;
  userRef?: string | undefined;
}

/** A number from a stored or displayed value (`$1,200.50`, `3`); undefined when the text is not a number. */
export function parseNumber(value: string | undefined): number | undefined {
  const cleaned = (value ?? "").replace(/[$,\s]/g, "");
  const amount = Number(cleaned);
  return cleaned === "" || Number.isNaN(amount) ? undefined : amount;
}

/** Copies of every record with the spec's product, sum and formula invariants evaluated into their target fields in dependency order. */
export function withComputedFields(spec: SpecAst, entities: Entities): Map<string, GivenEntity> {
  const resolved = new Map<string, GivenEntity>(
    [...entities].map(([refName, record]) => [
      refName,
      { entity: record.entity, fields: new Map(record.fields) },
    ]),
  );
  for (const invariant of computationOrder(spec.invariants)) {
    invariant.kind === "product" && applyProduct(resolved, invariant);
    invariant.kind === "sum" && applySum(spec, resolved, invariant);
    invariant.kind === "formula" && applyFormula(spec, resolved, invariant);
  }
  return resolved;
}

function applyProduct(records: Map<string, GivenEntity>, invariant: ProductInvariant): void {
  for (const record of records.values()) {
    if (record.entity !== invariant.entity) continue;
    const left = parseNumber(record.fields.get(invariant.left.toLowerCase()));
    const right = parseNumber(record.fields.get(invariant.right.toLowerCase()));
    left !== undefined &&
      right !== undefined &&
      record.fields.set(invariant.field.toLowerCase(), stored(left * right));
  }
}

function applySum(spec: SpecAst, records: Map<string, GivenEntity>, invariant: SumInvariant): void {
  const owner = spec.model[invariant.target]?.relations.find(
    (relation) => relation.kind === "belongs-to" && relation.entity === invariant.entity,
  );
  if (owner === undefined) return;
  for (const [parentRef, parent] of records) {
    if (parent.entity !== invariant.entity) continue;
    const total = [...records.values()]
      .filter(
        (child) =>
          child.entity === invariant.target &&
          child.fields.get(owner.name.toLowerCase()) === parentRef,
      )
      .reduce(
        (sum, child) =>
          sum + (parseNumber(child.fields.get(invariant.targetField.toLowerCase())) ?? 0),
        0,
      );
    parent.fields.set(invariant.field.toLowerCase(), stored(total));
  }
}

function applyFormula(
  spec: SpecAst,
  records: Map<string, GivenEntity>,
  invariant: FormulaInvariant,
): void {
  const money =
    spec.model[invariant.entity]?.fields.find((candidate) => candidate.name === invariant.field)
      ?.type === "money";
  for (const [parentRef, parent] of records) {
    if (parent.entity !== invariant.entity) continue;
    const applies =
      invariant.when === undefined ||
      holds(invariant.when, Object.fromEntries(parent.fields), NO_DATE);
    const amount = applies
      ? evaluateFormula(invariant.expression, formulaScope(spec, records, parentRef, parent))
      : undefined;
    amount === undefined ||
      parent.fields.set(
        invariant.field.toLowerCase(),
        stored(money ? roundToCent(amount) : amount),
      );
  }
}

function formulaScope(
  spec: SpecAst,
  records: Map<string, GivenEntity>,
  parentRef: string,
  parent: GivenEntity,
): FormulaScope {
  return {
    field: (name) => parseNumber(parent.fields.get(name.toLowerCase())) ?? 0,
    sum: (node) => {
      const owner = spec.model[node.target]?.relations.find(
        (relation) => relation.kind === "belongs-to" && relation.entity === parent.entity,
      );
      return [...records.values()]
        .filter(
          (child) =>
            child.entity === node.target &&
            owner !== undefined &&
            child.fields.get(owner.name.toLowerCase()) === parentRef &&
            (node.where === undefined ||
              holds(node.where, Object.fromEntries(child.fields), NO_DATE)),
        )
        .reduce(
          (total, child) => total + (parseNumber(child.fields.get(node.field.toLowerCase())) ?? 0),
          0,
        );
    },
  };
}

function stored(amount: number): string {
  return String(Math.round(amount * CENTS) / CENTS);
}

/** The first required text field of the entity, as stored in record fields. */
export function naturalKeyField(model: EntityNode | undefined): string | undefined {
  return model?.fields
    .find((field) => field.type === "text" && field.required === true)
    ?.name.toLowerCase();
}

/** Fields with the entity's natural key set to `refName` when no required text field has a value. */
export function withNaturalKey(
  model: EntityNode | undefined,
  refName: string,
  fields: ReadonlyMap<string, string>,
): Map<string, string> {
  const completed = new Map(fields);
  const requiredText = (model?.fields ?? []).filter(
    (field) => field.type === "text" && field.required === true,
  );
  const anySet = requiredText.some((field) => (fields.get(field.name.toLowerCase()) ?? "") !== "");
  const key = naturalKeyField(model);
  key === undefined || anySet || completed.set(key, refName);
  return completed;
}

/** Entries of one entity sorted by the order its Model declares; other orders are untouched. */
export function orderEntries(spec: SpecAst, entity: string, entries: Entry[]): Entry[] {
  const order = spec.model[entity]?.order;
  if (order === undefined) return entries;
  const direction = order.direction === "newest first" ? -1 : 1;
  const key = order.field.toLowerCase();
  return entries
    .map((entry, position) => ({ entry, position }))
    .sort(
      (left, right) =>
        direction * compareValues(left.entry[1].fields.get(key), right.entry[1].fields.get(key)) ||
        left.position - right.position,
    )
    .map(({ entry }) => entry);
}

function compareValues(left: string | undefined, right: string | undefined): number {
  const leftNumber = parseNumber(left);
  const rightNumber = parseNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
  return (left ?? "").localeCompare(right ?? "");
}

/** The next value of the entity's sequence field: prefix and zero padded counter after the highest existing one. */
function nextSequenceValue(records: Entities, entity: string, sequence: SequenceInvariant): string {
  const key = sequence.field.toLowerCase();
  const used = [...records.values()]
    .filter((record) => record.entity === entity)
    .map((record) => record.fields.get(key) ?? "")
    .filter((value) => value.startsWith(sequence.prefix))
    .map((value) => value.slice(sequence.prefix.length))
    .filter((counter) => /^\d+$/.test(counter))
    .map(Number);
  const next = Math.max(0, ...used) + 1;
  return `${sequence.prefix}${String(next).padStart(sequence.width, "0")}`;
}

/** Fields a new record of `entity` starts with: first machine state, next sequence values, the user on screen and the clock. */
export function initialFields(
  spec: SpecAst,
  records: Entities,
  entity: string,
  context: NewRecordContext,
): Map<string, string> {
  const model = spec.model[entity];
  const fields = new Map<string, string>();
  for (const [field, machine] of Object.entries(model?.machines ?? {})) {
    const initial = machine.states[0];
    initial !== undefined && fields.set(field.toLowerCase(), initial);
  }
  for (const invariant of spec.invariants) {
    invariant.kind === "sequence" &&
      invariant.entity === entity &&
      fields.set(invariant.field.toLowerCase(), nextSequenceValue(records, entity, invariant));
  }
  for (const relation of userRelations(model)) {
    context.userRef !== undefined && fields.set(relation.toLowerCase(), context.userRef);
  }
  for (const field of model?.fields ?? []) {
    field.type === "datetime" && fields.set(field.name.toLowerCase(), context.now);
  }
  return fields;
}

/** Names of the entity's belongs-to relations to User. */
export function userRelations(model: EntityNode | undefined): string[] {
  return (model?.relations ?? [])
    .filter((relation) => relation.kind === "belongs-to" && relation.entity === USER_ENTITY)
    .map((relation) => relation.name);
}

/** Points every unset belongs-to User relation of every record at `userRef`. */
export function assignDefaultUsers(
  spec: SpecAst,
  records: Map<string, GivenEntity>,
  userRef: string,
): void {
  for (const record of records.values()) {
    for (const relation of userRelations(spec.model[record.entity])) {
      (record.fields.get(relation.toLowerCase()) ?? "") === "" &&
        record.fields.set(relation.toLowerCase(), userRef);
    }
  }
}
