import { holds } from "@special/specdsl-core";
import type { EntityNode, FieldNode, PredicateNode, SpecAst } from "@special/specdsl-core";
import type { Props } from "./render.js";

export interface GivenEntity {
  entity: string;
  fields: Map<string, string>;
}

type Entities = ReadonlyMap<string, GivenEntity>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Props for an artboard of the record `refName`: its fields, has-many rows, machine states, state flags and predicates, named after the model. */
export function buildProps(
  spec: SpecAst,
  entities: Entities,
  refName: string,
  today: string,
): Props {
  const record = entities.get(refName);
  if (record === undefined) return {};
  const model = spec.model[record.entity];
  const rows = relationRows(spec, entities, refName, record, today);
  return {
    ...rowOf(spec, refName, record, today),
    [camelCase(record.entity)]: displayFields(model, refName, record),
    ...Object.fromEntries(rows.map((relation) => [relation.prop, relation.rows])),
    ...Object.fromEntries(rows.flatMap(anyFlags)),
  };
}

/** Entities whose plural (`deals`) is declared in `declared` and which have no singular record prop (`deal`) declared: a list surface. */
export function listEntities(spec: SpecAst, declared: readonly string[]): string[] {
  const entityNames = Object.keys(spec.model);
  const isRecordSurface = entityNames.some((entity) => declared.includes(camelCase(entity)));
  return isRecordSurface
    ? []
    : entityNames.filter((entity) => declared.includes(pluralCamelCase(entity)));
}

/** Props for a list surface: every Given record of each listed entity, in Given order, as rows built like has-many child rows. */
export function buildListProps(
  spec: SpecAst,
  entities: Entities,
  listed: readonly string[],
  today: string,
): Props {
  return Object.fromEntries(
    listed.map((entity) => [
      pluralCamelCase(entity),
      [...entities]
        .filter(([, record]) => record.entity === entity)
        .map(([refName, record]) => ({
          ...displayFields(spec.model[entity], refName, record),
          ...rowOf(spec, refName, record, today),
        })),
    ]),
  );
}

/** Booleans and states of one record: machine fields, `is<State>` flags and `<predicate>` results. */
function rowOf(spec: SpecAst, refName: string, record: GivenEntity, today: string): Props {
  const model = spec.model[record.entity];
  return {
    name: refName,
    ...stateProps(model, record),
    ...predicateProps(spec, record, today),
  };
}

function stateProps(model: EntityNode | undefined, record: GivenEntity): Props {
  return Object.fromEntries(
    Object.entries(model?.machines ?? {}).flatMap(([field, machine]) => {
      const current = record.fields.get(field.toLowerCase());
      return [
        [camelCase(field), current],
        ...machine.states.map((state) => [`is${pascalCase(state)}`, state === current]),
      ];
    }),
  );
}

function predicateProps(spec: SpecAst, record: GivenEntity, today: string): Props {
  return Object.fromEntries(
    predicatesOf(spec, record.entity).map((predicate) => [
      camelCase(predicate.name),
      holds(predicate, Object.fromEntries(record.fields), today),
    ]),
  );
}

function predicatesOf(spec: SpecAst, entity: string): PredicateNode[] {
  return spec.derived.predicates.filter((predicate) => predicate.entity === entity);
}

interface RelationRows {
  prop: string;
  rows: Props[];
  predicateNames: string[];
}

function relationRows(
  spec: SpecAst,
  entities: Entities,
  parentRef: string,
  parent: GivenEntity,
  today: string,
): RelationRows[] {
  return (spec.model[parent.entity]?.relations ?? [])
    .filter((relation) => relation.kind === "has-many")
    .map((relation) => {
      const childModel = spec.model[relation.entity];
      const owner = childModel?.relations.find(
        (candidate) => candidate.kind === "belongs-to" && candidate.entity === parent.entity,
      );
      const children = [...entities].filter(
        ([, child]) =>
          child.entity === relation.entity &&
          owner !== undefined &&
          child.fields.get(owner.name.toLowerCase()) === parentRef,
      );
      return {
        prop: pluralCamelCase(relation.name),
        predicateNames: predicatesOf(spec, relation.entity).map((predicate) =>
          camelCase(predicate.name),
        ),
        rows: children.map(([childRef, child]) => ({
          ...displayFields(childModel, childRef, child),
          ...rowOf(spec, childRef, child, today),
        })),
      };
    });
}

function anyFlags(relation: RelationRows): [string, boolean][] {
  return relation.predicateNames.map((name) => [
    `any${pascalCase(name)}`,
    relation.rows.some((row) => row[name] === true),
  ]);
}

function displayFields(model: EntityNode | undefined, refName: string, record: GivenEntity): Props {
  const typeOf = (field: string): FieldNode | undefined =>
    model?.fields.find((candidate) => candidate.name.toLowerCase() === field);
  return {
    ...Object.fromEntries(
      [...record.fields].map(([field, value]) => [
        camelCase(field),
        displayValue(typeOf(field), value),
      ]),
    ),
    name: refName,
  };
}

function displayValue(field: FieldNode | undefined, value: string): string {
  if (field?.type === "date" || field?.type === "datetime") return formatDate(value);
  if (field?.type === "money") return formatMoney(value);
  return value;
}

/** `2026-01-20` as `20 Jan 2026`. */
export function formatDate(value: string): string {
  const parts = ISO_DATE.exec(value);
  return parts === null
    ? value
    : `${Number(parts[3])} ${MONTHS[Number(parts[2]) - 1] ?? ""} ${parts[1]}`;
}

/** `12000` as `$12,000.00`. */
export function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isNaN(amount)
    ? value
    : `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function words(text: string): string[] {
  return text.split(/[^A-Za-z0-9]+/).filter((word) => word !== "");
}

export function pascalCase(text: string): string {
  return words(text)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export function camelCase(text: string): string {
  const pascal = pascalCase(text);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function pluralCamelCase(text: string): string {
  const singular = camelCase(text);
  return /[^aeiou]y$/.test(singular) ? `${singular.slice(0, -1)}ies` : `${singular}s`;
}
