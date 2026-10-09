export interface SpecRange {
  start: number;
  end: number;
}

export interface ExtractedSpec {
  markdown: string;
  range: SpecRange;
}

const FENCED_SPEC = /^```spec[ \t]*\r?\n((?:[\s\S]*?\r?\n)?)```[ \t]*$/m;

/** Finds the spec in an issue description: a ```spec fence, or the whole text when it opens with "# ". */
export function extractSpec(description: string): ExtractedSpec | null {
  return extractFencedSpec(description) ?? extractWholeDescription(description);
}

/** Returns the description with the spec's range replaced by the given markdown. */
export function replaceSpec(description: string, markdown: string): string {
  const spec = extractSpec(description);
  if (spec === null) {
    throw new Error("Description contains no spec");
  }
  return description.slice(0, spec.range.start) + markdown + description.slice(spec.range.end);
}

function extractFencedSpec(description: string): ExtractedSpec | null {
  const match = FENCED_SPEC.exec(description);
  if (match === null) {
    return null;
  }
  const openingFenceLength = match[0].indexOf("\n") + 1;
  const markdown = (match[1] as string).replace(/\r?\n$/, "");
  const start = match.index + openingFenceLength;
  return { markdown, range: { start, end: start + markdown.length } };
}

function extractWholeDescription(description: string): ExtractedSpec | null {
  if (!description.startsWith("# ")) {
    return null;
  }
  return { markdown: description, range: { start: 0, end: description.length } };
}
