import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { ttsCacheDirectory } from "../paths.js";

const run = promisify(execFile);

const POCKET_TTS_BINARY = "/opt/homebrew/bin/pocket-tts";
const FFPROBE_BINARY = "/opt/homebrew/bin/ffprobe";

export interface Clip {
  text: string;
  file: string;
  seconds: number;
}

/** Synthesises narration text to a wav file cached by the SHA-256 of the text. */
export async function synthesize(text: string): Promise<Clip> {
  const file = join(ttsCacheDirectory, `${createHash("sha256").update(text).digest("hex")}.wav`);
  mkdirSync(ttsCacheDirectory, { recursive: true });
  if (!existsSync(file)) {
    await run(POCKET_TTS_BINARY, ["generate", "--text", text, "--output-path", file, "--quiet"]);
  }
  return { text, file, seconds: await durationSeconds(file) };
}

export async function synthesizeAll(texts: Iterable<string>): Promise<Map<string, Clip>> {
  const clips = new Map<string, Clip>();
  for (const text of new Set(texts)) clips.set(text, await synthesize(text));
  return clips;
}

export async function durationSeconds(mediaFile: string): Promise<number> {
  const { stdout } = await run(FFPROBE_BINARY, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    mediaFile,
  ]);
  return Number(stdout.trim());
}
