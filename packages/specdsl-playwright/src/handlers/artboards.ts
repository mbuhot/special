import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { artboardStates } from "@special/specdsl-core";
import type { SpecAst } from "@special/specdsl-core";
import type {
  ContextHandlers,
  EntityPair,
  ResolvedControl,
  ResolvedSurface,
  ScenarioEnv,
  StepHandlers,
} from "../runtime.js";
import {
  applyRowFilters,
  applyViewState,
  buildListProps,
  buildNewProps,
  buildProps,
  camelCase,
  clearViewFlag,
  closeRowOverlays,
  emptyViewState,
  listEntities,
  selectedRefs,
  selectionPropOf,
  toggleAllViewFlag,
  toggleViewFlag,
} from "../design/props.js";
import type { GivenEntity, RowFilter, ViewState } from "../design/props.js";
import {
  applyEffects,
  childRelation,
  createRecord,
  editorEntity,
  entityOfPlural,
  ownedFields,
  ensureActorUser,
  ensureGivenActorUsers,
  roleOfActor,
  saveRecord,
  stateNamed,
} from "../design/records.js";
import { assignDefaultUsers, withNaturalKey } from "../design/rules.js";
import type { NewRecordContext } from "../design/rules.js";
import { propDefaults, renderArtboard } from "../design/render.js";
import type { Props } from "../design/render.js";
import { durationMilliseconds } from "./web-app.js";
import type { WebAppContextStates, WebAppServices, WebAppStepArgs } from "./web-app.js";

const ARTBOARD_SUFFIX = ".dc.html";
const DEFAULT_STATE = "default";
const HIGHLIGHT_HOLD_MILLISECONDS = 900;
const CONTROL_TIMEOUT_MILLISECONDS = 2_000;
const MISMATCH_HOLD_MILLISECONDS = 2_000;
const MISMATCH_OUTLINE = "4px solid #dc2626";
const MISMATCH_CAPTION_LIMIT = 160;

export interface Mismatch {
  line: number;
  step: string;
  artboard: string;
  expected: string;
  found: string;
}

/** Mismatches recorded while a scenario walks the artboards, tagged with the step line being performed. */
export class MismatchLog {
  currentLine = 0;
  readonly entries: Mismatch[] = [];

  record(step: string, artboard: string, expected: string, found: string): void {
    this.entries.push({ line: this.currentLine, step, artboard, expected, found });
  }
}

export interface DesignServices extends WebAppServices {
  designsDirectory: string;
  log: MismatchLog;
}

type Env = ScenarioEnv<DesignServices, WebAppContextStates>;

interface View {
  design: string;
  state: string;
  surface: string;
  actor: string;
  ref?: string | undefined;
  creating?: string | undefined;
}

interface TypedInput {
  kind: "field" | "filter";
  action: "fill" | "select";
  value: string;
}

interface Session {
  pending: Map<string, Map<string, string>>;
  filters: RowFilter[];
  inputs: Map<string, TypedInput>;
  view: ViewState;
}

const SURFACE_KEY = "";
const SELECTION_KEY_PREFIX = "selection:";
const SELECTED_FLAG = "selected";

interface ScenarioStore {
  entities: Map<string, GivenEntity>;
  now: Date;
  firstActor?: string;
}

const viewByPage = new WeakMap<Page, View>();
const storeByRefs = new WeakMap<object, ScenarioStore>();
const propsByPage = new WeakMap<Page, Props>();
const routedPages = new WeakSet<Page>();
const sessionByPage = new WeakMap<Page, Session>();

/** Rewrites every control's css locator to its `data-control` selector so highlights and lookups target artboard markup. */
export function designLocators(spec: SpecAst): SpecAst {
  const surfaces = Object.fromEntries(
    Object.entries(spec.surfaces).map(([surfaceName, surface]) => [
      surfaceName,
      {
        ...surface,
        controls: Object.fromEntries(
          Object.entries(surface.controls).map(([controlName, control]) => [
            controlName,
            { ...control, locators: { css: controlSelector(controlName) } },
          ]),
        ),
      },
    ]),
  );
  return { ...spec, surfaces };
}

