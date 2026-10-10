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
import { buildProps } from "../design/props.js";
import type { GivenEntity } from "../design/props.js";
import { renderArtboard } from "../design/render.js";
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
  ref?: string | undefined;
}

interface ScenarioStore {
  entities: Map<string, GivenEntity>;
  now: Date;
}

const viewByPage = new WeakMap<Page, View>();
const storeByRefs = new WeakMap<object, ScenarioStore>();
const propsByPage = new WeakMap<Page, Props>();
const routedPages = new WeakSet<Page>();

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
    const ref = recordRefFor(env, design, args.Ref);
    const state = stateFor(env, design, ref);
    await load(env, args.Actor, { design, state, surface: args.Surface.name, ref });
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
    if (tag === "input" || tag === "textarea") await control.fill(args.Value);
  },
  async clicks(args, env) {
    const page = pageOf(env, args.Actor);
    const control = await existing(env, args.Actor, args.Control);
    await page.waitForTimeout(HIGHLIGHT_HOLD_MILLISECONDS);
    const href = await control.getAttribute("href");
    const nextState = await control.getAttribute("data-next-state");
    if (href?.endsWith(ARTBOARD_SUFFIX) === true) {
      await followLink(env, args.Actor, page, href);
    } else if (nextState !== null) {
      await advanceState(env, args.Actor, viewOf(page), nextState);
    }
  },
  async selects(args, env) {
    const control = await existing(env, args.Actor, args.Control);
    if ((await tagOf(control)) === "select") await control.selectOption({ label: args.Value });
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

function recordRefFor(env: Env, design: string, refName: string | undefined): string | undefined {
  if (refName !== undefined) return refName;
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

async function load(env: Env, actorName: string, view: View): Promise<void> {
  const file = join(env.services.designsDirectory, view.design, `${view.state}${ARTBOARD_SUFFIX}`);
  if (!existsSync(file)) {
    throw new Error(`artboard designs/${view.design}/${view.state}${ARTBOARD_SUFFIX} is missing`);
  }
  const page = pageOf(env, actorName);
  routeRenderedArtboards(env, page);
  propsByPage.set(page, propsFor(env, view.ref));
  await page.goto(`${env.services.baseURL}/${view.design}/${view.state}${ARTBOARD_SUFFIX}`);
  viewByPage.set(page, view);
}

function propsFor(env: Env, refName: string | undefined): Props {
  return refName === undefined
    ? {}
    : buildProps(env.spec, givenOf(env), refName, storeOf(env).now.toISOString().slice(0, 10));
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
): Promise<void> {
  recordStateChange(env, view.ref, nextState);
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

async function followLink(env: Env, actorName: string, page: Page, href: string): Promise<void> {
  const target = new URL(href, page.url());
  const served = decodeURIComponent(target.pathname).replace(/^\//, "");
  const state = served.slice(served.lastIndexOf("/") + 1, -ARTBOARD_SUFFIX.length);
  const design = served.slice(0, served.lastIndexOf("/"));
  const surface = surfaceOfDesign(env.spec, design) ?? viewOf(page).surface;
  await load(env, actorName, { design, state, surface, ref: recordRefFor(env, design, undefined) });
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
