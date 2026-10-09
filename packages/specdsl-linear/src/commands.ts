import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import {
  bind,
  lint as lintSpec,
  parseMarkdown,
  type BindError,
  type Dialect,
  type LintWarning,
} from "@special/specdsl-core";
import { loadDialect } from "./dialect-loader.js";
import type { LinearClient, LinearIssue } from "./linear.js";
import { extractSpec } from "./spec-block.js";

export interface CommandContext {
  client: LinearClient;
  print: (line: string) => void;
  printError: (line: string) => void;
}

export interface PullOptions {
  dialectPath: string;
  outDir: string;
}

export interface LintOptions {
  dialectPath: string;
  comment: boolean;
}

export interface AttachOptions {
  files: string[];
  title?: string;
}

export type ExitCode = 0 | 1;

export interface SpecCheck {
  errors: BindError[];
  warnings: LintWarning[];
  scenarioCount: number;
}

type MediaType = "video/mp4" | "image/png" | "application/json" | "application/octet-stream";

const MEDIA_TYPES_BY_EXTENSION: Record<string, MediaType> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".json": "application/json",
};

/** Binds and lints spec markdown, labelling every diagnostic with the given file name. */
export function checkSpec(markdown: string, file: string, dialect: Dialect): SpecCheck {
  const result = bind(parseMarkdown(markdown), dialect, { file });
  if (!result.ok) {
    return { errors: result.errors, warnings: [], scenarioCount: 0 };
  }
  return {
    errors: [],
    warnings: lintSpec(result, dialect),
    scenarioCount: result.ast.scenarios.length,
  };
}

/** Builds the Linear comment body summarising a spec check. */
export function buildLintComment(check: SpecCheck): string {
  if (check.errors.length === 0 && check.warnings.length === 0) {
    return `Spec binds cleanly: ${check.scenarioCount} scenarios`;
  }
  const diagnostics = [
    ...check.errors.map((error) => formatDiagnostic("error", error)),
    ...check.warnings.map((warning) => formatDiagnostic("warning", warning)),
  ];
  const heading = `Spec check: ${countLabel(check.errors.length, "error")}, ${countLabel(check.warnings.length, "warning")}`;
  return [heading, "", ...diagnostics.map((line) => `- ${line}`)].join("\n");
}

/** Writes the issue's spec to `<outDir>/<identifier>.md` and reports bind errors and lint warnings. */
export async function pull(
  identifier: string,
  options: PullOptions,
  context: CommandContext,
): Promise<ExitCode> {
  const issue = await context.client.issue(identifier);
  const markdown = specMarkdown(issue, context);
  if (markdown === null) {
    return 1;
  }
  mkdirSync(options.outDir, { recursive: true });
  const specPath = join(options.outDir, `${issue.identifier}.md`);
  writeFileSync(specPath, `${markdown}\n`);
  context.print(`Wrote ${specPath}`);
  const check = checkSpec(markdown, issue.identifier, await loadDialect(options.dialectPath));
  reportCheck(check, context);
  return check.errors.length === 0 ? 0 : 1;
}

/** Binds and lints the issue's spec without writing it, optionally commenting the outcome. */
export async function lint(
  identifier: string,
  options: LintOptions,
  context: CommandContext,
): Promise<ExitCode> {
  const issue = await context.client.issue(identifier);
  const markdown = specMarkdown(issue, context);
  if (markdown === null) {
    return 1;
  }
  const check = checkSpec(markdown, issue.identifier, await loadDialect(options.dialectPath));
  reportCheck(check, context);
  if (options.comment) {
    await context.client.createComment(issue.id, buildLintComment(check));
  }
  return check.errors.length === 0 ? 0 : 1;
}

/** Uploads each file to Linear and attaches it to the issue. */
export async function attach(
  identifier: string,
  options: AttachOptions,
  context: CommandContext,
): Promise<ExitCode> {
  const issue = await context.client.issue(identifier);
  for (const file of options.files) {
    await uploadAndAttach(issue, file, options.title, context);
    context.print(`Attached ${file} to ${issue.identifier}`);
  }
  return 0;
}

async function uploadAndAttach(
  issue: LinearIssue,
  file: string,
  titleOverride: string | undefined,
  context: CommandContext,
): Promise<void> {
  const bytes = readFileSync(file);
  const filename = basename(file);
  const contentType = mediaTypeOf(filename);
  const target = await context.client.fileUpload(filename, contentType, bytes.length);
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000",
    ...target.headers,
  };
  await context.client.putFile(target.uploadUrl, headers, bytes);
  await context.client.attachmentCreate(issue.id, {
    url: target.assetUrl,
    title: attachmentTitle(file, titleOverride),
    subtitle: filename,
  });
}

function attachmentTitle(file: string, titleOverride: string | undefined): string {
  if (extname(file) !== ".mp4") {
    return basename(file);
  }
  if (titleOverride !== undefined) {
    return titleOverride;
  }
  const scenario = timelineScenario(join(dirname(file), "timeline.json"));
  return scenario === null ? basename(file) : `Demo: ${scenario}`;
}

function timelineScenario(timelinePath: string): string | null {
  let timeline: unknown;
  try {
    timeline = JSON.parse(readFileSync(timelinePath, "utf8"));
  } catch {
    return null;
  }
  const scenario = (timeline as { scenario?: unknown } | null)?.scenario;
  return typeof scenario === "string" ? scenario : null;
}

function mediaTypeOf(filename: string): MediaType {
  return MEDIA_TYPES_BY_EXTENSION[extname(filename)] ?? "application/octet-stream";
}

function specMarkdown(issue: LinearIssue, context: CommandContext): string | null {
  const spec = extractSpec(issue.description ?? "");
  if (spec === null) {
    context.printError(`${issue.identifier}: no spec found in description`);
    return null;
  }
  return spec.markdown;
}

function reportCheck(check: SpecCheck, context: CommandContext): void {
  check.errors.forEach((error) => context.printError(formatDiagnostic("error", error)));
  check.warnings.forEach((warning) => context.printError(formatDiagnostic("warning", warning)));
}

function formatDiagnostic(severity: "error" | "warning", diagnostic: BindError): string {
  return `${diagnostic.file}:${diagnostic.line}: ${severity}: ${diagnostic.message}`;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
