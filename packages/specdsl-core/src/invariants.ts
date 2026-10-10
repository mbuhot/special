import type { ConditionNode, FormulaNode, InvariantKind, InvariantNode, SpecAst } from "./ast.js";
import { dependencyCycle, invariantOutput } from "./formula.js";
import { parseCondition, type DerivedContext } from "./derived.js";
import type { ListValue, Match } from "./pattern.js";
import type { Registry } from "./registry.js";

export interface InvariantSource {
  kind: InvariantKind;
  match: Match;
  file: string;
  line: number;
}

export interface InvariantContext {
  registry: Registry;
  model: SpecAst["model"];
  report: (message: string) => void;
}

/** Resolves a matched invariant line against the declared model into an AST node; reports and returns undefined on unknown names. */
export function resolveInvariant(
  source: InvariantSource,
  context: InvariantContext,
): InvariantNode | undefined {
  return new InvariantResolver(source, context).resolve();
}

class InvariantResolver {
  private readonly site: { file: string; line: number };

  constructor(
    private readonly source: InvariantSource,
    private readonly context: InvariantContext,
  ) {
    this.site = { file: source.file, line: source.line };
  }

  resolve(): InvariantNode | undefined {
    switch (this.source.kind) {
      case "formula":
        return this.formula();
      case "unique":
        return this.unique();
      case "frozen-except":
        return this.frozenExcept();
      case "same-parent":
        return this.sameParent();
      case "sequence":
        return this.sequence();
    }
  }

  private slot(name: string): string {
    return this.source.match.slots[name] ?? "";
  }

  private entity(name: string): string | undefined {
    const found = this.context.registry.lookup("Entity", name, "")?.name;
    found === undefined && this.context.report(`Unknown Entity "${name}"`);
    return found;
  }

  private field(entity: string, name: string): string | undefined {
    const found = this.context.registry.lookup("Field", name, entity)?.name;
    found === undefined && this.context.report(`Unknown Field "${name}" of ${entity}`);
    return found;
  }

  private action(entity: string, name: string): string | undefined {
    const found = this.context.registry.lookup("Action", name, entity)?.name;
    found === undefined &&
      this.context.report(`Unknown Action "${name}" of ${entity}; declare it in Policies`);
    return found;
  }

  private formula(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const field = entity === undefined ? undefined : this.field(entity, this.slot("Field"));
    if (entity === undefined || field === undefined) {
      return undefined;
    }
    const expression = new ExpressionParser(entity, this.derivedContext()).parse(
      this.slot("Expression"),
    );
    const conditionText = this.source.match.slots["Condition"];
    const when =
      conditionText === undefined
        ? undefined
        : parseCondition(entity, conditionText, this.derivedContext());
    if (expression === undefined || (conditionText !== undefined && when === undefined)) {
      return undefined;
    }
    return (
      (when === undefined ? plainShape(entity, field, expression, this.site) : undefined) ?? {
        kind: "formula",
        entity,
        field,
        expression,
        ...(when === undefined ? {} : { when }),
        ...this.site,
      }
    );
  }

  private derivedContext(): DerivedContext {
    return {
      registry: this.context.registry,
      model: this.context.model,
      predicates: [],
      report: this.context.report,
    };
  }

  private unique(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const field = entity === undefined ? undefined : this.field(entity, this.slot("Field"));
    return entity === undefined || field === undefined
      ? undefined
      : { kind: "unique", entity, field, ...this.site };
  }

  private frozenExcept(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    if (entity === undefined) {
      return undefined;
    }
    const field = this.field(entity, this.slot("Field"));
    const actions = flatten(this.source.match.lists["Action"] ?? []).map((name) =>
      this.action(entity, name),
    );
    return field === undefined || actions.some((action) => action === undefined)
      ? undefined
      : { kind: "frozen-except", entity, field, actions: actions as string[], ...this.site };
  }

  private sameParent(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const target = this.entity(this.slot("Target"));
    if (entity === undefined || target === undefined) {
      return undefined;
    }
    const relation = this.field(entity, this.slot("Relation"));
    const relationEntity =
      relation === undefined ? undefined : this.relationTarget(entity, relation);
    const parent = this.parentRelation(entity, target);
    const relationParent =
      relationEntity === undefined ? undefined : this.parentRelation(relationEntity, target);
    return relation === undefined ||
      relationEntity === undefined ||
      parent === undefined ||
      relationParent === undefined
      ? undefined
      : {
          kind: "same-parent",
          entity,
          target,
          relation,
          parent,
          relationEntity,
          relationParent,
          ...this.site,
        };
  }

