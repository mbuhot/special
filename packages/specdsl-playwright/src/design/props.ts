import { holds } from "@special/specdsl-core";
import type { EntityNode, FieldNode, PredicateNode, SpecAst } from "@special/specdsl-core";
import type { Props } from "./render.js";
import { orderEntries, parseNumber, initialFields, withComputedFields } from "./rules.js";
import type { NewRecordContext } from "./rules.js";

export interface GivenEntity {
  entity: string;
  fields: Map<string, string>;
}

type Entities = ReadonlyMap<string, GivenEntity>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_DATE_LENGTH = 10;

/** Props for an artboard of the record `refName`: its fields, has-many rows, machine states, state flags and predicates, named after the model. */
export function buildProps(
  spec: SpecAst,
  givenEntities: Entities,
  refName: string,
  today: string,
  role?: string,
): Props {
  const entities = withComputedFields(spec, givenEntities);
  const record = entities.get(refName);
  if (record === undefined) return {};
  const model = spec.model[record.entity];
  const rows = relationRows(spec, entities, refName, record, today, role);
  return {
    ...countProps(spec, entities, today),
    ...allProps(spec, entities, today, role),
    ...rowOf(spec, refName, record, today, role),
    [camelCase(record.entity)]: recordOf(spec, entities, model, refName, record, role),
    ...Object.fromEntries(rows.map((relation) => [relation.prop, relation.rows])),
    ...Object.fromEntries(rows.flatMap(anyFlags)),
  };
}

/** Props for an editor opened for a new record of `entity`: a record with its initial fields, counts and permissions. */
export function buildNewProps(
  spec: SpecAst,
  entities: Entities,
  entity: string,
  today: string,
  role?: string,
  context: NewRecordContext = { now: `${today}T00:00:00.000Z` },
): Props {
  const blank = new Map(entities);
  blank.set("", { entity, fields: initialFields(spec, entities, entity, context) });
  return buildProps(spec, blank, "", today, role);
}

export type RowFilter =
  | { prop: string; kind: "text"; text: string }
  | { prop: string; kind: "field"; field: string; value: string }
  | { prop: string; kind: "flag"; flag: string };

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
  if (filter.kind === "flag") {
    return filter.flag === "" || row[camelCase(filter.flag)] === true;
  }
  if (filter.kind === "field") {
    return filter.value === "" || row[camelCase(filter.field)] === filter.value;
  }
  const needle = filter.text.toLowerCase();
  return Object.values(row).some(
    (field) => typeof field === "string" && field.toLowerCase().includes(needle),
  );
}

/** View state held by design mode for one opened surface: flags toggled by clicks, never written to records. */
export interface ViewState {
  top: Record<string, boolean>;
  rows: Record<string, Record<string, boolean>>;
  selection?: string | undefined;
}

const SELECTED = "selected";
const MENU_OPEN = "menuOpen";
const ROW_VIEW_FLAGS = [SELECTED, MENU_OPEN, "reassignOpen"];
const SELECTION_ATTRIBUTE = /\bdata-selection="([^"]+)"/;

export function emptyViewState(): ViewState {
  return { top: {}, rows: {} };
}

/** The rows prop named by the first `data-selection` attribute of an artboard, if any. */
export function selectionPropOf(artboardHtml: string): string | undefined {
  return SELECTION_ATTRIBUTE.exec(artboardHtml)?.[1];
}

/** `not<Flag>`: the inverse flag name (`selected` gives `notSelected`). */
export function inverseName(flag: string): string {
  return `not${pascalCase(flag)}`;
}

/** Flips `flag` on the row `record`, or the top-level flag when no record is given. Opening `menuOpen` closes every other row's menu; opening any other flag except `selected` closes that row's menu. */
export function toggleViewFlag(view: ViewState, flag: string, record?: string): ViewState {
  if (record === undefined)
    return { ...view, top: { ...view.top, [flag]: view.top[flag] !== true } };
  const opening = view.rows[record]?.[flag] !== true;
  const base = withRowFlag(view, record, flag, opening);
  if (!opening || flag === SELECTED) return base;
  return flag === MENU_OPEN
    ? closeOtherMenus(base, record)
    : withRowFlag(base, record, MENU_OPEN, false);
}