export const designContexts: ContextHandlers<DesignServices, WebAppContextStates> = {
  app: {
    async setup(env) {
      return { baseURL: env.services.baseURL };
    },
  },
  data: {
    async setup() {
      return { resetAt: new Date() };
    },
  },
  clock: {
    async setup(_env, request) {
      return { now: new Date(request.config["DateTime"] ?? Date.now()) };
    },
  },
  actor: {
    async setup(env, request) {
      const { browser, recording } = env.services;
      const context = await browser.newContext({
        ...(recording === undefined
          ? {}
          : {
              viewport: recording.size,
              recordVideo: { dir: recording.directory, size: recording.size },
            }),
      });
      const recordingStartedAt = Date.now();
      const page = await context.newPage();
      return { context, page, email: request.key ?? "", recordingStartedAt };
    },
    async teardown(state) {
      await state.context.close();
    },
  },
};

export const designSteps: StepHandlers<WebAppStepArgs, DesignServices, WebAppContextStates> = {
  async opens(args, env) {
    const design = designOf(args.Surface);
    const creating = args.Ref === undefined ? editorEntity(env.spec, args.Surface.name) : undefined;
    const ref = creating === undefined ? recordRefFor(env, design, args.Ref) : undefined;
    const state = stateFor(env, design, ref);
    await load(env, args.Actor, {
      design,
      state,
      surface: args.Surface.name,
      actor: args.Actor,
      ref,
      creating,
    });
  },
  async "is-on"(args, env) {
    const page = pageOf(env, args.Actor);
    const found = await page
      .locator("[data-surface]")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-surface")));
    if (!found.includes(args.Surface.name)) {
      await flagMismatch(
        env,
        args.Actor,
        "is-on",
        `surface ${args.Surface.name}`,
        found.join(", "),
      );
    }
  },
  async enters(args, env) {
    const control = await existing(env, args.Actor, args.Control);
    const tag = await tagOf(control);
    if (tag !== "input" && tag !== "textarea") return;
    await control.fill(args.Value);
    await applyEdit(env, args.Actor, control, selectorOf(args.Control), "fill", args.Value);
  },
  async clicks(args, env) {
    const page = pageOf(env, args.Actor);
    const located = await existing(env, args.Actor, args.Control);
    await page.waitForTimeout(HIGHLIGHT_HOLD_MILLISECONDS);
    const control = await clickTarget(env, page, args.Control, located);
    const href = await control.getAttribute("href");
    const nextState = await control.getAttribute("data-next-state");
    const record = (await control.getAttribute("data-record")) || undefined;
    const mutation = await mutationOf(control);
    const viewClick = await viewClickOf(control);
    const selection = await control.getAttribute("data-selection");
    if (viewClick !== undefined) {
      await applyViewClick(env, args.Actor, page, viewClick, record);
    } else if (mutation !== undefined) {
      await applyMutation(env, args.Actor, page, mutation, record);
    } else if (href?.endsWith(ARTBOARD_SUFFIX) === true) {
      await followLink(env, args.Actor, page, href, record);
    } else if (nextState !== null && selection !== null) {
      await advanceSelected(env, args.Actor, page, selection, nextState);
    } else if (nextState !== null) {
      await advanceState(env, args.Actor, viewOf(page), nextState, record);
    }
  },
  async selects(args, env) {
    const control = await existing(env, args.Actor, args.Control);
    if ((await tagOf(control)) !== "select") return;
    await control.selectOption({ label: args.Value });
    const optionValue = await control.evaluate(
      (element) => (element as HTMLSelectElement).selectedOptions[0]?.value ?? "",
    );
    await applyEdit(env, args.Actor, control, selectorOf(args.Control), "select", args.Value, {
      emptyOption: optionValue === "",
      optionValue,
    });
  },
  async sees(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    if (!found.includes(args.Text)) {
      await flagMismatch(
        env,
        args.Actor,
        "sees",
        `"${args.Text}" in ${args.Control.name}`,
        found,
        args.Control,
      );
    }
  },
  async "sees-before"(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    const ordered =
      found.includes(args.Text) && found.indexOf(args.Text) < found.indexOf(args.Other);
    if (!ordered || !found.includes(args.Other)) {
      await flagMismatch(
        env,
        args.Actor,
        "sees-before",
        `"${args.Text}" before "${args.Other}" in ${args.Control.name}`,
        found,
        args.Control,
      );
    }
  },
  async "no-longer-sees"(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    if (found.includes(args.Text)) {
      await flagMismatch(
        env,
        args.Actor,
        "no-longer-sees",
        `no "${args.Text}" in ${args.Control.name}`,
        found,
        args.Control,
      );
    }
  },
  async "given-entity"(args, env) {
    const given = givenOf(env);
    given.set(args.Ref, {
      entity: args.Entity,
      fields: withNaturalKey(env.spec.model[args.Entity], args.Ref, fieldMap(args.pairs)),
    });
    env.refs.declare(args.Ref, { entity: args.Entity, id: args.Ref });
  },
  async "has-field"() {},
  async may() {},
  async "may-not"() {},
  async "is-predicate"() {},
  async "is-not-predicate"() {},
  async "does-not-see"(args, env) {
    const page = pageOf(env, args.Actor);
    if ((await page.locator(selectorOf(args.Control)).count()) > 0) {
      await flagMismatch(
        env,
        args.Actor,
        "does-not-see",
        `no ${args.Control.name}`,
        "present",
        args.Control,
      );
    }
  },
  async "time-advances"(args, env) {
    const store = storeOf(env);
    store.now = new Date(store.now.getTime() + durationMilliseconds(args.Duration));
  },
  async "job-runs"() {},
};

