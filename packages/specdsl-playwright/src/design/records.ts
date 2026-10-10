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
  for (const [field, value] of pending) record.fields.set(fieldKey(model, field), value);
  const key = naturalKeyField(model);
  const renamed = key === undefined ? undefined : record.fields.get(key);
  return renamed === undefined || renamed === "" || renamed === refName || records.has(renamed)
    ? refName
    : renameRecord(spec, records, refName, renamed);
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
  const role = roleOfActor(spec, actorName);
  records.has(actorName) ||
    records.set(actorName, {
      entity: "User",
      fields: new Map(role === undefined ? [] : [["role", role]]),
    });
  return actorName;
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
  for (const [field, value] of pending) fields.set(fieldKey(model, field), value);
  if (owner !== undefined) fields.set(owner.relation.toLowerCase(), owner.ref);
  const refName = uniqueRef(records, preferredRef(spec, entity, fields));
  records.set(refName, { entity, fields });
  return refName;
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
