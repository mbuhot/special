import type { Page, Video } from "@playwright/test";
import type { NarrationNode } from "@special/specdsl-core";
import type { WebAppContextStates, WebAppServices } from "../handlers/web-app.js";
import type { ResolvedControl, ScenarioEnv, StepHooks, StepInvocation } from "../runtime.js";
import type { ClipPlacement } from "./assemble.js";
import { signInNarration } from "./narration.js";
import type { Clip } from "./tts.js";

const MINIMUM_HOLD_SECONDS = 1.2;
const CAPTION_HOLD_SECONDS = 2.5;
const SIGN_IN_STEP_ID = "sign-in";
const HIGHLIGHT_OUTLINE = "3px solid #ff5a1f";

type Env = ScenarioEnv<WebAppServices, WebAppContextStates>;

type StepPresentation = "card" | "control" | "plain";

const CARD_STEP_IDS: readonly string[] = ["time-advances", "job-runs"];
const CONTROL_STEP_IDS: readonly string[] = [
  "opens",
  "enters",
  "clicks",
  "selects",
  "sees",
  "no-longer-sees",
];

export interface TimelineEntry {
  actor: string;
  stepId: string;
  line: number;
  narration: string | null;
  startSeconds: number;
  clipSeconds: number;
}

export interface RecorderConfiguration {
  narrationByLine: ReadonlyMap<number, string>;
  clipsByText: ReadonlyMap<string, Clip>;
  screenshotDirectory: string;
}

export interface ActorRecording {
  actor: string;
  page: Page;
  video: Video;
  recordingStartedAt: number;
  trimStartMilliseconds: number;
  placements: ClipPlacement[];
}

/** Performs steps with highlight, hold, screenshot and title cards while logging a timeline. */
export class DemoRecorder implements StepHooks<WebAppServices, WebAppContextStates> {
  readonly timeline: TimelineEntry[] = [];
  private readonly recordings = new Map<string, ActorRecording>();
  private lastActorName: string | undefined;
  private stepCount = 0;

  constructor(private readonly configuration: RecorderConfiguration) {}

  get actorRecordings(): ActorRecording[] {
    return [...this.recordings.values()];
  }

  async aroundStep(
    invocation: StepInvocation,
    perform: () => Promise<void>,
    env: Env,
  ): Promise<void> {
    const stepNumber = ++this.stepCount;
    const narration = this.configuration.narrationByLine.get(invocation.line) ?? null;
    const clip = narration === null ? undefined : this.configuration.clipsByText.get(narration);
    await this.beginRecording(invocation, env);
    const page = this.currentRecording?.page;
    const startSeconds = this.elapsedSeconds();
    const presentation = presentationOf(invocation.id);

    if (presentation === "card" && page !== undefined && narration !== null) {
      await showCard(page, narration, holdSeconds(clip));
      await perform();
    } else {
      await this.performWithHighlight(invocation, page, perform, presentation, clip, narration);
    }

    await this.captureScreenshot(page, stepNumber);
    this.logStep(invocation.id, invocation.line, narration, clip, startSeconds);
  }

  async onNarration(node: NarrationNode): Promise<void> {
    const recording = this.currentRecording;
    if (node.id !== "caption" || recording === undefined) return;
    const clip = this.configuration.clipsByText.get(node.text);
    const startSeconds = this.elapsedSeconds();
    this.logStep(node.id, node.line, node.text, clip, startSeconds);
    await showCard(recording.page, node.text, Math.max(clip?.seconds ?? 0, CAPTION_HOLD_SECONDS));
  }

  private async performWithHighlight(
    invocation: StepInvocation,
    page: Page | undefined,
    perform: () => Promise<void>,
    presentation: StepPresentation,
    clip: Clip | undefined,
    narration: string | null,
  ): Promise<void> {
    const control = invocation.args["Control"] as ResolvedControl | undefined;
    const selector = control?.locators["css"];
    const highlighted = page !== undefined && selector !== undefined;
    if (highlighted) await setOutline(page, selector, HIGHLIGHT_OUTLINE);
    await perform();
    const holds = presentation === "control" || narration !== null;
    if (page !== undefined && holds) await page.waitForTimeout(holdSeconds(clip) * 1000);
    if (highlighted) await setOutline(page, selector, "");
  }