/** Closes the menu and every other overlay flag on one row. */
export function closeRowOverlays(view: ViewState, record: string): ViewState {
  return ROW_VIEW_FLAGS.filter((flag) => flag !== SELECTED).reduce(
    (next, flag) => withRowFlag(next, record, flag, false),
    view,
  );
}

function withRowFlag(view: ViewState, record: string, flag: string, value: boolean): ViewState {
  return { ...view, rows: { ...view.rows, [record]: { ...view.rows[record], [flag]: value } } };
}

function closeOtherMenus(view: ViewState, record: string): ViewState {
  return Object.keys(view.rows)
    .filter((other) => other !== record)
    .reduce((next, other) => withRowFlag(next, other, MENU_OPEN, false), view);
}

function rowsOf(props: Props, prop: string): Props[] {
  const value = props[prop];
  return Array.isArray(value) ? (value as Props[]) : [];
}

/** Sets `flag` on every row of `prop` whose `matches` is true: all on when any is off, else all off. */
export function toggleAllViewFlag(
  props: Props,
  view: ViewState,
  flag: string,
  prop: string,
): ViewState {
  const matching = rowsOf(props, prop).filter((row) => row["matches"] !== false);
  const turnOn = matching.some((row) => row[flag] !== true);
  return matching.reduce((next, row) => withRowFlag(next, String(row["name"]), flag, turnOn), view);
}

/** Turns `flag` off on every row of `prop`. */
export function clearViewFlag(
  props: Props,
  view: ViewState,
  flag: string,
  prop: string,
): ViewState {
  return rowsOf(props, prop).reduce(
    (next, row) => withRowFlag(next, String(row["name"]), flag, false),
    view,
  );
}

/** Names of the rows of `prop` whose `selected` flag is on. */
export function selectedRefs(props: Props, prop: string): string[] {
  return rowsOf(props, prop)
    .filter((row) => row[SELECTED] === true)
    .map((row) => String(row["name"]));
}

/** Overlays view state on props: every row gets `selected`, `menuOpen`, `reassignOpen` and their `not` inverses; top-level flags and their inverses; `anySelected` and `selectedCount` from the rows of `view.selection`. */
export function applyViewState(props: Props, view: ViewState): Props {
  const withFlags = Object.fromEntries(
    Object.entries(props).map(([prop, value]) => [
      prop,
      Array.isArray(value) ? value.map((row: Props) => withRowViewFlags(row, view)) : value,
    ]),
  );
  const selected =
    view.selection === undefined ? 0 : selectedRefs(withFlags, view.selection).length;
  return {
    ...withFlags,
    ...Object.fromEntries(
      Object.entries(view.top).flatMap(([flag, value]) => [
        [flag, value],
        [inverseName(flag), !value],
      ]),
    ),
    anySelected: selected > 0,
    selectedCount: selected,
  };
}

