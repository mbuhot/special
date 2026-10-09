import { expect } from "@playwright/test";
import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import type { SurfaceNode } from "@special/specdsl-core";
import type {
  ContextHandlers,
  EntityPair,
  ResolvedControl,
  ResolvedSurface,
  ScenarioEnv,
  StepHandlers,
} from "../runtime.js";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export interface VideoRecording {
  directory: string;
  size: { width: number; height: number };
}

export interface WebAppServices {
  browser: Browser;
  request: APIRequestContext;
  baseURL: string;
  recording?: VideoRecording;
}

export interface AppState {
  baseURL: string;
}

export interface DataState {
  resetAt: Date;
}

export interface ClockState {
  now: Date;
}

export interface ActorState {
  context: BrowserContext;
  page: Page;
  email: string;
  recordingStartedAt: number;
}

export interface WebAppContextStates {
  app: AppState;
  data: DataState;
  clock: ClockState;
  actor: ActorState;
}

export interface WebAppStepArgs {
  opens: { Actor: string; Surface: ResolvedSurface; Ref?: string };
  "is-on": { Actor: string; Surface: ResolvedSurface };
  enters: { Actor: string; Value: string; Control: ResolvedControl; Surface?: ResolvedSurface };
  clicks: { Actor: string; Control: ResolvedControl; Surface?: ResolvedSurface };
  selects: { Actor: string; Value: string; Control: ResolvedControl; Surface?: ResolvedSurface };
  sees: { Actor: string; Text: string; Control: ResolvedControl; Surface?: ResolvedSurface };
  "no-longer-sees": {
    Actor: string;
    Text: string;
    Control: ResolvedControl;
    Surface?: ResolvedSurface;
  };
  "given-entity": { Entity: string; Ref: string; pairs: EntityPair[] };
  "has-field": { Ref: string; Field: string; Value: string };
  "time-advances": { Duration: string };
  "job-runs": { Job: string };
}

type Env = ScenarioEnv<WebAppServices, WebAppContextStates>;

const LOGIN_SURFACE = "Login";
const LOGIN_EMAIL_CONTROL = "Email";
const LOGIN_SUBMIT_CONTROL = "Log in";

/** Login surface used when the AST omits it because no scenario step names it. */
const FALLBACK_LOGIN_SURFACE: SurfaceNode = {
  route: "/login",
  controls: {
    Email: { kind: "field", locators: { css: "#login-email" } },
    "Log in": { kind: "button", locators: { css: "#login-submit" } },
  },
};

const DURATION_UNIT_MILLISECONDS = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
} as const;

type DurationUnit = keyof typeof DURATION_UNIT_MILLISECONDS;

/** Email address the actor signs in with. */
export function actorEmail(actorName: string): string {
  return `${actorName}@example.com`.toLowerCase();
}

export const webAppContexts: ContextHandlers<WebAppServices, WebAppContextStates> = {
  app: {
    async setup(env) {
      return { baseURL: env.services.baseURL };
    },
  },
  data: {
    async setup(env) {
      await postJson(env, "/__spec__/reset", {});
      return { resetAt: new Date() };
    },
  },
  clock: {
    async setup(env, request) {
      const now = new Date(request.config["DateTime"] ?? Date.now());
      await postJson(env, "/__spec__/clock", { at: now.toISOString() });
      return { now };
    },
    async teardown(_state, env) {
      await postJson(env, "/__spec__/clock", { at: null });
    },
  },
  actor: {
    async setup(env, request) {
      const name = request.key ?? "";
      const email = actorEmail(name);
      await postJson(env, "/__spec__/factory", {
        entity: "User",
        attrs: { email, role: request.actor?.role ?? "" },
      });
      const baseURL = env.context("app").baseURL;
      const recording = env.services.recording;
      const storageState =
        recording === undefined ? undefined : await signedInStorageState(env, baseURL, email);
      const context = await env.services.browser.newContext({
        baseURL,
        storageState,
        ...(recording === undefined
          ? {}
          : {
              viewport: recording.size,
              recordVideo: { dir: recording.directory, size: recording.size },
            }),
      });
      const recordingStartedAt = Date.now();
      const page = await context.newPage();
      if (recording === undefined) await logIn(env, page, email);
      return { context, page, email, recordingStartedAt };
    },
    async teardown(state) {
      await state.context.close();
    },
  },
};

