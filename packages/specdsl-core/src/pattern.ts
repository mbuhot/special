/**
 * Pattern mini-language: compiles a pattern string into a matcher over text.
 *
 * Syntax: `word` (case-insensitive literal, `a|an` alternatives), `<Slot>`, `<Slot:kind>`,
 * `<Slot.kind>`, `<Alias=Slot>` (slot named Alias in namespace Slot), `"<Slot>"` (quoted source),`<on|off>` / `<Name=on|off>` (enumeration),
 * `[ ... ]` (optional group), `<A> <B>, ...` and `<A> -> ...` (repeat with separator).
 * A bare slot followed by another slot takes one token; otherwise it takes one or more tokens.
 */

export type ListValue = string | ListValue[];

export type SlotOccurrence = "required" | "optional" | "repeated";
export type SlotCapture = "entry" | "kind" | "enumeration";
export type SlotSource = "bare" | "quoted";
export type SlotArgument = "included" | "omitted";

export interface SlotDescriptor {
  name: string;
  namespace: string;
  constraint?: string;
  capture: SlotCapture;
  source: SlotSource;
  enumeration: readonly string[];
  argument: SlotArgument;
  occurrence: SlotOccurrence;
}

export interface Match {
  slots: Record<string, string>;
  kinds: Record<string, SlotDescriptor>;
  lists: Record<string, ListValue[]>;
  pairs: [string, string][];
  optionals: boolean[];
}

/** Supplies declared names per namespace so bare slots can span multi-word names. */
export interface Lexicon {
  names(namespace: string): readonly string[];
}

export interface Matcher {
  (text: string, lexicon?: Lexicon): Match | null;
  readonly source: string;
  readonly slots: readonly SlotDescriptor[];
  readonly literalWords: readonly string[];
  readonly pairSlotNames: readonly [string, string] | null;
  readonly sample: string;
}

export class PatternError extends Error {}

interface TextToken {
  text: string;
  quoted: boolean;
  start: number;
  end: number;
}

interface SlotElement {
  type: "slot";
  descriptor: SlotDescriptor;
  span: "single" | "multiple";
}

interface LiteralElement {
  type: "literal";
  alternatives: readonly string[];
}

type Segment = { type: "literal"; text: string } | { type: "slot"; descriptor: SlotDescriptor };

interface CompositeElement {
  type: "composite";
  expression: RegExp;
  segments: Segment[];
}

interface OptionalElement {
  type: "optional";
  index: number;
  elements: Element[];
}

interface RepeatElement {
  type: "repeat";
  separator: string;
  unit: Element[];
}

type Element = SlotElement | LiteralElement | CompositeElement | OptionalElement | RepeatElement;

type PatternToken =
  | { type: "open" }
  | { type: "close" }
  | { type: "comma" }
  | { type: "ellipsis" }
  | { type: "word"; text: string };

interface Bindings {
  slots: Readonly<Record<string, string>>;
  lists: Readonly<Record<string, ListValue[]>>;
  optionals: Readonly<Record<number, boolean>>;
}

interface MatchState {
  position: number;
  bindings: Bindings;
}

interface Input {
  tokens: TextToken[];
  source: string;
  lexicon: Lexicon | undefined;
}

const LEADING_KEYWORDS = new Set(["given", "when", "then", "and", "but"]);

/** Compiles a pattern string into a matcher; throws PatternError on malformed patterns. */
export function compilePattern(source: string): Matcher {
  const parser = new PatternParser(tokenizePattern(source));
  const elements = parser.parse();
  const descriptors = collectDescriptors(elements);
  const optionalCount = parser.optionalCount;
  const pairSlotNames = findPairSlotNames(elements);
  const kinds = Object.fromEntries(descriptors.map((descriptor) => [descriptor.name, descriptor]));

  const match = (text: string, lexicon?: Lexicon): Match | null => {
    const normalized = text.trim().replace(/\.$/, "");
    const input: Input = { tokens: tokenizeText(normalized), source: normalized, lexicon };
    const result = firstCompleteMatch(elements, input);
    if (result === null) {
      return null;
    }
    return buildMatch(result.bindings, kinds, pairSlotNames, optionalCount);
  };

  return Object.assign(match, {
    source,
    slots: descriptors,
    literalWords: literalWordsOf(elements),
    pairSlotNames,
    sample: sampleTokens(elements).join(" "),
  });
}

