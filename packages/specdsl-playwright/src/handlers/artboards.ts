import { existsSync } from "node:fs";
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
import type { WebAppContextStates, WebAppServices, WebAppStepArgs } from "./web-app.js";

const ARTBOARD_SUFFIX = ".dc.html";
const DEFAULT_STATE = "default";
const HIGHLIGHT_HOLD_MILLISECONDS = 900;
const CONTROL_TIMEOUT_MILLISECONDS = 2_000;

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
}

interface GivenEntity {
  entity: string;
  fields: Map<string, string>;
}

const viewByPage = new WeakMap<Page, View>();
const givenByRefs = new WeakMap<object, Map<string, GivenEntity>>();

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
    const state = stateFor(env, design, args.Ref);
    await load(env, args.Actor, { design, state, surface: args.Surface.name });
  },
  async "is-on"(args, env) {
    const page = pageOf(env, args.Actor);
    const found = await page
      .locator("[data-surface]")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-surface")));
    if (!found.includes(args.Surface.name)) {
      env.services.log.record(
        "is-on",
        artboardLabel(page),
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
      const view = viewOf(page);
      await load(env, args.Actor, { ...view, state: nextState });
    }
  },
  async selects(args, env) {
    const control = await existing(env, args.Actor, args.Control);
    if ((await tagOf(control)) === "select") await control.selectOption({ label: args.Value });
  },
  async sees(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    if (!found.includes(args.Text)) {
      env.services.log.record(
        "sees",
        artboardLabel(pageOf(env, args.Actor)),
        `"${args.Text}" in ${args.Control.name}`,
        found,
      );
    }
  },
  async "sees-before"(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    const ordered =
      found.includes(args.Text) && found.indexOf(args.Text) < found.indexOf(args.Other);
    if (!ordered || !found.includes(args.Other)) {
      env.services.log.record(
        "sees-before",
        artboardLabel(pageOf(env, args.Actor)),
        `"${args.Text}" before "${args.Other}" in ${args.Control.name}`,
        found,
      );
    }
  },
  async "no-longer-sees"(args, env) {
    const found = await textOf(await existing(env, args.Actor, args.Control));
    if (found.includes(args.Text)) {
      env.services.log.record(
        "no-longer-sees",
        artboardLabel(pageOf(env, args.Actor)),
        `no "${args.Text}" in ${args.Control.name}`,
        found,
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
  async "does-not-see"(args, env) {
    const page = pageOf(env, args.Actor);
    if ((await page.locator(selectorOf(args.Control)).count()) > 0) {
      env.services.log.record(
        "does-not-see",
        artboardLabel(page),
        `no ${args.Control.name}`,
        "present",
      );
    }
  },
  async "time-advances"() {},
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

function givenOf(env: Env): Map<string, GivenEntity> {
  const existingGiven = givenByRefs.get(env.refs);
  if (existingGiven !== undefined) return existingGiven;
  const created = new Map<string, GivenEntity>();
  givenByRefs.set(env.refs, created);
  return created;
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
  await page.goto(`${env.services.baseURL}/${view.design}/${view.state}${ARTBOARD_SUFFIX}`);
  viewByPage.set(page, view);
}

async function followLink(env: Env, actorName: string, page: Page, href: string): Promise<void> {
  const target = new URL(href, page.url());
  const served = decodeURIComponent(target.pathname).replace(/^\//, "");
  const state = served.slice(served.lastIndexOf("/") + 1, -ARTBOARD_SUFFIX.length);
  const design = served.slice(0, served.lastIndexOf("/"));
  const surface = surfaceOfDesign(env.spec, design) ?? viewOf(page).surface;
  await load(env, actorName, { design, state, surface });
}

function surfaceOfDesign(spec: SpecAst, design: string): string | undefined {
  return Object.entries(spec.surfaces).find(([, surface]) => surface.design === design)?.[0];
}