function controlSelector(controlName: string): string {
  return `[data-control="${controlName.replace(/["\\]/g, "\\$&")}"]`;
}

function selectorOf(control: ResolvedControl): string {
  const selector = control.locators["css"];
  if (selector === undefined) throw new Error(`control "${control.name}" has no locator`);
  return selector;
}

function designOf(surface: ResolvedSurface): string {
  if (surface.design === undefined) throw new Error(`surface "${surface.name}" has no design`);
  return surface.design;
}

function pageOf(env: Env, actorName: string): Page {
  return env.context("actor", actorName).page;
}

function viewOf(page: Page): View {
  const view = viewByPage.get(page);
  if (view === undefined) throw new Error("no artboard is open");
  return view;
}

function artboardLabel(page: Page): string {
  const view = viewByPage.get(page);
  return view === undefined ? "(none)" : `${view.design}/${view.state}`;
}

async function existing(env: Env, actorName: string, control: ResolvedControl): Promise<Locator> {
  const page = pageOf(env, actorName);
  const located = (await controlMatches(page, control)).first();
  try {
    await located.waitFor({ state: "attached", timeout: CONTROL_TIMEOUT_MILLISECONDS });
  } catch {
    throw new Error(`control "${control.name}" is not in artboard ${artboardLabel(page)}`);
  }
  return located;
}

/** The matches of a control inside the open surface's region when it has any, else anywhere on the page. */
async function controlMatches(page: Page, control: ResolvedControl): Promise<Locator> {
  const surface = viewByPage.get(page)?.surface;
  if (surface !== undefined) {
    const scoped = page.locator(
      `[data-surface="${surface.replace(/["\\]/g, "\\$&")}"] ${selectorOf(control)}`,
    );
    if ((await scoped.count()) > 0) return scoped;
  }
  return page.locator(selectorOf(control));
}

/** Among several matches of a control, the one on the card of the only record not yet in a final state, else the first. */
async function clickTarget(
  env: Env,
  page: Page,
  control: ResolvedControl,
  first: Locator,
): Promise<Locator> {
  const matches = await controlMatches(page, control);
  if ((await matches.count()) < 2) return first;
  const open = openRecordRefs(env);
  if (open.length !== 1) return first;
  const onCard = page.locator(`${selectorOf(control)}[data-record="${open[0]}"]`).first();
  return (await onCard.count()) > 0 ? onCard : first;
}

function openRecordRefs(env: Env): string[] {
  return [...givenOf(env).entries()]
    .filter(([, record]) =>
      Object.entries(env.spec.model[record.entity]?.machines ?? {}).some(([field, machine]) =>
        machine.transitions.some(
          (transition) => transition.from === record.fields.get(field.toLowerCase()),
        ),
      ),
    )
    .map(([refName]) => refName);
}

