import type { Page, Video } from "@playwright/test";
import type { NarrationNode } from "@special/specdsl-core";
import type { WebAppContextStates, WebAppServices } from "../handlers/web-app.js";
import type { ResolvedControl, ScenarioEnv, StepHooks, StepInvocation } from "../runtime.js";
import type { ClipPlacement } from "./assemble.js";
import type { Clip } from "./tts.js";

const MINIMUM_HOLD_SECONDS = 1.2;
const CAPTION_HOLD_SECONDS = 2.5;
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

interface VideoClock {
  video: Video;
  recordingStartedAt: number;
  trimStartMilliseconds: number;
}

/** Performs steps with highlight, hold, screenshot and title cards while logging a timeline. */
export class DemoRecorder implements StepHooks<WebAppServices, WebAppContextStates> {
  readonly timeline: TimelineEntry[] = [];
  readonly placements: ClipPlacement[] = [];
  private videoClock: VideoClock | undefined;
  private lastPage: Page | undefined;
  private stepCount = 0;

  constructor(private readonly configuration: RecorderConfiguration) {}

  get video(): Video | undefined {
    return this.videoClock?.video;
  }

  get trimStartSeconds(): number {
    return (this.videoClock?.trimStartMilliseconds ?? 0) / 1000;
  }

  async aroundStep(
    invocation: StepInvocation,
    perform: () => Promise<void>,
    env: Env,
  ): Promise<void> {
    const stepNumber = ++this.stepCount;
    const narration = this.configuration.narrationByLine.get(invocation.line) ?? null;
    const clip = narration === null ? undefined : this.configuration.clipsByText.get(narration);
    const page = this.pageFor(invocation, env);
    this.startVideoClock(invocation, page, env);
    const startSeconds = this.elapsedSeconds();
    const presentation = presentationOf(invocation.id);

    if (presentation === "card" && page !== undefined && narration !== null) {
      await showCard(page, narration, holdSeconds(clip));
      await perform();
    } else {
      await this.performWithHighlight(invocation, page, perform, presentation, clip, narration);
    }

    await this.captureScreenshot(this.pageFor(invocation, env), stepNumber);
    this.logStep(invocation, narration, clip, startSeconds);
  }

  async onNarration(node: NarrationNode): Promise<void> {
    if (node.id !== "caption" || this.lastPage === undefined) return;
    const startSeconds = this.elapsedSeconds();
    await showCard(this.lastPage, node.text, CAPTION_HOLD_SECONDS);
    this.record({
      stepId: node.id,
      line: node.line,
      narration: node.text,
      startSeconds,
      clipSeconds: 0,
    });
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

  private pageFor(invocation: StepInvocation, env: Env): Page | undefined {
    const actorName = invocation.args["Actor"];
    if (typeof actorName === "string") this.lastPage = env.context("actor", actorName).page;
    return this.lastPage;
  }

  private startVideoClock(invocation: StepInvocation, page: Page | undefined, env: Env): void {
    const actorName = invocation.args["Actor"];
    if (invocation.id !== "opens" || this.videoClock !== undefined) return;
    if (page === undefined || typeof actorName !== "string") return;
    const video = page.video();
    if (video === null) return;
    const { recordingStartedAt } = env.context("actor", actorName);
    this.videoClock = {
      video,
      recordingStartedAt,
      trimStartMilliseconds: Date.now() - recordingStartedAt,
    };
  }

  private elapsedSeconds(): number {
    if (this.videoClock === undefined) return 0;
    const { recordingStartedAt, trimStartMilliseconds } = this.videoClock;
    return (Date.now() - recordingStartedAt - trimStartMilliseconds) / 1000;
  }

  private logStep(
    invocation: StepInvocation,
    narration: string | null,
    clip: Clip | undefined,
    startSeconds: number,
  ): void {
    if (this.videoClock === undefined || narration === null) return;
    this.record({
      stepId: invocation.id,
      line: invocation.line,
      narration,
      startSeconds,
      clipSeconds: clip?.seconds ?? 0,
    });
    if (clip !== undefined) this.placements.push({ file: clip.file, startSeconds });
  }

  private record(entry: TimelineEntry): void {
    if (this.videoClock !== undefined) this.timeline.push(entry);
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
