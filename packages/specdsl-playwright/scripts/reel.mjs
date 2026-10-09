import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FFMPEG_BINARY = "/opt/homebrew/bin/ffmpeg";
const FFPROBE_BINARY = "/opt/homebrew/bin/ffprobe";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const specsDirectory = join(repositoryRoot, "specs");
const demoOutputDirectory = join(repositoryRoot, "demo-output");
const reelPath = join(demoOutputDirectory, "reel.mp4");
const playlistPath = join(demoOutputDirectory, "reel.m3u8");

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scenarioNamesInSpecOrder() {
  return readdirSync(specsDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ast.json"))
    .sort()
    .flatMap((file) => {
      const spec = JSON.parse(readFileSync(join(specsDirectory, file), "utf8"));
      const project = dirname(file);
      return spec.scenarios.map((scenario) => ({ project, name: scenario.name }));
    });
}

function videosFor(scenario) {
  const directory = join(demoOutputDirectory, slug(scenario.name));
  const timelinePath = join(directory, "timeline.json");
  if (!existsSync(timelinePath)) return [];
  const timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
  const actors = [...new Set(timeline.map((entry) => entry.actor))];
  if (actors.length === 1) return [{ title: scenario.name, file: join(directory, "demo.mp4") }];
  return actors.map((actor) => ({
    title: `${scenario.name} (${actor})`,
    file: join(directory, `demo-${slug(actor)}.mp4`),
  }));
}

function durationSeconds(file) {
  const output = execFileSync(FFPROBE_BINARY, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return Number(output.toString().trim());
}

function escapeForConcatList(path) {
  return path.replace(/'/g, "'\\''");
}

function escapeForMetadata(text) {
  return text.replace(/[=;#\\\n]/g, (character) => `\\${character}`);
}

const videos = scenarioNamesInSpecOrder()
  .flatMap((scenario) =>
    videosFor(scenario).map((video) => ({ ...video, project: scenario.project })),
  )
  .map((video) => ({ ...video, seconds: durationSeconds(video.file) }));

if (videos.length === 0) {
  console.error("no demo videos found; run `pnpm demo` first");
  process.exit(1);
}

let cursorMilliseconds = 0;
const chapters = videos.map((video) => {
  const start = cursorMilliseconds;
  cursorMilliseconds += Math.round(video.seconds * 1000);
  return `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${start}\nEND=${cursorMilliseconds}\ntitle=${escapeForMetadata(`${video.project}: ${video.title}`)}\n`;
});
const metadataPath = join(demoOutputDirectory, "reel.ffmetadata");
writeFileSync(metadataPath, `;FFMETADATA1\ntitle=Demo reel\n\n${chapters.join("\n")}`);

const concatListPath = join(demoOutputDirectory, "reel.txt");
writeFileSync(
  concatListPath,
  videos.map((video) => `file '${escapeForConcatList(video.file)}'`).join("\n") + "\n",
);

const playlist = [
  "#EXTM3U",
  ...videos.flatMap((video) => [
    `#EXTINF:${Math.round(video.seconds)},${video.project}: ${video.title}`,
    relative(demoOutputDirectory, video.file),
  ]),
];
writeFileSync(playlistPath, playlist.join("\n") + "\n");

execFileSync(
  FFMPEG_BINARY,
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-i",
    metadataPath,
    "-map_metadata",
    "1",
    "-c",
    "copy",
    reelPath,
  ],
  { stdio: "inherit" },
);

const totalMinutes = (cursorMilliseconds / 60_000).toFixed(1);
console.log(`${videos.length} videos, ${totalMinutes} min`);
console.log(relative(repositoryRoot, reelPath));
console.log(relative(repositoryRoot, playlistPath));
