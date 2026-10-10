import type { InvariantKind, InvariantNode, SpecAst } from "./ast.js";
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
      case "product":
        return this.product();
      case "sum":
        return this.sum();
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

  private product(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const names = [this.slot("Field"), this.slot("Left"), this.slot("Right")];
    const [field, left, right] =
      entity === undefined ? [] : names.map((name) => this.field(entity, name));
    return entity === undefined || field === undefined || left === undefined || right === undefined
      ? undefined
      : { kind: "product", entity, field, left, right, ...this.site };
  }

  private sum(): InvariantNode | undefined {
    const entity = this.entity(this.slot("Entity"));
    const target = this.entity(this.slot("Target"));
    if (entity === undefined || target === undefined) {
      return undefined;
    }
    const field = this.field(entity, this.slot("Field"));
    const targetField = this.field(target, this.slot("TargetField"));
    const relation = this.context.model[entity]?.relations.find(
      (candidate) => candidate.kind === "has-many" && candidate.entity === target,
    );
    relation === undefined && this.context.report(`${entity} has no has-many ${target} relation`);
    return field === undefined || targetField === undefined || relation === undefined
      ? undefined
      : {
          kind: "sum",
          entity,
          field,
          relation: relation.name,
          target,
          targetField,
          ...this.site,
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
