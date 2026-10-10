import type {
  ConditionNode,
  ComparisonOp,
  CountNode,
  DerivedKind,
  EntityNode,
  FieldNode,
  PredicateNode,
} from "./ast.js";
import type { Match } from "./pattern.js";
import type { Registry } from "./registry.js";

export interface DerivedSource {
  kind: DerivedKind;
  match: Match;
  file: string;
  line: number;
}

export interface DerivedContext {
  registry: Registry;
  model: Record<string, EntityNode>;
  predicates: readonly PredicateNode[];
  report: (message: string) => void;
}

const COMPARISON = /^(.+?)\s+is\s+(?:(not|before|after)\s+)?(\S.*)$/i;
const WITHIN = /^(.+?)\s+is\s+within\s+(\S+)\s+days?\s+of\s+today$/i;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TYPES = new Set(["date", "datetime"]);

/** Resolves a matched Derived line against the declared model into a predicate node; reports and returns undefined on unknown names or malformed conditions. */
export function resolvePredicate(
  source: DerivedSource,
  context: DerivedContext,
): PredicateNode | undefined {
  const entity = lookupEntity(source, context);
  const name = source.match.slots["Predicate"] ?? "";
  const condition =
    entity === undefined
      ? undefined
      : new ConditionParser(entity, context).parse(source.match.slots["Condition"] ?? "");
  return entity === undefined || condition === undefined
    ? undefined
    : { entity, name, condition, file: source.file, line: source.line };
}

/** Resolves a matched count line into a count node over a declared predicate. */
export function resolveCount(
  source: DerivedSource,
  context: DerivedContext,
): CountNode | undefined {
  const entity = lookupEntity(source, context);
  const predicate = source.match.slots["Predicate"] ?? "";
  const known = context.predicates.find(
    (candidate) =>
      candidate.entity === entity && candidate.name.toLowerCase() === predicate.toLowerCase(),
  );
  return entity === undefined || known === undefined
    ? undefined
    : {
        name: source.match.slots["Name"] ?? "",
        entity,
        predicate: known.name,
        file: source.file,
        line: source.line,
      };
}

function lookupEntity(source: DerivedSource, context: DerivedContext): string | undefined {
  return context.registry.lookup("Entity", source.match.slots["Entity"] ?? "", "")?.name;
}

class ConditionParser {
  constructor(
    private readonly entity: string,
    private readonly context: DerivedContext,
  ) {}

  parse(text: string): ConditionNode | undefined {
    const groups = text.split(/\s+or\s+/i).map((group) => this.conjunction(group));
    return groups.some((group) => group === undefined)
      ? undefined
      : fold(groups as ConditionNode[], "or");
  }

  private conjunction(text: string): ConditionNode | undefined {
    const comparisons = text.split(/\s+and\s+/i).map((comparison) => this.comparison(comparison));
    return comparisons.some((comparison) => comparison === undefined)
      ? undefined
      : fold(comparisons as ConditionNode[], "and");
  }

  private comparison(text: string): ConditionNode | undefined {
    const within = WITHIN.exec(text.trim());
    return within === null ? this.valueComparison(text) : this.withinToday(within);
  }

  private withinToday(parsed: RegExpExecArray): ConditionNode | undefined {
    const field = this.field(parsed[1] as string);
    const count = parsed[2] as string;
    const label = `${this.entity}.${field?.name ?? (parsed[1] as string).trim()}`;
    const dated = field === undefined || this.isDate(field, label);
    const valid = POSITIVE_INTEGER.test(count);
    valid || this.context.report(`"${count}" is not a positive whole number of days`);
    return field === undefined || !dated || !valid
      ? undefined
      : { op: "within", field: field.name, days: Number(count) };
  }

  private isDate(field: FieldNode, label: string): boolean {
    const dated = field.type !== undefined && DATE_TYPES.has(field.type);
    dated || this.context.report(`${label} is not a date and cannot be compared with within`);
    return dated;
  }

  private valueComparison(text: string): ConditionNode | undefined {
    const parsed = COMPARISON.exec(text.trim());
    if (parsed === null) {
      this.context.report(
        `Unrecognized condition "${text.trim()}"; expected "<Field> is [not|before|after] <Value>"`,
      );
      return undefined;
    }
    const field = this.field(parsed[1] as string);
    const op = comparisonOp(parsed[2]);
    const value = (parsed[3] as string).trim();
    const checked = field === undefined ? undefined : this.checkedValue(field, op, value);
    return field === undefined || checked === undefined
      ? undefined
      : { op, field: field.name, value: checked };
  }

  private field(name: string): FieldNode | undefined {
    const entry = this.context.registry.lookup("Field", name.trim(), this.entity);
    const found = this.context.model[this.entity]?.fields.find(
      (candidate) => candidate.name === entry?.name,
    );
    entry === undefined && this.context.report(`Unknown Field "${name.trim()}" of ${this.entity}`);
    entry?.kind === "relation" &&
      this.context.report(`${this.entity}.${entry.name} is a relation and cannot be compared`);
    return entry?.kind === "relation" ? undefined : found;
  }

  private checkedValue(field: FieldNode, op: ComparisonOp, value: string): string | undefined {
    const label = `${this.entity}.${field.name}`;
    if (this.isEnum(field)) {
      return this.enumValue(field, op, value, label);
    }
    if (field.type !== undefined && DATE_TYPES.has(field.type)) {
      return this.dateValue(value, label);
    }
    const ordering = op === "before" || op === "after";
    ordering && this.context.report(`${label} is not a date and cannot be compared with ${op}`);
    return ordering ? undefined : value;
  }

  private isEnum(field: FieldNode): boolean {
    return this.states(field).length > 0;
  }

  private states(field: FieldNode): string[] {
    const declared = this.context.registry
      .inScope("State", `${this.entity}.${field.name}`)
      .map((entry) => entry.name);
    return declared.length > 0 ? declared : (field.values ?? []);
  }

  private enumValue(
    field: FieldNode,
    op: ComparisonOp,
    value: string,
    label: string,
  ): string | undefined {
    const state = this.states(field).find((name) => name.toLowerCase() === value.toLowerCase());
    const ordering = op === "before" || op === "after";
    ordering && this.context.report(`${label} is not a date and cannot be compared with ${op}`);
    state === undefined &&
      !ordering &&
      this.context.report(`"${value}" is not a value of ${label}`);
    return ordering ? undefined : state;
  }

  private dateValue(value: string, label: string): string | undefined {
    const valid = value.toLowerCase() === "today" || ISO_DATE.test(value);
    valid || this.context.report(`"${value}" is not a date for ${label}; use today or YYYY-MM-DD`);
    return valid ? value.toLowerCase() : undefined;
  }
}

function comparisonOp(word: string | undefined): ComparisonOp {
  return word === undefined
    ? "is"
    : word.toLowerCase() === "not"
      ? "is not"
      : (word.toLowerCase() as ComparisonOp);
}

function fold(nodes: ConditionNode[], op: "and" | "or"): ConditionNode {
  const [first, ...rest] = nodes as [ConditionNode, ...ConditionNode[]];
  return rest.reduce<ConditionNode>((left, right) => ({ op, left, right }), first);
}