async function tagOf(control: Locator): Promise<string> {
  return control.evaluate((element) => element.tagName.toLowerCase());
}

async function textOf(control: Locator): Promise<string> {
  return control.evaluate((element) => {
    const rendered = (element as HTMLElement).innerText ?? element.textContent ?? "";
    const fields = [element, ...element.querySelectorAll("input, textarea, select")].filter(
      (candidate): candidate is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
        ["INPUT", "TEXTAREA", "SELECT"].includes(candidate.tagName),
    );
    const held = fields.map((field) =>
      field instanceof HTMLSelectElement ? (field.selectedOptions[0]?.text ?? "") : field.value,
    );
    return [rendered, ...held].join(" ").replace(/\s+/g, " ").trim();
  });
}

function storeOf(env: Env): ScenarioStore {
  const existingStore = storeByRefs.get(env.refs);
  if (existingStore !== undefined) return existingStore;
  const created = { entities: new Map<string, GivenEntity>(), now: scenarioStart(env.spec) };
  storeByRefs.set(env.refs, created);
  return created;
}

function givenOf(env: Env): Map<string, GivenEntity> {
  return storeOf(env).entities;
}

function scenarioStart(spec: SpecAst): Date {
  const configured = spec.contexts["clock"]?.["DateTime"];
  return new Date(configured ?? Date.now());
}

function fieldMap(pairs: readonly EntityPair[]): Map<string, string> {
  return new Map(pairs.map(([field, value]) => [field.toLowerCase(), value]));
}

function stateFor(env: Env, design: string, refName: string | undefined): string {
  const states = artboardStates(join(env.services.designsDirectory, design));
  if (states.length === 0) throw new Error(`no artboard in designs/${design}`);
  const machineState = refName === undefined ? undefined : machineStateOf(env, refName);
  const wanted = [machineState, DEFAULT_STATE].find(
    (candidate) => candidate !== undefined && states.includes(candidate),
  );
  return wanted ?? (states[0] as string);
}

function listedEntities(env: Env, design: string): string[] {
  const file = join(env.services.designsDirectory, design, `${DEFAULT_STATE}${ARTBOARD_SUFFIX}`);
  return existsSync(file)
    ? listEntities(env.spec, Object.keys(propDefaults(readFileSync(file, "utf8"))))
    : [];
}

function recordRefFor(env: Env, design: string, refName: string | undefined): string | undefined {
  if (refName !== undefined) return refName;
  if (listedEntities(env, design).length > 0) return undefined;
  const states = artboardStates(join(env.services.designsDirectory, design));
  const withMachine = [...givenOf(env).keys()].filter(
    (candidate) => machineStateOf(env, candidate) !== undefined,
  );
  return (
    withMachine.find((candidate) => states.includes(machineStateOf(env, candidate) as string)) ??
    withMachine[0]
  );
}

function machineStateOf(env: Env, refName: string): string | undefined {
  const given = givenOf(env).get(refName);
  if (given === undefined) return undefined;
  const machines = env.spec.model[given.entity]?.machines ?? {};
  return Object.keys(machines)
    .map((field) => given.fields.get(field.toLowerCase()))
    .find((value) => value !== undefined);
}

async function load(env: Env, actorName: string, view: View, keepSession = false): Promise<void> {
  const file = join(env.services.designsDirectory, view.design, `${view.state}${ARTBOARD_SUFFIX}`);
  if (!existsSync(file)) {
    throw new Error(`artboard designs/${view.design}/${view.state}${ARTBOARD_SUFFIX} is missing`);
  }
  const page = pageOf(env, actorName);
  routeRenderedArtboards(env, page);
  keepSession || sessionByPage.set(page, emptySession());
  const session = sessionOf(page);
  session.view.selection ??= selectionPropOf(readFileSync(file, "utf8"));
  propsByPage.set(page, propsFor(env, view, session));
  await page.goto(`${env.services.baseURL}/${view.design}/${view.state}${ARTBOARD_SUFFIX}`);
  viewByPage.set(page, view);
  keepSession && (await restoreInputs(page));
}

function emptySession(): Session {
  return { pending: new Map(), filters: [], inputs: new Map(), view: emptyViewState() };
}