function tokenizePattern(source: string): PatternToken[] {
  const tokens: PatternToken[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index] as string;
    if (/\s/.test(character)) {
      index += 1;
    } else if (character === "[") {
      tokens.push({ type: "open" });
      index += 1;
    } else if (character === "]") {
      tokens.push({ type: "close" });
      index += 1;
    } else if (character === ",") {
      tokens.push({ type: "comma" });
      index += 1;
    } else {
      const end = wordEnd(source, index);
      pushWord(tokens, source.slice(index, end));
      index = end;
    }
  }
  return tokens;
}

function wordEnd(source: string, start: number): number {
  let index = start;
  while (index < source.length && !/[\s\[\],]/.test(source[index] as string)) {
    const closing = source[index] === "<" ? ">" : source[index] === '"' ? '"' : null;
    if (closing === null) {
      index += 1;
    } else {
      const close = source.indexOf(closing, index + 1);
      if (close < 0) {
        throw new PatternError(`Unterminated "${source[index]}" in pattern: ${source}`);
      }
      index = close + 1;
    }
  }
  return index;
}

function pushWord(tokens: PatternToken[], text: string): void {
  if (text === "...") {
    tokens.push({ type: "ellipsis" });
  } else if (text.length > 1 && text.endsWith(":")) {
    tokens.push({ type: "word", text: text.slice(0, -1) }, { type: "word", text: ":" });
  } else {
    tokens.push({ type: "word", text });
  }
}

class PatternParser {
  optionalCount = 0;
  private position = 0;

  constructor(private readonly tokens: PatternToken[]) {}

  parse(): Element[] {
    return markSpans(this.parseSequence(false));
  }

  private parseSequence(inOptional: boolean): Element[] {
    const elements: Element[] = [];
    while (this.position < this.tokens.length) {
      const token = this.tokens[this.position] as PatternToken;
      this.position += 1;
      if (token.type === "close") {
        if (!inOptional) {
          throw new PatternError("Unbalanced ']' in pattern");
        }
        return elements;
      }
      this.parseToken(token, elements, inOptional);
    }
    if (inOptional) {
      throw new PatternError("Unterminated '[' in pattern");
    }
    return elements;
  }

  private parseToken(token: PatternToken, elements: Element[], inOptional: boolean): void {
    if (token.type === "open") {
      const index = this.optionalCount;
      this.optionalCount += 1;
      elements.push({ type: "optional", index, elements: markSpans(this.parseSequence(true)) });
    } else if (token.type === "ellipsis") {
      throw new PatternError("'...' must follow a separator");
    } else if (token.type === "comma" || (token.type === "word" && token.text === "->")) {
      const separator = token.type === "comma" ? "," : "->";
      if (this.tokens[this.position]?.type === "ellipsis") {
        this.position += 1;
        elements.push(makeRepeat(elements, separator));
      } else {
        elements.push({ type: "literal", alternatives: [separator] });
      }
    } else if (token.type === "word") {
      elements.push(wordElement(token.text, inOptional));
    }
  }
}

function makeRepeat(elements: Element[], separator: string): RepeatElement {
  const unit: Element[] = [];
  while (elements.length > 0) {
    const last = elements[elements.length - 1] as Element;
    if (last.type === "literal" || last.type === "optional") {
      break;
    }
    unit.unshift(elements.pop() as Element);
  }
  if (unit.length === 0) {
    throw new PatternError(`Nothing to repeat before '${separator} ...'`);
  }
  markRepeated(unit);
  return { type: "repeat", separator, unit: markSpans(unit) };
}

function markRepeated(elements: Element[]): void {
  for (const element of elements) {
    if (element.type === "slot") {
      element.descriptor.occurrence = "repeated";
    } else if (element.type === "composite") {
      for (const segment of element.segments) {
        if (segment.type === "slot") {
          segment.descriptor.occurrence = "repeated";
        }
      }
    } else if (element.type === "repeat") {
      markRepeated(element.unit);
    }
  }
}

function markSpans(elements: Element[]): Element[] {
  elements.forEach((element, index) => {
    const following = elements[index + 1];
    if (element.type === "slot") {
      element.span =
        following?.type === "slot" || following?.type === "composite" ? "single" : "multiple";
    }
  });
  return elements;
}

function wordElement(text: string, inOptional: boolean): Element {
  const occurrence: SlotOccurrence = inOptional ? "optional" : "required";
  if (text.startsWith('"')) {
    const inner = text.slice(1, -1);
    if (!/^<[^<>]+>$/.test(inner)) {
      throw new PatternError(`Quoted pattern text must be a single slot: ${text}`);
    }
    return {
      type: "slot",
      span: "single",
      descriptor: parseSlot(inner.slice(1, -1), "quoted", occurrence),
    };
  }
  const segments = splitSegments(text, occurrence);
  const [only] = segments;
  if (segments.every((segment) => segment.type === "literal")) {
    return { type: "literal", alternatives: text.toLowerCase().split("|") };
  }
  if (segments.length === 1 && only?.type === "slot") {
    return { type: "slot", span: "multiple", descriptor: only.descriptor };
  }
  return { type: "composite", segments, expression: compositeExpression(segments) };
}