  private relationTarget(entity: string, relation: string): string | undefined {
    const entry = this.context.registry.lookup("Field", relation, entity);
    const target = entry?.kind === "relation" ? entry.data["target"] : undefined;
    target === undefined && this.context.report(`${entity}.${relation} is not a relation`);
    return target;
  }

  private parentRelation(entity: string, target: string): string | undefined {
    const entry = this.context.registry
      .inScope("Field", entity)
      .find((candidate) => candidate.kind === "relation" && candidate.data["target"] === target);
    entry === undefined && this.context.report(`${entity} does not belong to ${target}`);
    return entry?.name;
  }

  private sequence(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const field = entity === undefined ? undefined : this.field(entity, this.slot("Field"));
    const width = Number(this.slot("Width"));
    const validWidth = Number.isInteger(width) && width > 0;
    validWidth || this.context.report(`"${this.slot("Width")}" is not a digit count`);
    return entity === undefined || field === undefined || !validWidth
      ? undefined
      : { kind: "sequence", entity, field, prefix: this.slot("Prefix"), width, ...this.site };
  }
}

function flatten(values: readonly ListValue[]): string[] {
  return values.flatMap((value) => (typeof value === "string" ? [value] : flatten(value)));
}

/** Reports formula lines that share an unconditional target with another rule, and dependency cycles among computed fields. */
export function checkComputedFields(
  invariants: readonly InvariantNode[],
  report: (invariant: InvariantNode, message: string) => void,
): void {
  const unconditional = new Map<string, InvariantNode>();
  for (const invariant of invariants) {
    const conditional = invariant.kind === "formula" && invariant.when !== undefined;
    const computes =
      invariant.kind === "formula" || invariant.kind === "product" || invariant.kind === "sum";
    if (!computes || conditional) {
      continue;
    }
    const key = invariantOutput(invariant);
    const earlier = unconditional.get(key);
    earlier === undefined
      ? unconditional.set(key, invariant)
      : report(invariant, `${key} is already computed by ${earlier.file}:${earlier.line}`);
  }
  const cycle = dependencyCycle(invariants);
  const culprit = invariants.find(
    (invariant) =>
      (invariant.kind === "formula" || invariant.kind === "product" || invariant.kind === "sum") &&
      cycle.includes(invariantOutput(invariant)),
  );
  culprit !== undefined && report(culprit, `${cycle.join(" -> ")} is a dependency cycle`);
}

type Token =
  | { kind: "number"; value: number }
  | { kind: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" }
  | { kind: "text"; value: string };

const NUMERIC_TYPES = new Set(["integer", "decimal", "money"]);
const SUM_TERM = /^sum of\s+([^\s.]+)\.(.+?)(?:\s+where\s+(.+))?$/i;
const NUMBER_TEXT = /^\d+(?:\.\d+)?$/;
const OPERATOR_CHARACTERS = "+*/()";
const LETTER = /[A-Za-z]/;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pending = "";
  const flush = () => {
    const trimmed = pending.trim();
    pending = "";
    trimmed === "" ||
      tokens.push(
        NUMBER_TEXT.test(trimmed)
          ? { kind: "number", value: Number(trimmed) }
          : { kind: "text", value: trimmed },
      );
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string;
    const wordHyphen =
      character === "-" && LETTER.test(text[index - 1] ?? "") && LETTER.test(text[index + 1] ?? "");
    if (OPERATOR_CHARACTERS.includes(character) || (character === "-" && !wordHyphen)) {
      flush();
      tokens.push({ kind: "operator", value: character as "+" });
    } else {
      pending += character;
    }
  }
  flush();
  return tokens;
}

class ExpressionParser {
  private tokens: Token[] = [];
  private position = 0;
  private failed = false;

  constructor(
    private readonly entity: string,
    private readonly context: DerivedContext,
  ) {}

  parse(text: string): FormulaNode | undefined {
    this.tokens = tokenize(text);
    const expression = this.additive();
    const complete = this.position === this.tokens.length;
    complete || this.fail(text);
    return this.failed || !complete ? undefined : expression;
  }

  private fail(text: string): void {
    this.failed || this.context.report(`Unrecognized expression "${text.trim()}"`);
    this.failed = true;
  }

  private peekOperator(...operators: string[]): string | undefined {
    const token = this.tokens[this.position];
    return token?.kind === "operator" && operators.includes(token.value) ? token.value : undefined;
  }