function sessionOf(page: Page): Session {
  const existingSession = sessionByPage.get(page);
  if (existingSession !== undefined) return existingSession;
  const created = emptySession();
  sessionByPage.set(page, created);
  return created;
}

async function restoreInputs(page: Page): Promise<void> {
  for (const [selector, input] of sessionOf(page).inputs) {
    const control = page.locator(selector).first();
    if ((await control.count()) === 0) continue;
    await (input.action === "fill"
      ? control.fill(input.value)
      : control.selectOption({ label: input.value }));
  }
}

function prepareUsers(env: Env, actorName: string): NewRecordContext {
  const store = storeOf(env);
  store.firstActor ??= actorName;
  ensureGivenActorUsers(env.spec, store.entities);
  const firstUser = ensureActorUser(env.spec, store.entities, store.firstActor);
  const viewerUser = ensureActorUser(env.spec, store.entities, actorName);
  firstUser !== undefined && assignDefaultUsers(env.spec, store.entities, firstUser);
  return { now: store.now.toISOString(), userRef: viewerUser };
}

function propsFor(env: Env, view: View, session: Session): Props {
  const today = storeOf(env).now.toISOString().slice(0, 10);
  const role = roleOfActor(env.spec, view.actor);
  const context = prepareUsers(env, view.actor);
  const base =
    view.creating !== undefined
      ? buildNewProps(env.spec, givenOf(env), view.creating, today, role, context)
      : view.ref === undefined
        ? buildListProps(
            env.spec,
            givenOf(env),
            listedEntities(env, view.design),
            today,
            role,
            context.userRef,
          )
        : buildProps(env.spec, givenOf(env), view.ref, today, role, context.userRef);
  return applyViewState(applyRowFilters(base, session.filters), session.view);
}

type Mutation =
  | { kind: "saves"; selection: string | undefined }
  | { kind: "creates"; target: string }
  | { kind: "removes" };

async function mutationOf(control: Locator): Promise<Mutation | undefined> {
  const attributes = await control.evaluate((element) => ({
    saves: element.hasAttribute("data-saves"),
    creates: element.getAttribute("data-creates"),
    removes: element.hasAttribute("data-removes"),
    selection: element.getAttribute("data-selection") ?? undefined,
  }));
  if (attributes.saves) return { kind: "saves", selection: attributes.selection };
  if (attributes.creates !== null) return { kind: "creates", target: attributes.creates };
  return attributes.removes ? { kind: "removes" } : undefined;
}

type ViewClick =
  | { kind: "toggles"; flag: string }
  | { kind: "toggles-all"; flag: string; selection: string }
  | { kind: "clears"; flag: string; selection: string };

async function viewClickOf(control: Locator): Promise<ViewClick | undefined> {
  const attributes = await control.evaluate((element) => ({
    toggles: element.getAttribute("data-toggles"),
    togglesAll: element.getAttribute("data-toggles-all"),
    clears: element.getAttribute("data-clears"),
    selection: element.getAttribute("data-selection"),
  }));
  if (attributes.toggles !== null) return { kind: "toggles", flag: attributes.toggles };
  if (attributes.selection === null) return undefined;
  if (attributes.togglesAll !== null) {
    return { kind: "toggles-all", flag: attributes.togglesAll, selection: attributes.selection };
  }
  return attributes.clears === null
    ? undefined
    : { kind: "clears", flag: attributes.clears, selection: attributes.selection };
}

async function applyViewClick(
  env: Env,
  actorName: string,
  page: Page,
  click: ViewClick,
  record: string | undefined,
): Promise<void> {
  const session = sessionOf(page);
  const props = propsByPage.get(page) ?? {};
  session.view =
    click.kind === "toggles"
      ? toggleViewFlag(session.view, click.flag, record)
      : click.kind === "toggles-all"
        ? toggleAllViewFlag(props, session.view, click.flag, click.selection)
        : clearViewFlag(props, session.view, click.flag, click.selection);
  await load(env, actorName, viewOf(page), true);
}