export const webAppSteps: StepHandlers<WebAppStepArgs, WebAppServices, WebAppContextStates> = {
  async opens(args, env) {
    const route = args.Surface.route;
    if (route === undefined) throw new Error(`surface "${args.Surface.name}" has no route`);
    const path = args.Ref === undefined ? route : route.replace("{id}", env.refs.get(args.Ref).id);
    const page = pageOf(env, args.Actor);
    await page.goto(path);
    await waitForLiveView(page);
  },
  async "is-on"(args, env) {
    const route = args.Surface.route;
    if (route === undefined) throw new Error(`surface "${args.Surface.name}" has no route`);
    const page = pageOf(env, args.Actor);
    await page.waitForURL((url) => routePattern(route).test(url.pathname));
    await waitForLiveView(page);
  },
  async enters(args, env) {
    await locate(env, args.Actor, args.Control).fill(args.Value);
  },
  async clicks(args, env) {
    await locate(env, args.Actor, args.Control).click();
  },
  async selects(args, env) {
    await locate(env, args.Actor, args.Control).selectOption({ label: args.Value });
  },
  async sees(args, env) {
    await expect(locate(env, args.Actor, args.Control)).toContainText(args.Text);
  },
  async "no-longer-sees"(args, env) {
    await expect(locate(env, args.Actor, args.Control)).not.toContainText(args.Text);
  },
  async "given-entity"(args, env) {
    const attrs = Object.fromEntries(env.refs.substituteIds(args.pairs));
    const created = await postJson(env, "/__spec__/factory", { entity: args.Entity, attrs });
    env.refs.declare(args.Ref, { entity: args.Entity, id: String(created["id"]) });
  },
  async "has-field"(args, env) {
    const { entity, id } = env.refs.get(args.Ref);
    const response = await env.services.request.get(`/__spec__/entity/${entity}/${id}`);
    expect(response.ok(), `GET entity ${entity}/${id}`).toBe(true);
    const fields = (await response.json()) as Record<string, unknown>;
    expect(String(fields[args.Field])).toBe(args.Value);
  },
  async "time-advances"(args, env) {
    const clock = env.context("clock");
    clock.now = new Date(clock.now.getTime() + durationMilliseconds(args.Duration));
    await postJson(env, "/__spec__/clock", { at: clock.now.toISOString() });
  },
  async "job-runs"() {
    throw new Error("no jobs in this app");
  },
};

async function postJson(
  env: Env,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await env.services.request.post(path, { data: body });
  if (!response.ok()) {
    throw new Error(`POST ${path} responded ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function pageOf(env: Env, actorName: string): Page {
  return env.context("actor", actorName).page;
}

function locate(env: Env, actorName: string, control: ResolvedControl) {
  const selector = control.locators["css"];
  if (selector === undefined) throw new Error(`control "${control.name}" has no css locator`);
  return pageOf(env, actorName).locator(selector);
}

function routePattern(route: string): RegExp {
  const segments = route.split("{id}").map((segment) => escapeRegExp(segment));
  return new RegExp(`^${segments.join("[^/]+")}$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForLiveView(page: Page): Promise<void> {
  await page.locator("[data-phx-main].phx-connected").waitFor();
}

async function signedInStorageState(
  env: Env,
  baseURL: string,
  email: string,
): Promise<StorageState> {
  const context = await env.services.browser.newContext({ baseURL });
  try {
    await logIn(env, await context.newPage(), email);
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function logIn(env: Env, page: Page, email: string): Promise<void> {
  const login = env.spec.surfaces[LOGIN_SURFACE] ?? FALLBACK_LOGIN_SURFACE;
  const emailSelector = login.controls[LOGIN_EMAIL_CONTROL]?.locators["css"];
  const submitSelector = login.controls[LOGIN_SUBMIT_CONTROL]?.locators["css"];
  if (login.route === undefined || emailSelector === undefined || submitSelector === undefined) {
    throw new Error(`the  surface lacks a route or its controls`);
  }
  await page.goto(login.route);
  await waitForLiveView(page);
  await page.locator(emailSelector).fill(email);
  await page.locator(submitSelector).click();
  await page.waitForURL((url) => url.pathname !== login.route);
}

function durationMilliseconds(duration: string): number {
  const match = /^(\d+)\s*(second|minute|hour|day|week)s?$/i.exec(duration.trim());
  if (match === null) throw new Error(`cannot parse duration "${duration}"`);
  const unit = match[2]?.toLowerCase() as DurationUnit;
  return Number(match[1]) * DURATION_UNIT_MILLISECONDS[unit];
}
