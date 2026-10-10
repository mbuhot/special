import type { EffectNode, EntityNode, RelationNode, SpecAst } from "./ast.js";
import type { Match } from "./pattern.js";
import type { Registry } from "./registry.js";

export interface EffectSource {
  match: Match;
  file: string;
  line: number;
}

export interface EffectContext {
  registry: Registry;
  model: SpecAst["model"];
  report: (message: string) => void;
}

const PLACEHOLDER = /\{([^{}]+)\}/g;

/** Resolves an effect line against the declared model: the action's state, the owner reached through the relation, and every field and placeholder. Reports and returns undefined on unknown names or shapes the model cannot satisfy. */
export function resolveEffect(
  source: EffectSource,
  context: EffectContext,
): EffectNode | undefined {
  return new EffectResolver(source, context).resolve();
}

class EffectResolver {
  constructor(
    private readonly source: EffectSource,
    private readonly context: EffectContext,
  ) {}

  resolve(): EffectNode | undefined {
    const entity = this.entity("Entity");
    const target = this.entity("Target");
    const owner = this.entity("Owner");
    if (entity === undefined || target === undefined || owner === undefined) return undefined;
    const action = this.action(entity);
    const transition = action === undefined ? undefined : this.transition(entity, action);
    const relation = this.belongsTo(entity, this.slot("Relation"));
    const ownerRelation =
      relation === undefined ? undefined : this.relationTo(owner, relation.entity);
    const targetRelation = this.relationTo(target, owner);
    const values = this.values(entity, target);
    return action === undefined ||
      transition === undefined ||
      relation === undefined ||
      ownerRelation === undefined ||
      targetRelation === undefined ||
      values === undefined
      ? undefined
      : {
          entity,
          action,
          field: transition.field,
          state: transition.state,
          target,
          owner,
          relation: relation.name,
          ownerRelation: ownerRelation.name,
          targetRelation: targetRelation.name,
          values,
          file: this.source.file,
          line: this.source.line,
        };
  }

  private slot(name: string): string {
    return this.source.match.slots[name] ?? "";
  }

  private entity(slot: string): string | undefined {
    const found = this.context.registry.lookup("Entity", this.slot(slot), "")?.name;
    found === undefined && this.context.report(`Unknown Entity "${this.slot(slot)}"`);
    return found;
  }

  private action(entity: string): string | undefined {
    const found = this.context.registry.lookup("Action", this.slot("Action"), entity)?.name;
    found === undefined &&
      this.context.report(
        `Unknown Action "${this.slot("Action")}" of ${entity}; declare it in Policies`,
      );
    return found;
  }

  private transition(entity: string, action: string): { field: string; state: string } | undefined {
    const words = action.toLowerCase().split(/\s+/);
    const reached = Object.entries(this.context.model[entity]?.machines ?? {}).flatMap(
      ([field, machine]) =>
        machine.states
          .filter((state) => words[words.length - 1] === state.toLowerCase())
          .map((state) => ({ field, state })),
    );
    reached.length === 1 ||
      this.context.report(
        `Action "${action}" of ${entity} must end with the state it moves to; ${reached.length} states match`,
      );
    return reached.length === 1 ? reached[0] : undefined;
  }

  private belongsTo(entity: string, name: string): RelationNode | undefined {
    const found = this.context.model[entity]?.relations.find(
      (relation) => relation.kind === "belongs-to" && sameName(relation.name, name),
    );
    found === undefined && this.context.report(`${entity} has no belongs-to relation "${name}"`);
    return found;
  }

  private relationTo(entity: string, parent: string): RelationNode | undefined {
    const found = this.context.model[entity]?.relations.find(
      (relation) => relation.kind === "belongs-to" && relation.entity === parent,
    );
    found === undefined && this.context.report(`${entity} does not belong to ${parent}`);
    return found;
  }

  private values(entity: string, target: string): { field: string; value: string }[] | undefined {
    const names = (this.source.match.lists["Field"] ?? []).map((name) => String(name));
    const texts = (this.source.match.lists["Text"] ?? []).map((text) => String(text));
    const fields = names.map((name) => this.field(target, name));
    const placeholdersKnown = texts.every((text) => this.placeholdersOf(entity, text));
    return fields.some((field) => field === undefined) || !placeholdersKnown
      ? undefined
      : fields.map((field, index) => ({ field: field as string, value: texts[index] as string }));
  }

  private field(entity: string, name: string): string | undefined {
    const found = fieldsOf(this.context.model[entity]).find((field) => sameName(field, name));
    found === undefined && this.context.report(`Unknown Field "${name}" of ${entity}`);
    return found;
  }

  private placeholdersOf(entity: string, text: string): boolean {
    const names = [...text.matchAll(PLACEHOLDER)].map((found) => found[1] as string);
    return names.map((name) => this.field(entity, name)).every((field) => field !== undefined);
  }
}

function fieldsOf(model: EntityNode | undefined): string[] {
  return (model?.fields ?? []).map((field) => field.name);
}

function sameName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