async function advanceSelected(
  env: Env,
  actorName: string,
  page: Page,
  selection: string,
  nextState: string,
): Promise<void> {
  for (const ref of selectedRefs(propsByPage.get(page) ?? {}, selection)) {
    moveRecord(env, actorName, ref, nextState);
  }
  await finishBulk(env, actorName, page, selection);
}

async function finishBulk(
  env: Env,
  actorName: string,
  page: Page,
  selection: string,
): Promise<void> {
  const session = sessionOf(page);
  session.view = clearViewFlag(propsByPage.get(page) ?? {}, session.view, SELECTED_FLAG, selection);
  await load(env, actorName, viewOf(page), true);
}

async function saveSelected(
  env: Env,
  actorName: string,
  page: Page,
  selection: string,
): Promise<void> {
  const session = sessionOf(page);
  const key = `${SELECTION_KEY_PREFIX}${selection}`;
  const pending = session.pending.get(key) ?? new Map<string, string>();
  for (const ref of selectedRefs(propsByPage.get(page) ?? {}, selection)) {
    saveRecord(env.spec, givenOf(env), ref, pending);
  }
  session.pending.delete(key);
  clearFieldInputs(session);
  await finishBulk(env, actorName, page, selection);
}

async function applyEdit(
  env: Env,
  actorName: string,
  control: Locator,
  selector: string,
  action: "fill" | "select",
  value: string,
  options: { emptyOption?: boolean; optionValue?: string } = {},
): Promise<void> {
  const page = pageOf(env, actorName);
  const attributes = await control.evaluate((element) => ({
    field: element.getAttribute("data-field"),
    record: element.getAttribute("data-record") ?? "",
    filters: element.getAttribute("data-filters"),
    filterField: element.getAttribute("data-filter-field"),
    filterFlag: element.hasAttribute("data-filter-flag"),
    selection: element.getAttribute("data-selection"),
  }));
  const session = sessionOf(page);
  if (attributes.filters !== null) {
    const filter: RowFilter = attributes.filterFlag
      ? { prop: attributes.filters, kind: "flag", flag: options.optionValue ?? value }
      : attributes.filterField === null
        ? { prop: attributes.filters, kind: "text", text: value }
        : {
            prop: attributes.filters,
            kind: "field",
            field: attributes.filterField,
            value: options.emptyOption === true ? "" : value,
          };
    session.filters = [
      ...session.filters.filter((other) => !sameFilterSlot(other, filter)),
      filter,
    ];
    session.inputs.set(selector, { kind: "filter", action, value });
    await load(env, actorName, viewOf(page), true);
  } else if (attributes.field !== null) {
    const view = viewOf(page);
    const key =
      attributes.selection !== null
        ? `${SELECTION_KEY_PREFIX}${attributes.selection}`
        : attributes.record !== ""
          ? attributes.record
          : (view.ref ?? SURFACE_KEY);
    const stage = stageChange(env, attributes.record, attributes.field, options.optionValue, value);
    if (stage !== undefined) {
      await advanceState(env, actorName, view, stage, attributes.record);
      return;
    }
    if (
      (await page.locator("[data-saves]").count()) === 0 &&
      editsOwnField(env, view, key, attributes.field)
    ) {
      await applyImmediateEdit(env, actorName, view, key, attributes.field, value);
      return;
    }
    const pending = session.pending.get(key) ?? new Map<string, string>();
    pending.set(attributes.field, value);
    session.pending.set(key, pending);
    session.inputs.set(selector, { kind: "field", action, value });
  }
}

function stageChange(
  env: Env,
  record: string,
  field: string,
  optionValue: string | undefined,
  label: string,
): string | undefined {
  const entity = record === "" ? undefined : givenOf(env).get(record)?.entity;
  return entity === undefined
    ? undefined
    : (stateNamed(env.spec, entity, field, optionValue ?? "") ??
        stateNamed(env.spec, entity, field, label));
}

function editsOwnField(env: Env, view: View, key: string, field: string): boolean {
  const entity = key === SURFACE_KEY ? view.creating : givenOf(env).get(key)?.entity;
  return entity !== undefined && ownedFields(env.spec, entity, new Map([[field, ""]])).size > 0;
}