function splitSegments(text: string, occurrence: SlotOccurrence): Segment[] {
  const segments: Segment[] = [];
  const slotPattern = /<([^<>]+)>/g;
  let consumed = 0;
  for (const found of text.matchAll(slotPattern)) {
    const start = found.index ?? 0;
    if (start > consumed) {
      segments.push({ type: "literal", text: text.slice(consumed, start) });
    }
    segments.push({ type: "slot", descriptor: parseSlot(found[1] as string, "bare", occurrence) });
    consumed = start + found[0].length;
  }
  if (consumed < text.length) {
    segments.push({ type: "literal", text: text.slice(consumed) });
  }
  return segments;
}

function compositeExpression(segments: Segment[]): RegExp {
  const body = segments
    .map((segment) => (segment.type === "literal" ? escapeExpression(segment.text) : "(.+?)"))
    .join("");
  return new RegExp(`^${body}$`, "i");
}

function escapeExpression(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSlot(body: string, source: SlotSource, occurrence: SlotOccurrence): SlotDescriptor {
  if (body.includes("|")) {
    return parseEnumeration(body, source, occurrence);
  }
  const base = { source, occurrence, enumeration: [] as string[], argument: "included" as const };
  if (body.endsWith(".kind")) {
    const namespace = body.slice(0, -".kind".length);
    return { ...base, name: body, namespace, capture: "kind" };
  }
  const [alias, declaration] = body.includes("=") ? body.split("=") : [undefined, body];
  const [namespace, constraint] = (declaration as string).split(":");
  const name = alias ?? namespace;
  if (!isIdentifier(name) || !isIdentifier(namespace)) {
    throw new PatternError(`Invalid slot name in <${body}>`);
  }
  return constraint === undefined
    ? { ...base, name, namespace, capture: "entry" }
    : { ...base, name, namespace, constraint, capture: "entry" };
}

function isIdentifier(text: string | undefined): text is string {
  return text !== undefined && /^[A-Za-z][A-Za-z0-9_]*$/.test(text);
}

function parseEnumeration(
  body: string,
  source: SlotSource,
  occurrence: SlotOccurrence,
): SlotDescriptor {
  const separator = body.indexOf("=");
  const options = (separator < 0 ? body : body.slice(separator + 1)).split("|");
  return {
    name: separator < 0 ? options.join("|") : body.slice(0, separator),
    namespace: "",
    capture: "enumeration",
    source,
    enumeration: options,
    argument: separator < 0 ? "omitted" : "included",
    occurrence,
  };
}

function collectDescriptors(elements: Element[]): SlotDescriptor[] {
  const found = new Map<string, SlotDescriptor>();
  const visit = (list: Element[]): void => {
    for (const element of list) {
      if (element.type === "slot") {
        found.has(element.descriptor.name) ||
          found.set(element.descriptor.name, element.descriptor);
      } else if (element.type === "composite") {
        for (const segment of element.segments) {
          segment.type === "slot" &&
            !found.has(segment.descriptor.name) &&
            found.set(segment.descriptor.name, segment.descriptor);
        }
      } else if (element.type === "optional") {
        visit(element.elements);
      } else if (element.type === "repeat") {
        visit(element.unit);
      }
    }
  };
  visit(elements);
  return [...found.values()];
}

function scalarSlotNames(unit: Element[]): string[] {
  return unit.flatMap((element) => {
    if (element.type === "slot") {
      return element.descriptor.capture === "enumeration" ? [] : [element.descriptor.name];
    }
    if (element.type === "composite") {
      return element.segments.flatMap((segment) =>
        segment.type === "slot" ? [segment.descriptor.name] : [],
      );
    }
    return [];
  });
}

function findPairSlotNames(elements: Element[]): [string, string] | null {
  for (const element of elements) {
    const inner = element.type === "optional" ? findPairSlotNames(element.elements) : null;
    if (inner !== null) {
      return inner;
    }
    if (element.type === "repeat") {
      const names = scalarSlotNames(element.unit);
      if (names.length === 2) {
        return [names[0] as string, names[1] as string];
      }
    }
  }
  return null;
}

function literalWordsOf(elements: Element[]): string[] {
  return elements.flatMap((element) =>
    element.type === "literal"
      ? (element.alternatives[0] as string).split(/\s+/).filter((word) => /[a-z0-9]/i.test(word))
      : [],
  );
}

function sampleTokens(elements: Element[]): string[] {
  return elements.flatMap((element): string[] => {
    switch (element.type) {
      case "literal":
        return [element.alternatives[0] as string];
      case "slot":
        return [sampleSlot(element.descriptor)];
      case "composite":
        return [
          element.segments
            .map((segment) => (segment.type === "literal" ? segment.text : "sample"))
            .join(""),
        ];
      case "optional":
        return [];
      case "repeat":
        return sampleTokens(element.unit);
    }
  });
}

function sampleSlot(descriptor: SlotDescriptor): string {
  if (descriptor.capture === "enumeration") {
    return descriptor.enumeration[0] as string;
  }
  return descriptor.source === "quoted" ? '"sample"' : "sample";
}

function tokenizeText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index] as string;
    if (/\s/.test(character)) {
      index += 1;
    } else if (character === ",") {
      tokens.push({ text: ",", quoted: false, start: index, end: index + 1 });
      index += 1;
    } else {
      index = readTextToken(text, index, tokens);
    }
  }
  return tokens;
}

