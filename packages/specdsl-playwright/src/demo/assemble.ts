import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const FFMPEG_BINARY = "/opt/homebrew/bin/ffmpeg";
const AUDIO_SAMPLE_RATE = 44_100;

export interface ClipPlacement {
  file: string;
  startSeconds: number;
}

export interface AssemblyRequest {
  rawVideo: string;
  trimStartSeconds: number;
  placements: readonly ClipPlacement[];
  outputPath: string;
  endSeconds?: number;
}

/** Encodes the recorded video to h264 and mixes each narration clip in at its start time. */
export async function assemble(request: AssemblyRequest): Promise<void> {
  const clipInputs = request.placements.flatMap((placement) => ["-i", placement.file]);
  await run(FFMPEG_BINARY, [
    "-y",
    "-ss",
    request.trimStartSeconds.toFixed(3),
    "-i",
    request.rawVideo,
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`,
    ...clipInputs,
    "-filter_complex",
    filterGraph(request),
    "-map",
    "[video]",
    "-map",
    "[mixed]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    ...durationLimit(request.endSeconds),
    request.outputPath,
  ]);
}

function filterGraph(request: AssemblyRequest): string {
  const videoFilter =
    request.endSeconds === undefined
      ? "null"
      : `tpad=stop_mode=clone:stop_duration=${request.endSeconds.toFixed(3)}`;
  return `[0:v]${videoFilter}[video];${audioFilter(request.placements)}`;
}

function durationLimit(endSeconds: number | undefined): string[] {
  return endSeconds === undefined ? [] : ["-t", endSeconds.toFixed(3)];
}

function audioFilter(placements: readonly ClipPlacement[]): string {
  const delayedClips = placements.map((placement, index) => {
    const delayMilliseconds = Math.round(placement.startSeconds * 1000);
    return `[${index + 2}:a]aresample=${AUDIO_SAMPLE_RATE},aformat=channel_layouts=stereo,adelay=${delayMilliseconds}:all=1[clip${index}]`;
  });
  const mixInputs = ["[1:a]", ...placements.map((_, index) => `[clip${index}]`)].join("");
  const mix = `${mixInputs}amix=inputs=${placements.length + 1}:normalize=0:duration=longest[mixed]`;
  return [...delayedClips, mix].join(";");
}