async function applyImmediateEdit(
  env: Env,
  actorName: string,
  view: View,
  key: string,
  field: string,
  value: string,
): Promise<void> {
  const records = givenOf(env);
  const edit = new Map([[field, value]]);
  let next = view;
  if (key === SURFACE_KEY && view.creating !== undefined) {
    const created = createRecord(
      env.spec,
      records,
      view.creating,
      edit,
      undefined,
      prepareUsers(env, actorName),
    );
    next = { ...view, ref: created, creating: undefined };
  } else {
    const saved = saveRecord(env.spec, records, key, edit);
    next = key === view.ref ? { ...view, ref: saved } : view;
  }
  clearFieldInputs(sessionOf(pageOf(env, actorName)));
  await load(env, actorName, next, true);
}

function sameFilterSlot(left: RowFilter, right: RowFilter): boolean {
  if (left.prop !== right.prop || left.kind !== right.kind) return false;
  return left.kind === "field" && right.kind === "field" ? left.field === right.field : true;
}

async function applyMutation(
  env: Env,
  actorName: string,
  page: Page,
  mutation: Mutation,
  record: string | undefined,
): Promise<void> {
  const view = viewOf(page);
  const session = sessionOf(page);
  if (mutation.kind === "saves" && mutation.selection !== undefined) {
    await saveSelected(env, actorName, page, mutation.selection);
    return;
  }
  const records = givenOf(env);
  const surfaceKey = view.ref ?? SURFACE_KEY;
  const targetKey = record ?? surfaceKey;
  const pending = session.pending.get(targetKey) ?? new Map<string, string>();
  let next = view;
  if (mutation.kind === "removes") {
    record !== undefined && records.delete(record);
  } else if (mutation.kind === "saves") {
    if (record === undefined && view.creating !== undefined) {
      const created = createRecord(
        env.spec,
        records,
        view.creating,
        pending,
        undefined,
        prepareUsers(env, actorName),
      );
      next = { ...view, ref: created, creating: undefined };
    } else {
      const saved = saveRecord(env.spec, records, targetKey, pending);
      next = targetKey === view.ref ? { ...view, ref: saved } : view;
    }
    session.pending.delete(targetKey);
    clearFieldInputs(session);
    record !== undefined && (session.view = closeRowOverlays(session.view, record));
  } else {
    createFromPending(
      env,
      view,
      mutation.target,
      session.pending.get(surfaceKey) ?? pending,
      prepareUsers(env, actorName),
    );
    session.pending.delete(surfaceKey);
    clearFieldInputs(session);
  }
  await load(env, actorName, next, true);
}

function createFromPending(
  env: Env,
  view: View,
  target: string,
  pending: ReadonlyMap<string, string>,
  context: NewRecordContext,
): void {
  const parent = view.ref === undefined ? undefined : givenOf(env).get(view.ref);
  const child =
    parent === undefined ? undefined : childRelation(env.spec, parent.entity, camelCase(target));
  if (child !== undefined && view.ref !== undefined) {
    createRecord(
      env.spec,
      givenOf(env),
      child.child,
      ownedFields(env.spec, child.child, pending),
      { relation: child.owner, ref: view.ref },
      context,
    );
    return;
  }
  const entity = entityOfPlural(env.spec, camelCase(target));
  entity !== undefined &&
    createRecord(
      env.spec,
      givenOf(env),
      entity,
      ownedFields(env.spec, entity, pending),
      undefined,
      context,
    );
}

function clearFieldInputs(session: Session): void {
  for (const [selector, input] of session.inputs) {
    input.kind === "field" && session.inputs.delete(selector);
  }
}

function routeRenderedArtboards(env: Env, page: Page): void {
  if (routedPages.has(page)) return;
  routedPages.add(page);
  void page.route(`**/*${ARTBOARD_SUFFIX}`, async (route) => {
    const served = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = join(env.services.designsDirectory, served);
    await route.fulfill(
      existsSync(file)
        ? {
            status: 200,
            contentType: "text/html; charset=utf-8",
            body: renderArtboard(readFileSync(file, "utf8"), propsByPage.get(page) ?? {}),
          }
        : { status: 404 },
    );
  });
}

