import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Scenario } from "@special/specdsl-core";
import type { VideoRecording } from "../handlers/web-app.js";
import { assemble } from "./assemble.js";
import { openingNarrations, planCaptions, planNarration, scenarioSlug } from "./narration.js";
import { DemoRecorder } from "./recorder.js";
import type { ActorRecording } from "./recorder.js";
import { synthesizeAll } from "./tts.js";

const VIDEO_SIZE = { width: 1280, height: 800 };

export interface VideoJob {
  scenario: Scenario;
  outputDirectory: string;
  videoName: string;
  run(recording: VideoRecording, recorder: DemoRecorder): Promise<void>;
}

/** Runs a scenario under the recorder and writes narrated video, step screenshots and the timeline into the output directory. */
export async function produceVideo(job: VideoJob): Promise<void> {
  const { scenario, outputDirectory } = job;
  const rawVideoDirectory = join(outputDirectory, "raw");
  const screenshotDirectory = join(outputDirectory, "steps");
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(screenshotDirectory, { recursive: true });

  const narrationByLine = planNarration(scenario);
  const clipsByText = await synthesizeAll([
    ...narrationByLine.values(),
    ...planCaptions(scenario),
    ...openingNarrations(scenario),
  ]);
  const recorder = new DemoRecorder({
    narrationByLine,
    clipsByText,
    screenshotDirectory,
    story: scenario.story,
  });

  await job.run({ directory: rawVideoDirectory, size: VIDEO_SIZE }, recorder);

  const recordings = recorder.actorRecordings;
  if (recordings.length === 0) throw new Error(`no video recorded for "${scenario.name}"`);
  for (const recording of recordings) {
    await assemble({
      rawVideo: await recording.video.path(),
      trimStartSeconds: recording.trimStartMilliseconds / 1000,
      placements: recording.placements,
      endSeconds: recording.endSeconds,
      outputPath: join(outputDirectory, videoFileName(job, recording, recordings.length)),
    });
  }
  rmSync(rawVideoDirectory, { recursive: true, force: true });
  writeFileSync(
    join(outputDirectory, "timeline.json"),
    `${JSON.stringify(recorder.timeline, null, 2)}\n`,
  );
}

function videoFileName(job: VideoJob, recording: ActorRecording, actorCount: number): string {
  const stem = job.videoName.replace(/\.mp4$/, "");
  return actorCount === 1 ? `${stem}.mp4` : `${stem}-${scenarioSlug(recording.actor)}.mp4`;
}