function readTextToken(text: string, start: number, tokens: TextToken[]): number {
  if (text[start] === '"') {
    const close = text.indexOf('"', start + 1);
    if (close >= 0) {
      tokens.push({ text: text.slice(start + 1, close), quoted: true, start, end: close + 1 });
      return close + 1;
    }
  }
  let end = start;
  while (end < text.length && !/[\s,]/.test(text[end] as string)) {
    end += 1;
  }
  const word = text.slice(start, end);
  if (word.length > 1 && word.endsWith(":")) {
    tokens.push({ text: word.slice(0, -1), quoted: false, start, end: end - 1 });
    tokens.push({ text: ":", quoted: false, start: end - 1, end });
  } else {
    tokens.push({ text: word, quoted: false, start, end });
  }
  return end;
}

function firstCompleteMatch(elements: Element[], input: Input): MatchState | null {
  const first = input.tokens[0];
  const skipLeading =
    first !== undefined &&
    !first.quoted &&
    input.tokens.length > 1 &&
    LEADING_KEYWORDS.has(first.text.toLowerCase());
  const start = skipLeading ? 1 : 0;
  const empty: Bindings = { slots: {}, lists: {}, optionals: {} };
  for (const state of matchFrom(elements, 0, input, start, empty)) {
    if (state.position === input.tokens.length) {
      return state;
    }
  }
  return null;
}

function* matchFrom(
  elements: Element[],
  index: number,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const element = elements[index];
  if (element === undefined) {
    yield { position, bindings };
    return;
  }
  for (const next of matchElement(element, input, position, bindings)) {
    yield* matchFrom(elements, index + 1, input, next.position, next.bindings);
  }
}

function* matchElement(
  element: Element,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  switch (element.type) {
    case "literal":
      yield* matchLiteral(element, input, position, bindings);
      return;
    case "slot":
      yield* matchSlot(element, input, position, bindings);
      return;
    case "composite":
      yield* matchComposite(element, input, position, bindings);
      return;
    case "optional":
      yield* matchOptional(element, input, position, bindings);
      return;
    case "repeat":
      yield* matchRepeat(element, input, position, bindings);
      return;
  }
}

function* matchLiteral(
  element: LiteralElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const token = input.tokens[position];
  if (
    token !== undefined &&
    !token.quoted &&
    element.alternatives.includes(token.text.toLowerCase())
  ) {
    yield { position: position + 1, bindings };
  }
}

function* matchSlot(
  element: SlotElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const { descriptor } = element;
  const token = input.tokens[position];
  if (token === undefined) {
    return;
  }
  if (descriptor.capture === "enumeration") {
    const allowed = descriptor.enumeration.map((option) => option.toLowerCase());
    if (!token.quoted && allowed.includes(token.text.toLowerCase())) {
      yield { position: position + 1, bindings: withSlot(bindings, descriptor.name, token.text) };
    }
  } else if (descriptor.source === "quoted") {
    if (token.quoted) {
      yield { position: position + 1, bindings: withSlot(bindings, descriptor.name, token.text) };
    }
  } else {
    yield* matchBareSlot(element, input, position, bindings);
  }
}

function* matchBareSlot(
  element: SlotElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const declaredLengths = declaredNameLengths(element.descriptor, input, position);
  const limit = element.span === "single" ? 1 : input.tokens.length - position;
  const fallbackLengths = Array.from({ length: limit }, (_, index) => index + 1);
  for (const length of [...declaredLengths, ...fallbackLengths]) {
    const covered = input.tokens.slice(position, position + length);
    if (covered.length < length || !covered.every(isSpannable)) {
      continue;
    }
    const value = spanValue(covered, input.source);
    yield {
      position: position + length,
      bindings: withSlot(bindings, element.descriptor.name, value),
    };
  }
}