async function advanceState(
  env: Env,
  actorName: string,
  view: View,
  nextState: string,
  record?: string,
): Promise<void> {
  moveRecord(env, actorName, record ?? view.ref, nextState);
  if (record !== undefined) {
    await load(env, actorName, view, true);
    return;
  }
  const states = artboardStates(join(env.services.designsDirectory, view.design));
  const state = states.includes(nextState) ? nextState : view.state;
  await load(env, actorName, { ...view, state });
}

function moveRecord(
  env: Env,
  actorName: string,
  refName: string | undefined,
  nextState: string,
): void {
  recordStateChange(env, refName, nextState);
  refName !== undefined &&
    applyEffects(env.spec, givenOf(env), refName, nextState, prepareUsers(env, actorName));
}

function recordStateChange(env: Env, refName: string | undefined, nextState: string): void {
  const record = refName === undefined ? undefined : givenOf(env).get(refName);
  const field = Object.entries(env.spec.model[record?.entity ?? ""]?.machines ?? {}).find(
    ([, machine]) => machine.states.includes(nextState),
  )?.[0];
  if (record !== undefined && field !== undefined)
    record.fields.set(field.toLowerCase(), nextState);
}

async function followLink(
  env: Env,
  actorName: string,
  page: Page,
  href: string,
  record?: string,
): Promise<void> {
  const target = new URL(href, page.url());
  const served = decodeURIComponent(target.pathname).replace(/^\//, "");
  const state = served.slice(served.lastIndexOf("/") + 1, -ARTBOARD_SUFFIX.length);
  const design = served.slice(0, served.lastIndexOf("/"));
  const surface = surfaceOfDesign(env.spec, design) ?? viewOf(page).surface;
  const creates = editorEntity(env.spec, surface);
  const current = viewOf(page).ref;
  const currentEntity = current === undefined ? undefined : givenOf(env).get(current)?.entity;
  const editing = record ?? (currentEntity === creates ? current : undefined);
  const creating = creates !== undefined && editing === undefined ? creates : undefined;
  const ref = creates === undefined ? (record ?? recordRefFor(env, design, undefined)) : editing;
  await load(env, actorName, { design, state, surface, actor: actorName, ref, creating });
}

function surfaceOfDesign(spec: SpecAst, design: string): string | undefined {
  return Object.entries(spec.surfaces).find(([, surface]) => surface.design === design)?.[0];
}

async function flagMismatch(
  env: Env,
  actorName: string,
  step: string,
  expected: string,
  found: string,
  control?: ResolvedControl,
): Promise<void> {
  const page = pageOf(env, actorName);
  env.services.log.record(step, artboardLabel(page), expected, found);
  if (env.services.recording === undefined) return;
  const selector = control === undefined ? undefined : selectorOf(control);
  const caption = `Design differs: expected ${expected}, found ${found || "nothing"}`;
  await page.evaluate(
    ({ outlinedSelector, captionText, outline, maximumCaption }) => {
      const target =
        outlinedSelector === undefined
          ? null
          : document.querySelector<HTMLElement>(outlinedSelector);
      if (target !== null) {
        target.style.outline = outline;
        target.style.outlineOffset = "2px";
      }
      const card = document.createElement("div");
      card.id = "design-mismatch-card";
      card.textContent =
        captionText.length > maximumCaption
          ? `${captionText.slice(0, maximumCaption)}...`
          : captionText;
      card.style.cssText =
        "position:fixed;left:50%;bottom:32px;transform:translateX(-50%);max-width:960px;" +
        "padding:16px 24px;border-radius:8px;background:#b91c1c;color:#fff;" +
        "font:600 20px system-ui,sans-serif;text-align:center;z-index:2147483647";
      document.body.appendChild(card);
    },
    {
      outlinedSelector: selector,
      captionText: caption,
      outline: MISMATCH_OUTLINE,
      maximumCaption: MISMATCH_CAPTION_LIMIT,
    },
  );
  await page.waitForTimeout(MISMATCH_HOLD_MILLISECONDS);
  await page.evaluate((outlinedSelector) => {
    document.getElementById("design-mismatch-card")?.remove();
    if (outlinedSelector === undefined) return;
    const target = document.querySelector<HTMLElement>(outlinedSelector);
    if (target !== null) target.style.outline = "";
  }, selector);
}
