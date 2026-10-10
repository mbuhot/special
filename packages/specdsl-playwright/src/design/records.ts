import type { EntityNode, SpecAst } from "@special/specdsl-core";
import { camelCase, pluralCamelCase } from "./props.js";
import type { GivenEntity } from "./props.js";

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

/** Applies pending field values to an existing record. */
export function saveRecord(
  spec: SpecAst,
  records: Records,
  refName: string,
  pending: PendingFields,
): void {
  const record = records.get(refName);
  if (record === undefined) return;
  const model = spec.model[record.entity];
  for (const [field, value] of pending) record.fields.set(fieldKey(model, field), value);
}

/** Creates a record of `entity` from the pending values it has fields for, named by its name, title or natural key; returns its ref. */
export function createRecord(
  spec: SpecAst,
  records: Records,
  entity: string,
  pending: PendingFields,
  owner?: { relation: string; ref: string },
): string {
  const model = spec.model[entity];
  const fields = new Map<string, string>();
  for (const machine of Object.entries(model?.machines ?? {})) {
    const initial = machine[1].states[0];
    if (initial !== undefined) fields.set(machine[0].toLowerCase(), initial);
  }
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
  const candidates = [...NAME_FIELDS, ...naturalKeys];
  const key = candidates.find((candidate) => (fields.get(candidate) ?? "") !== "");
  return key === undefined ? entity : (fields.get(key) as string);
}

function uniqueRef(records: Records, wanted: string): string {
  let candidate = wanted;
  for (let suffix = 2; records.has(candidate); suffix += 1) candidate = `${wanted} ${suffix}`;
  return candidate;
}
