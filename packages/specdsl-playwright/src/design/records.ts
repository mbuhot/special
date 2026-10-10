import type { EntityNode, SpecAst } from "@special/specdsl-core";
import { camelCase, pluralCamelCase } from "./props.js";
import type { GivenEntity } from "./props.js";
import { initialFields, naturalKeyField } from "./rules.js";
import type { NewRecordContext } from "./rules.js";

export type Records = Map<string, GivenEntity>;
export type PendingFields = ReadonlyMap<string, string>;

const NAME_FIELDS = ["name", "title"];

/** The role of the named actor in the spec, matched case-insensitively on the actor's `Role` field. */
export function roleOfActor(spec: SpecAst, actorName: string): string | undefined {
  const actor = spec.actors[actorName];
  const entry = Object.entries(actor ?? {}).find(([key]) => key.toLowerCase() === "role");
  return typeof entry?.[1] === "string" ? entry[1] : undefined;
}

/** The display name declared for the named actor, when its `Name` field is present. */
export function nameOfActor(spec: SpecAst, actorName: string): string | undefined {
  const name = spec.actors[actorName]?.["Name"];
  return typeof name === "string" ? name : undefined;
}

/** The entity an editor surface edits: the surface name's first word matched against model entities. */
export function editorEntity(spec: SpecAst, surfaceName: string): string | undefined {
  const firstWord = surfaceName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return /\beditor\b/i.test(surfaceName)
    ? Object.keys(spec.model).find((entity) => entity.toLowerCase() === firstWord)
    : undefined;
}

/** The record key of a field of `entity` as stored in Given fields (lowercase model name), for a camelCase or spaced name. */
export function fieldKey(model: EntityNode | undefined, name: string): string {
  const wanted = camelCase(name);
  const declared = [...(model?.fields ?? []), ...(model?.relations ?? [])].find(
    (candidate) => camelCase(candidate.name) === wanted,
  );
  return (declared?.name ?? name).toLowerCase();
}

/** Applies pending field values to an existing record; a changed natural key renames the record. Returns the record's ref after the save. */
export function saveRecord(
  spec: SpecAst,
  records: Records,
  refName: string,
  pending: PendingFields,
): string {
  const record = records.get(refName);
  if (record === undefined) return refName;
  const model = spec.model[record.entity];
  for (const [field, value] of pending) {
    const key = fieldKey(model, field);
    record.fields.set(key, relationRef(spec, records, model, key, value));
  }
  const key = naturalKeyField(model);
  const renamed = key === undefined ? undefined : record.fields.get(key);
  return renamed === undefined || renamed === "" || renamed === refName || records.has(renamed)
    ? refName
    : renameRecord(spec, records, refName, renamed);
}

/** The ref a belongs-to select value names: the value itself when it is a record's ref, else the target record whose own `name` field shows it (a user listed by display name); other fields keep the value. */
export function relationRef(
  spec: SpecAst,
  records: Records,
  model: EntityNode | undefined,
  key: string,
  value: string,
): string {
  const relation = (model?.relations ?? []).find(
    (candidate) => candidate.kind === "belongs-to" && candidate.name.toLowerCase() === key,
  );
  if (relation === undefined || records.has(value)) return value;
  const named = [...records].find(
    ([, candidate]) =>
      candidate.entity === relation.entity && candidate.fields.get("name") === value,
  );
  return named?.[0] ?? value;
}

/** Re-keys a record under `newRef`, keeping its position and repointing every belongs-to relation that held the old ref. */
function renameRecord(spec: SpecAst, records: Records, oldRef: string, newRef: string): string {
  const entries = [...records];
  records.clear();
  for (const [ref, record] of entries) {
    for (const relation of spec.model[record.entity]?.relations ?? []) {
      const key = relation.name.toLowerCase();
      relation.kind === "belongs-to" &&
        record.fields.get(key) === oldRef &&
        record.fields.set(key, newRef);
    }
    records.set(ref === oldRef ? newRef : ref, record);
  }
  return newRef;
}

/** Ensures the actor has a User record named after the actor, holding the actor's role; returns its ref. */
export function ensureActorUser(
  spec: SpecAst,
  records: Records,
  actorName: string,
): string | undefined {
  if (spec.model["User"] === undefined) return undefined;
  const existing = records.get(actorName);
  existing === undefined
    ? records.set(actorName, { entity: "User", fields: new Map(userFields(spec, actorName)) })
    : fillMissingFields(existing.fields, userFields(spec, actorName), actorName);
  return actorName;
}

/** Gives every Given user whose ref is an actor's name that actor's role and display name. */
export function ensureGivenActorUsers(spec: SpecAst, records: Records): void {
  for (const [ref, record] of [...records]) {
    record.entity === "User" &&
      spec.actors[ref] !== undefined &&
      ensureActorUser(spec, records, ref);
  }
}

/** Creates a record of `entity` from the pending values it has fields for, named by its name, title or natural key; returns its ref. */
export function createRecord(
  spec: SpecAst,
  records: Records,
  entity: string,
  pending: PendingFields,
  owner?: { relation: string; ref: string },
  context: NewRecordContext = { now: new Date().toISOString() },
): string {
  const model = spec.model[entity];
  const fields = initialFields(spec, records, entity, context);
  for (const [field, value] of pending) {
    const key = fieldKey(model, field);
    fields.set(key, relationRef(spec, records, model, key, value));
  }
  if (owner !== undefined) fields.set(owner.relation.toLowerCase(), owner.ref);
  const refName = uniqueRef(records, preferredRef(spec, entity, fields));
  records.set(refName, { entity, fields });
  return refName;
}