function withRowViewFlags(row: Props, view: ViewState): Props {
  if (typeof row !== "object" || row === null || typeof row["name"] !== "string") return row;
  const held = view.rows[row["name"]] ?? {};
  return {
    ...row,
    ...Object.fromEntries(
      ROW_VIEW_FLAGS.flatMap((flag) => [
        [flag, held[flag] === true],
        [inverseName(flag), held[flag] !== true],
      ]),
    ),
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

/** Props for a list surface: every record of each listed entity, in the entity's declared order else Given order, as rows built like has-many child rows. */
export function buildListProps(
  spec: SpecAst,
  givenEntities: Entities,
  listed: readonly string[],
  today: string,
  role?: string,
): Props {
  const entities = withComputedFields(spec, givenEntities);
  return {
    ...countProps(spec, entities, today),
    ...allProps(spec, entities, today, role),
    ...Object.fromEntries(
      listed.map((entity) => [
        pluralCamelCase(entity),
        entityRows(spec, entities, entity, today, role),
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

function entityRows(
  spec: SpecAst,
  entities: Entities,
  entity: string,
  today: string,
  role?: string,
): Props[] {
  const entries = [...entities].filter(([, record]) => record.entity === entity);
  return orderEntries(spec, entity, entries).map(([refName, record]) =>
    rowFor(spec, entities, refName, record, today, role),
  );
}

/** `all<EntityPlural>` for every entity: every record as a row, for select options. */
function allProps(spec: SpecAst, entities: Entities, today: string, role?: string): Props {
  return Object.fromEntries(
    Object.keys(spec.model).map((entity) => [
      `all${pascalCase(pluralCamelCase(entity))}`,
      optionRows(spec, entities, entity, today, role),
    ]),
  );
}

/** Rows for select options: a record holding its own `name` field is listed under that display name. */
function optionRows(
  spec: SpecAst,
  entities: Entities,
  entity: string,
  today: string,
  role?: string,
): Props[] {
  const entries = [...entities].filter(([, record]) => record.entity === entity);
  return orderEntries(spec, entity, entries).map(([refName, record]) => ({
    ...rowFor(spec, entities, refName, record, today, role),
    name: record.fields.get("name") ?? refName,
  }));
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

/** Top-level counts: every Derived count and `<state><EntityPlural>Count` for every machine state, with `has<Count>` booleans. */
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
  const counts: [string, number][] = [...derived, ...byState];
  const flags = [
    ...derived,
    ...byState.map(([name, count]): [string, number] => [name.replace(/Count$/, ""), count]),
  ];
  return Object.fromEntries([
    ...counts,
    ...flags.map(([name, count]): [string, boolean] => [`has${pascalCase(name)}`, count > 0]),
  ]);
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
    ...relationNames(model, entities, record),
    ...Object.fromEntries(related),
    ...permissionProps(spec, record.entity, role),
  };
}

/** `<relation>` as the related record's own `name` field, for belongs-to targets that hold one. */
function relationNames(
  model: EntityNode | undefined,
  entities: Entities,
  record: GivenEntity,
): Props {
  return Object.fromEntries(
    (model?.relations ?? [])
      .filter((relation) => relation.kind === "belongs-to")
      .flatMap((relation): [string, string][] => {
        const target = entities.get(record.fields.get(relation.name.toLowerCase()) ?? "");
        const targetName = target?.fields.get("name");
        return targetName === undefined ? [] : [[camelCase(relation.name), targetName]];
      }),
  );
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

/** `<predicate>` and its inverse `not<Predicate>` for every Derived predicate of the record's entity. */
function predicateProps(spec: SpecAst, record: GivenEntity, today: string): Props {
  return Object.fromEntries(
    predicatesOf(spec, record.entity).flatMap((predicate) => {
      const holding = holds(predicate, Object.fromEntries(record.fields), today);
      return [
        [camelCase(predicate.name), holding],
        [inverseName(predicate.name), !holding],
      ];
    }),
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
        rows: orderEntries(spec, relation.entity, children).map(([childRef, child]) =>
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
    ...Object.fromEntries(
      [...record.fields].flatMap(([field, value]): [string, string][] => {
        const raw = rawValue(typeOf(field), value);
        return raw === undefined ? [] : [[`${camelCase(field)}Value`, raw]];
      }),
    ),
    name: refName,
  };
}

/** The value an input holds: ISO date for date fields, plain number for numeric fields; undefined for other types. */
function rawValue(field: FieldNode | undefined, value: string): string | undefined {
  if (field?.type === "date" || field?.type === "datetime") {
    return ISO_DATE.test(value) ? value.slice(0, ISO_DATE_LENGTH) : value;
  }
  if (field?.type === "money" || field?.type === "integer" || field?.type === "decimal") {
    return String(parseNumber(value) ?? value);
  }
  return undefined;
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
