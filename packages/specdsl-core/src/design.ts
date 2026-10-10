import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BindSuccess } from "./ast.js";
import type { LintWarning } from "./lint.js";

const ARTBOARD_SUFFIX = ".dc.html";
const SURFACE_ATTRIBUTE = /\bdata-surface="([^"]*)"/g;
const CONTROL_ATTRIBUTE = /\bdata-control="([^"]*)"/g;
const DEFAULT_STATE = "default";

export interface Artboard {
  state: string;
  file: string;
  surfaces: string[];
  controls: string[];
}

/** Names of the artboard files (without suffix) in a design directory, `default` first, then alphabetical. */
export function artboardStates(designDirectory: string): string[] {
  const states = isDirectory(designDirectory)
    ? readdirSync(designDirectory)
        .filter((name) => name.endsWith(ARTBOARD_SUFFIX))
        .map((name) => name.slice(0, -ARTBOARD_SUFFIX.length))
        .sort()
    : [];
  return [
    ...states.filter((state) => state === DEFAULT_STATE),
    ...states.filter((state) => state !== DEFAULT_STATE),
  ];
}

/** Reads the `data-surface` and `data-control` values of one artboard's markup. */
export function parseArtboard(markup: string, state: string, file: string): Artboard {
  return {
    state,
    file,
    surfaces: attributeValues(markup, SURFACE_ATTRIBUTE),
    controls: attributeValues(markup, CONTROL_ATTRIBUTE),
  };
}

/** Reads every artboard in a design directory. */
export function readArtboards(designDirectory: string): Artboard[] {
  return artboardStates(designDirectory).map((state) => {
    const file = join(designDirectory, `${state}${ARTBOARD_SUFFIX}`);
    return parseArtboard(readFileSync(file, "utf8"), state, file);
  });
}

/** Compares each surface's declared controls with the artboards its design link names. */
export function designLint(result: BindSuccess, designsDirectory: string): LintWarning[] {
  const sharedControls = controlsOfSharedSurfaces(result);
  return Object.entries(result.ast.surfaces).flatMap(([name, surface]) =>
    surface.design === undefined
      ? []
      : lintSurface(result, name, surface.design, designsDirectory, sharedControls),
  );
}

function lintSurface(
  result: BindSuccess,
  surfaceName: string,
  design: string,
  designsDirectory: string,
  sharedControls: ReadonlySet<string>,
): LintWarning[] {
  const site = declarationSite(result, surfaceName);
  const warn = (message: string): LintWarning => ({ ...site, message });
  const artboards = readArtboards(join(designsDirectory, design));
  if (artboards.length === 0) {
    return [warn(`Surface ${surfaceName} has no artboard in designs/${design}`)];
  }
  const declared = declaredControls(result, surfaceName);
  const available = new Set(Object.keys(result.ast.surfaces[surfaceName]?.controls ?? {}));
  const shared = new Set(sharedSurfaceNames(result));
  const designed = new Set(artboards.flatMap((artboard) => artboard.controls));
  return [
    ...declared
      .filter((control) => !designed.has(control))
      .map((control) =>
        warn(`Control "${control}" on ${surfaceName} is not in any artboard of designs/${design}`),
      ),
    ...artboards.flatMap((artboard) => [
      ...artboard.controls
        .filter((control) => !available.has(control) && !sharedControls.has(control))
        .map((control) =>
          warn(
            `Control "${control}" in ${relativeName(design, artboard)} is not declared on ${surfaceName}`,
          ),
        ),
      ...surfaceMismatches(artboard, surfaceName, shared).map((found) =>
        warn(
          `${relativeName(design, artboard)} has data-surface "${found}", expected "${surfaceName}"`,
        ),
      ),
    ]),
  ].filter(uniqueMessage());
}

function surfaceMismatches(
  artboard: Artboard,
  surfaceName: string,
  shared: ReadonlySet<string>,
): string[] {
  return artboard.surfaces.filter((found) => found !== surfaceName && !shared.has(found));
}

function relativeName(design: string, artboard: Artboard): string {
  return `designs/${design}/${artboard.state}${ARTBOARD_SUFFIX}`;
}

function uniqueMessage(): (warning: LintWarning) => boolean {
  const seen = new Set<string>();
  return (warning) => !seen.has(warning.message) && seen.add(warning.message) !== undefined;
}

function sharedSurfaceNames(result: BindSuccess): string[] {
  return Object.entries(result.ast.surfaces)
    .filter(([, surface]) => surface.shared === true)
    .map(([name]) => name);
}

function controlsOfSharedSurfaces(result: BindSuccess): Set<string> {
  return new Set(
    sharedSurfaceNames(result).flatMap((name) =>
      Object.keys(result.ast.surfaces[name]?.controls ?? {}),
    ),
  );
}

function declaredControls(result: BindSuccess, surfaceName: string): string[] {
  return result.analysis.declarations
    .filter(
      (declaration) =>
        declaration.kind === "Control" && declaration.data["Surface"] === surfaceName,
    )
    .map((declaration) => declaration.data["Control"] as string);
}

function declarationSite(result: BindSuccess, surfaceName: string): { file: string; line: number } {
  const first = result.analysis.declarations.find(
    (declaration) => declaration.kind === "Control" && declaration.data["Surface"] === surfaceName,
  );
  return { file: first?.file ?? result.file, line: first?.line ?? 1 };
}

function attributeValues(markup: string, attribute: RegExp): string[] {
  return [
    ...new Set([...markup.matchAll(attribute)].map((found) => decodeEntities(found[1] as string))),
  ];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}