/** Runs the spec's effects triggered by moving `refName` into `nextState`: each creates its target record under the first owner reached through the record's relation, with `{field}` placeholders filled from the record. */
export function applyEffects(
  spec: SpecAst,
  records: Records,
  refName: string,
  nextState: string,
  context: NewRecordContext,
): void {
  const record = records.get(refName);
  if (record === undefined) return;
  for (const effect of spec.effects) {
    const triggered =
      effect.entity === record.entity &&
      effect.state === nextState &&
      spec.model[record.entity]?.machines[effect.field] !== undefined;
    const parentRef = record.fields.get(effect.relation.toLowerCase());
    const ownerRef = [...records].find(
      ([, candidate]) =>
        candidate.entity === effect.owner &&
        candidate.fields.get(effect.ownerRelation.toLowerCase()) === parentRef,
    )?.[0];
    triggered &&
      parentRef !== undefined &&
      ownerRef !== undefined &&
      createRecord(
        spec,
        records,
        effect.target,
        new Map(effect.values.map(({ field, value }) => [field, filled(record, value)])),
        { relation: effect.targetRelation, ref: ownerRef },
        context,
      );
  }
}

function filled(record: GivenEntity, template: string): string {
  return template.replace(
    /\{([^{}]+)\}/g,
    (_, field: string) => record.fields.get(field.toLowerCase()) ?? "",
  );
}

/** The state of `entity`'s machine `field` that `text` names (a state or its option label, ignoring case), when `field` is a machine field. */
export function stateNamed(
  spec: SpecAst,
  entity: string,
  field: string,
  text: string,
): string | undefined {
  const machine = Object.entries(spec.model[entity]?.machines ?? {}).find(
    ([name]) => camelCase(name) === camelCase(field),
  )?.[1];
  return machine?.states.find((state) => state.toLowerCase() === text.trim().toLowerCase());
}

/** The names of pending fields that `entity` declares as fields or relations. */
export function ownedFields(
  spec: SpecAst,
  entity: string,
  pending: PendingFields,
): Map<string, string> {
  const model = spec.model[entity];
  const declared = new Set(
    [...(model?.fields ?? []), ...(model?.relations ?? [])].map((member) => camelCase(member.name)),
  );
  return new Map([...pending].filter(([field]) => declared.has(camelCase(field))));
}

/** The has-many relation of `parentEntity` whose plural prop is `plural`, with the child's belongs-to relation back to the parent. */
export function childRelation(
  spec: SpecAst,
  parentEntity: string,
  plural: string,
): { child: string; owner: string } | undefined {
  const relation = (spec.model[parentEntity]?.relations ?? []).find(
    (candidate) => candidate.kind === "has-many" && pluralCamelCase(candidate.name) === plural,
  );
  const owner = spec.model[relation?.entity ?? ""]?.relations.find(
    (candidate) => candidate.kind === "belongs-to" && candidate.entity === parentEntity,
  );
  return relation === undefined || owner === undefined
    ? undefined
    : { child: relation.entity, owner: owner.name };
}

/** The entity whose plural prop name is `plural`. */
export function entityOfPlural(spec: SpecAst, plural: string): string | undefined {
  return Object.keys(spec.model).find((entity) => pluralCamelCase(entity) === plural);
}

function preferredRef(spec: SpecAst, entity: string, fields: ReadonlyMap<string, string>): string {
  const naturalKeys = spec.invariants.flatMap((invariant) =>
    invariant.kind === "unique" && invariant.entity === entity
      ? [invariant.field.toLowerCase()]
      : [],
  );
  const naturalKey = naturalKeyField(spec.model[entity]);
  const candidates = [
    ...NAME_FIELDS,
    ...(naturalKey === undefined ? [] : [naturalKey]),
    ...naturalKeys,
  ];
  const key = candidates.find((candidate) => (fields.get(candidate) ?? "") !== "");
  return key === undefined ? entity : (fields.get(key) as string);
}

function uniqueRef(records: Records, wanted: string): string {
  let candidate = wanted;
  for (let suffix = 2; records.has(candidate); suffix += 1) candidate = `${wanted} ${suffix}`;
  return candidate;
}

function fillMissingFields(
  fields: Map<string, string>,
  defaults: [string, string][],
  naturalKey: string,
): void {
  for (const [key, value] of defaults) {
    const current = fields.get(key);
    (current === undefined || current === naturalKey) && fields.set(key, value);
  }
}

function userFields(spec: SpecAst, actorName: string): [string, string][] {
  const role = roleOfActor(spec, actorName);
  const name = nameOfActor(spec, actorName);
  const hasName = spec.model["User"]?.fields.some((field) => field.name === "name") === true;
  return [
    ...(role === undefined ? [] : [["role", role] as [string, string]]),
    ...(name === undefined || !hasName ? [] : [["name", name] as [string, string]]),
  ];
}
