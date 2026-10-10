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
  buildListProps,
  buildNewProps,
  buildProps,
  camelCase,
  listEntities,
} from "../design/props.js";
import type { GivenEntity, RowFilter } from "../design/props.js";
import {
  childRelation,
  createRecord,
  editorEntity,
  entityOfPlural,
  ownedFields,
  roleOfActor,
  saveRecord,
} from "../design/records.js";
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
}

const SURFACE_KEY = "";

interface ScenarioStore {
  entities: Map<string, GivenEntity>;
  now: Date;
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
    if (mutation !== undefined) {
      await applyMutation(env, args.Actor, page, mutation, record);
    } else if (href?.endsWith(ARTBOARD_SUFFIX) === true) {
      await followLink(env, args.Actor, page, href, record);
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
    given.set(args.Ref, { entity: args.Entity, fields: fieldMap(args.pairs) });
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
  const located = page.locator(selectorOf(control)).first();
  try {
    await located.waitFor({ state: "attached", timeout: CONTROL_TIMEOUT_MILLISECONDS });
  } catch {
    throw new Error(`control "${control.name}" is not in artboard ${artboardLabel(page)}`);
  }
  return located;
}

/** Among several matches of a control, the one on the card of the only record not yet in a final state, else the first. */
async function clickTarget(
  env: Env,
  page: Page,
  control: ResolvedControl,
  first: Locator,
): Promise<Locator> {
  const matches = page.locator(selectorOf(control));
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
    const field = element as HTMLInputElement;
    const rendered = (element as HTMLElement).innerText ?? element.textContent ?? "";
    return `${rendered}${field.value ?? ""}`.replace(/\s+/g, " ").trim();
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
  propsByPage.set(page, propsFor(env, view, sessionOf(page)));
  await page.goto(`${env.services.baseURL}/${view.design}/${view.state}${ARTBOARD_SUFFIX}`);
  viewByPage.set(page, view);
  keepSession && (await restoreInputs(page));
}

function emptySession(): Session {
  return { pending: new Map(), filters: [], inputs: new Map() };
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

function propsFor(env: Env, view: View, session: Session): Props {
  const today = storeOf(env).now.toISOString().slice(0, 10);
  const role = roleOfActor(env.spec, view.actor);
  const base =
    view.creating !== undefined
      ? buildNewProps(env.spec, givenOf(env), view.creating, today, role)
      : view.ref === undefined
        ? buildListProps(env.spec, givenOf(env), listedEntities(env, view.design), today, role)
        : buildProps(env.spec, givenOf(env), view.ref, today, role);
  return applyRowFilters(base, session.filters);
}

type Mutation = { kind: "saves" } | { kind: "creates"; target: string } | { kind: "removes" };

async function mutationOf(control: Locator): Promise<Mutation | undefined> {
  const attributes = await control.evaluate((element) => ({
    saves: element.hasAttribute("data-saves"),
    creates: element.getAttribute("data-creates"),
    removes: element.hasAttribute("data-removes"),
  }));
  if (attributes.saves) return { kind: "saves" };
  if (attributes.creates !== null) return { kind: "creates", target: attributes.creates };
  return attributes.removes ? { kind: "removes" } : undefined;
}

async function applyEdit(
  env: Env,
  actorName: string,
  control: Locator,
  selector: string,
  action: "fill" | "select",
  value: string,
  options: { emptyOption?: boolean } = {},
): Promise<void> {
  const page = pageOf(env, actorName);
  const attributes = await control.evaluate((element) => ({
    field: element.getAttribute("data-field"),
    record: element.getAttribute("data-record") ?? "",
    filters: element.getAttribute("data-filters"),
    filterField: element.getAttribute("data-filter-field"),
  }));
  const session = sessionOf(page);
  if (attributes.filters !== null) {
    const filter: RowFilter =
      attributes.filterField === null
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
    const key = attributes.record !== "" ? attributes.record : (view.ref ?? SURFACE_KEY);
    const pending = session.pending.get(key) ?? new Map<string, string>();
    pending.set(attributes.field, value);
    session.pending.set(key, pending);
    session.inputs.set(selector, { kind: "field", action, value });
  }
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
  const records = givenOf(env);
  const surfaceKey = view.ref ?? SURFACE_KEY;
  const targetKey = record ?? surfaceKey;
  const pending = session.pending.get(targetKey) ?? new Map<string, string>();
  let next = view;
  if (mutation.kind === "removes") {
    record !== undefined && records.delete(record);
  } else if (mutation.kind === "saves") {
    if (record === undefined && view.creating !== undefined) {
      const created = createRecord(env.spec, records, view.creating, pending);
      next = { ...view, ref: created, creating: undefined };
    } else {
      saveRecord(env.spec, records, targetKey, pending);
    }
    session.pending.delete(targetKey);
    clearFieldInputs(session);
  } else {
    createFromPending(env, view, mutation.target, session.pending.get(surfaceKey) ?? pending);
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
): void {
  const parent = view.ref === undefined ? undefined : givenOf(env).get(view.ref);
  const child =
    parent === undefined ? undefined : childRelation(env.spec, parent.entity, camelCase(target));
  if (child !== undefined && view.ref !== undefined) {
    createRecord(env.spec, givenOf(env), child.child, ownedFields(env.spec, child.child, pending), {
      relation: child.owner,
      ref: view.ref,
    });
    return;
  }
  const entity = entityOfPlural(env.spec, camelCase(target));
  entity !== undefined &&
    createRecord(env.spec, givenOf(env), entity, ownedFields(env.spec, entity, pending));
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
  recordStateChange(env, record ?? view.ref, nextState);
  if (record !== undefined) {
    await load(env, actorName, view, true);
    return;
  }
  const states = artboardStates(join(env.services.designsDirectory, view.design));
  const state = states.includes(nextState) ? nextState : view.state;
  await load(env, actorName, { ...view, state });
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