  private additive(): FormulaNode | undefined {
    let left = this.multiplicative();
    for (let op = this.peekOperator("+", "-"); op !== undefined; op = this.peekOperator("+", "-")) {
      this.position += 1;
      const right = this.multiplicative();
      left =
        left === undefined || right === undefined
          ? undefined
          : { op: op as "+" | "-", left, right };
    }
    return left;
  }

  private multiplicative(): FormulaNode | undefined {
    let left = this.factor();
    for (let op = this.peekOperator("*", "/"); op !== undefined; op = this.peekOperator("*", "/")) {
      this.position += 1;
      const right = this.factor();
      left =
        left === undefined || right === undefined
          ? undefined
          : { op: op as "*" | "/", left, right };
    }
    return left;
  }

  private factor(): FormulaNode | undefined {
    const token = this.tokens[this.position];
    if (token === undefined) {
      this.fail("");
      return undefined;
    }
    this.position += 1;
    if (token.kind === "number") return { op: "number", value: token.value };
    if (token.kind === "text") return this.term(token.value);
    if (token.value === "-") return this.negated();
    if (token.value !== "(") {
      this.fail(token.value);
      return undefined;
    }
    const inner = this.additive();
    const closed = this.peekOperator(")") !== undefined;
    closed ? (this.position += 1) : this.fail("(");
    return closed ? inner : undefined;
  }

  private negated(): FormulaNode | undefined {
    const operand = this.factor();
    return operand === undefined
      ? undefined
      : { op: "-", left: { op: "number", value: 0 }, right: operand };
  }

  private term(text: string): FormulaNode | undefined {
    const parsed = SUM_TERM.exec(text);
    return parsed === null
      ? this.fieldTerm(text)
      : this.sumTerm(parsed[1] as string, parsed[2] as string, parsed[3]);
  }

  private fieldTerm(name: string): FormulaNode | undefined {
    const field = this.numericField(this.entity, name);
    return field === undefined ? undefined : { op: "field", field };
  }

  private numericField(entity: string, name: string): string | undefined {
    const entry = this.context.registry.lookup("Field", name.trim(), entity);
    const declared = this.context.model[entity]?.fields.find(
      (candidate) => candidate.name === entry?.name,
    );
    const label = `${entity}.${entry?.name ?? name.trim()}`;
    entry === undefined && this.context.report(`Unknown Field "${name.trim()}" of ${entity}`);
    const numeric =
      entry !== undefined &&
      entry.kind !== "relation" &&
      (declared?.type === undefined || NUMERIC_TYPES.has(declared.type));
    entry !== undefined &&
      !numeric &&
      this.context.report(`${label} is not a number and cannot be used in a formula`);
    this.failed ||= !numeric;
    return numeric ? entry?.name : undefined;
  }

  private sumTerm(
    targetName: string,
    fieldName: string,
    whereText: string | undefined,
  ): FormulaNode | undefined {
    const target = this.context.registry.lookup("Entity", targetName, "")?.name;
    target === undefined && this.context.report(`Unknown Entity "${targetName}"`);
    const relation =
      target === undefined
        ? undefined
        : this.context.model[this.entity]?.relations.find(
            (candidate) => candidate.kind === "has-many" && candidate.entity === target,
          );
    target === undefined ||
      relation !== undefined ||
      this.context.report(`${this.entity} has no has-many ${target} relation`);
    const field = target === undefined ? undefined : this.numericField(target, fieldName);
    const where: ConditionNode | undefined =
      whereText === undefined || target === undefined
        ? undefined
        : parseCondition(target, whereText, this.context);
    const filtered = whereText === undefined || where !== undefined;
    this.failed ||=
      target === undefined || relation === undefined || field === undefined || !filtered;
    return target !== undefined && relation !== undefined && field !== undefined && filtered
      ? {
          op: "sum",
          relation: relation.name,
          target,
          field,
          ...(where === undefined ? {} : { where }),
        }
      : undefined;
  }
}

function plainShape(
  entity: string,
  field: string,
  expression: FormulaNode,
  site: { file: string; line: number },
): InvariantNode | undefined {
  if (expression.op === "*" && expression.left.op === "field" && expression.right.op === "field") {
    return {
      kind: "product",
      entity,
      field,
      left: expression.left.field,
      right: expression.right.field,
      ...site,
    };
  }
  if (expression.op === "sum" && expression.where === undefined) {
    return {
      kind: "sum",
      entity,
      field,
      relation: expression.relation,
      target: expression.target,
      targetField: expression.field,
      ...site,
    };
  }
  return undefined;
}