  private get currentRecording(): ActorRecording | undefined {
    return this.lastActorName === undefined ? undefined : this.recordings.get(this.lastActorName);
  }

  private async beginRecording(invocation: StepInvocation, env: Env): Promise<void> {
    const actorName = invocation.args["Actor"];
    if (typeof actorName !== "string") return;
    this.lastActorName = actorName;
    if (this.recordings.has(actorName)) return;
    const { page, email, recordingStartedAt } = env.context("actor", actorName);
    const video = page.video();
    if (video === null) return;
    this.recordings.set(actorName, {
      actor: actorName,
      page,
      video,
      recordingStartedAt,
      trimStartMilliseconds: Date.now() - recordingStartedAt,
      placements: [],
    });
    await this.showSignInCard(invocation, actorName, email);
  }

  private async showSignInCard(
    invocation: StepInvocation,
    actorName: string,
    email: string,
  ): Promise<void> {
    const recording = this.recordings.get(actorName);
    if (recording === undefined) return;
    const narration = signInNarration(actorName, email);
    const clip = this.configuration.clipsByText.get(narration);
    this.logStep(SIGN_IN_STEP_ID, invocation.line, narration, clip, this.elapsedSeconds());
    await showCard(recording.page, narration, holdSeconds(clip));
  }

  private elapsedSeconds(): number {
    const recording = this.currentRecording;
    if (recording === undefined) return 0;
    const { recordingStartedAt, trimStartMilliseconds } = recording;
    return (Date.now() - recordingStartedAt - trimStartMilliseconds) / 1000;
  }

  private logStep(
    stepId: string,
    line: number,
    narration: string | null,
    clip: Clip | undefined,
    startSeconds: number,
  ): void {
    const recording = this.currentRecording;
    if (recording === undefined || narration === null) return;
    this.timeline.push({
      actor: recording.actor,
      stepId,
      line,
      narration,
      startSeconds,
      clipSeconds: clip?.seconds ?? 0,
    });
    if (clip !== undefined) recording.placements.push({ file: clip.file, startSeconds });
  }

  private async captureScreenshot(page: Page | undefined, stepNumber: number): Promise<void> {
    if (page === undefined) return;
    const fileName = `${String(stepNumber).padStart(2, "0")}.png`;
    await page.screenshot({
      path: `${this.configuration.screenshotDirectory}/${fileName}`,
      fullPage: true,
    });
  }
}

function presentationOf(stepId: string): StepPresentation {
  if (CARD_STEP_IDS.includes(stepId)) return "card";
  return CONTROL_STEP_IDS.includes(stepId) ? "control" : "plain";
}

function holdSeconds(clip: Clip | undefined): number {
  return Math.max(clip?.seconds ?? 0, MINIMUM_HOLD_SECONDS);
}

async function setOutline(page: Page, selector: string, outline: string): Promise<void> {
  await page
    .locator(selector)
    .evaluate(
      (element, outlineStyle) => {
        const styled = element as HTMLElement;
        styled.style.transition = "outline 150ms ease-in-out";
        styled.style.outline = outlineStyle;
        styled.style.outlineOffset = "2px";
      },
      outline,
      { timeout: 2_000 },
    )
    .catch(() => undefined);
}

async function showCard(page: Page, text: string, seconds: number): Promise<void> {
  await page.evaluate((cardText) => {
    const card = document.createElement("div");
    card.id = "demo-title-card";
    card.textContent = cardText;
    card.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(15,23,42,0.94);color:#fff;font:600 36px system-ui,sans-serif;" +
      "text-align:center;padding:64px;z-index:2147483647";
    document.body.appendChild(card);
  }, text);
  await page.waitForTimeout(seconds * 1000);
  await page.evaluate(() => document.getElementById("demo-title-card")?.remove());
}