function declaredNameLengths(descriptor: SlotDescriptor, input: Input, position: number): number[] {
  if (descriptor.capture !== "entry" || input.lexicon === undefined) {
    return [];
  }
  const lengths = input.lexicon
    .names(descriptor.namespace)
    .map((name) => name.toLowerCase().split(/\s+/))
    .filter((words) => startsWithWords(input.tokens, position, words))
    .map((words) => words.length);
  return [...new Set(lengths)].sort((first, second) => second - first);
}

function startsWithWords(tokens: TextToken[], position: number, words: string[]): boolean {
  return words.every((word, offset) => {
    const token = tokens[position + offset];
    return token !== undefined && !token.quoted && token.text.toLowerCase() === word;
  });
}

function isSpannable(token: TextToken): boolean {
  return token.quoted || (token.text !== "," && token.text !== "->");
}

function spanValue(covered: TextToken[], source: string): string {
  const [first] = covered;
  const last = covered[covered.length - 1];
  if (covered.length === 1 && first !== undefined) {
    return first.text;
  }
  return source.slice((first as TextToken).start, (last as TextToken).end);
}

function* matchComposite(
  element: CompositeElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const token = input.tokens[position];
  const found = token === undefined || token.quoted ? null : element.expression.exec(token.text);
  if (found === null) {
    return;
  }
  const descriptors = element.segments.flatMap((segment) =>
    segment.type === "slot" ? [segment.descriptor] : [],
  );
  const captured = descriptors.reduce(
    (current, descriptor, captureIndex) =>
      withSlot(current, descriptor.name, found[captureIndex + 1] as string),
    bindings,
  );
  yield { position: position + 1, bindings: captured };
}

function* matchOptional(
  element: OptionalElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  for (const state of matchFrom(element.elements, 0, input, position, bindings)) {
    yield { position: state.position, bindings: withOptional(state.bindings, element.index, true) };
  }
  yield { position, bindings: withOptional(bindings, element.index, false) };
}

function* matchRepeat(
  element: RepeatElement,
  input: Input,
  position: number,
  bindings: Bindings,
): Generator<MatchState> {
  const emptyIteration: Bindings = { slots: {}, lists: {}, optionals: {} };
  for (const iteration of matchFrom(element.unit, 0, input, position, emptyIteration)) {
    const merged = mergeIteration(bindings, iteration.bindings);
    const separator = input.tokens[iteration.position];
    if (separator !== undefined && !separator.quoted && separator.text === element.separator) {
      yield* matchRepeat(element, input, iteration.position + 1, merged);
    }
    yield { position: iteration.position, bindings: merged };
  }
}

function withSlot(bindings: Bindings, name: string, value: string): Bindings {
  return { ...bindings, slots: { ...bindings.slots, [name]: value } };
}

function withOptional(bindings: Bindings, index: number, present: boolean): Bindings {
  return { ...bindings, optionals: { ...bindings.optionals, [index]: present } };
}

function mergeIteration(bindings: Bindings, iteration: Bindings): Bindings {
  const lists: Record<string, ListValue[]> = { ...bindings.lists };
  for (const [name, value] of Object.entries(iteration.slots)) {
    lists[name] = [...(lists[name] ?? []), value];
  }
  for (const [name, value] of Object.entries(iteration.lists)) {
    lists[name] = [...(lists[name] ?? []), value];
  }
  return { ...bindings, lists };
}

function buildMatch(
  bindings: Bindings,
  kinds: Record<string, SlotDescriptor>,
  pairSlotNames: readonly [string, string] | null,
  optionalCount: number,
): Match {
  const optionals = Array.from(
    { length: optionalCount },
    (_, index) => bindings.optionals[index] ?? false,
  );
  return {
    slots: { ...bindings.slots },
    kinds,
    lists: { ...bindings.lists },
    pairs: pairsOf(bindings.lists, pairSlotNames),
    optionals,
  };
}

function pairsOf(
  lists: Readonly<Record<string, ListValue[]>>,
  names: readonly [string, string] | null,
): [string, string][] {
  if (names === null) {
    return [];
  }
  const firsts = lists[names[0]] ?? [];
  const seconds = lists[names[1]] ?? [];
  return firsts.flatMap((first, index) => {
    const second = seconds[index];
    return typeof first === "string" && typeof second === "string"
      ? [[first, second] as [string, string]]
      : [];
  });
}
