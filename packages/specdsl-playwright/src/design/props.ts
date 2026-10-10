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
  role?: string,
): Props {
  const record = entities.get(refName);
  if (record === undefined) return {};
  const model = spec.model[record.entity];
  const rows = relationRows(spec, entities, refName, record, today, role);
  return {
    ...countProps(spec, entities, today),
    ...rowOf(spec, refName, record, today, role),
    [camelCase(record.entity)]: recordOf(spec, entities, model, refName, record, role),
    ...Object.fromEntries(rows.map((relation) => [relation.prop, relation.rows])),
    ...Object.fromEntries(rows.flatMap(anyFlags)),
  };
}

/** Props for an editor opened for a new record of `entity`: an empty record, counts and permissions. */
export function buildNewProps(
  spec: SpecAst,
  entities: Entities,
  entity: string,
  today: string,
  role?: string,
): Props {
  const blank = new Map(entities);
  blank.set("", { entity, fields: new Map() });
  return buildProps(spec, blank, "", today, role);
}

export type RowFilter =
  | { prop: string; kind: "text"; text: string }
  | { prop: string; kind: "field"; field: string; value: string };

/** Sets `matches` on every row of each filtered prop: true when the row satisfies all filters of that prop. */
export function applyRowFilters(props: Props, filters: readonly RowFilter[]): Props {
  return Object.fromEntries(
    Object.entries(props).map(([prop, value]) => {
      const applicable = filters.filter((filter) => filter.prop === prop);
      return [
        prop,
        applicable.length === 0 || !Array.isArray(value)
          ? value
          : value.map((row: Props) => ({
              ...row,
              matches: applicable.every((filter) => rowMatches(row, filter)),
            })),
      ];
    }),
  );
}

function rowMatches(row: Props, filter: RowFilter): boolean {
  if (filter.kind === "field") {
    return filter.value === "" || row[camelCase(filter.field)] === filter.value;
  }
  const needle = filter.text.toLowerCase();
  return Object.values(row).some(
    (field) => typeof field === "string" && field.toLowerCase().includes(needle),
  );
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
  role?: string,
): Props {
  return {
    ...countProps(spec, entities, today),
    ...Object.fromEntries(
      listed.map((entity) => [
        pluralCamelCase(entity),
        [...entities]
          .filter(([, record]) => record.entity === entity)
          .map(([refName, record]) => rowFor(spec, entities, refName, record, today, role)),
      ]),
    ),
    ...Object.fromEntries(
      listed.map((entity) => [
        `canCreate${pascalCase(entity)}`,
        permittedActions(spec, entity, role).includes("create"),
      ]),
    ),
  };
}

function rowFor(
  spec: SpecAst,
  entities: Entities,
  refName: string,
  record: GivenEntity,
  today: string,
  role?: string,
): Props {
  return {
    ...recordOf(spec, entities, spec.model[record.entity], refName, record, role),
    ...rowOf(spec, refName, record, today, role),
  };
}

/** Top-level counts: every Derived count and `<state><EntityPlural>Count` for every machine state. */
function countProps(spec: SpecAst, entities: Entities, today: string): Props {
  const records = [...entities.values()];
  const derived = spec.derived.counts.map((count): [string, number] => {
    const predicate = spec.derived.predicates.find(
      (candidate) => candidate.entity === count.entity && candidate.name === count.predicate,
    );
    return [
      camelCase(count.name),
      records.filter(
        (record) =>
          record.entity === count.entity &&
          predicate !== undefined &&
          holds(predicate, Object.fromEntries(record.fields), today),
      ).length,
    ];
  });
  const byState = Object.entries(spec.model).flatMap(([entity, model]) =>
    Object.entries(model.machines).flatMap(([field, machine]) =>
      machine.states.map((state): [string, number] => [
        `${camelCase(state)}${pascalCase(pluralCamelCase(entity))}Count`,
        records.filter(
          (record) => record.entity === entity && record.fields.get(field.toLowerCase()) === state,
        ).length,
      ]),
    ),
  );
  return Object.fromEntries([...derived, ...byState]);
}

/** Actions the role may perform on the entity. */
function permittedActions(spec: SpecAst, entity: string, role?: string): string[] {
  return role === undefined ? [] : (spec.policies[entity]?.[role] ?? []);
}

/** `can<Action>` for every action any role has on the entity, true when the viewer's role has it. */
function permissionProps(spec: SpecAst, entity: string, role?: string): Props {
  const allowed = permittedActions(spec, entity, role);
  const everyAction = new Set(Object.values(spec.policies[entity] ?? {}).flat());
  return Object.fromEntries(
    [...everyAction].map((action) => [`can${pascalCase(action)}`, allowed.includes(action)]),
  );
}

/** Fields of the record plus the related record of each belongs-to relation as `<relation>Record`. */
function recordOf(
  spec: SpecAst,
  entities: Entities,
  model: EntityNode | undefined,
  refName: string,
  record: GivenEntity,
  role?: string,
): Props {
  const related = (model?.relations ?? [])
    .filter((relation) => relation.kind === "belongs-to")
    .flatMap((relation): [string, Props][] => {
      const target = entities.get(record.fields.get(relation.name.toLowerCase()) ?? "");
      return target === undefined
        ? []
        : [
            [
              `${camelCase(relation.name)}Record`,
              displayFields(
                spec.model[target.entity],
                record.fields.get(relation.name.toLowerCase()) as string,
                target,
              ),
            ],
          ];
    });
  return {
    ...displayFields(model, refName, record),
    ...Object.fromEntries(related),
    ...permissionProps(spec, record.entity, role),
  };
}

/** Booleans and states of one record: machine fields, `is<State>` flags and `<predicate>` results. */
function rowOf(
  spec: SpecAst,
  refName: string,
  record: GivenEntity,
  today: string,
  role?: string,
): Props {
  const model = spec.model[record.entity];
  return {
    name: refName,
    matches: true,
    ...permissionProps(spec, record.entity, role),
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
  role?: string,
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
        rows: children.map(([childRef, child]) =>
          rowFor(spec, entities, childRef, child, today, role),
        ),
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
