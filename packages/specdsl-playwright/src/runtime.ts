import type {
  LockFile,
  NarrationNode,
  Scenario,
  ScenarioNode,
  SpecAst,
  StepMode,
  SurfaceNode,
} from "@special/specdsl-core";

export interface ResolvedControl {
  name: string;
  kind: string;
  locators: Readonly<Record<string, string>>;
}

export interface ResolvedSurface {
  name: string;
  route?: string;
  design?: string;
  shared?: true;
  controls: Readonly<Record<string, ResolvedControl>>;
}

export type EntityPair = readonly [field: string, value: string];

export interface RefEntry {
  entity: string;
  id: string;
}

/** Scenario-scoped symbol table from Ref name to the entity it denotes. */
export class RefTable {
  private readonly entries = new Map<string, RefEntry>();

  declare(name: string, entry: RefEntry): void {
    this.entries.set(name, entry);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  get(name: string): RefEntry {
    const entry = this.entries.get(name);
    if (entry === undefined) throw new Error(`Ref "${name}" has not been declared`);
    return entry;
  }

  substituteIds(pairs: readonly EntityPair[]): EntityPair[] {
    return pairs.map(([field, value]) => [field, this.has(value) ? this.get(value).id : value]);
  }
}

export interface ActorDeclaration {
  name: string;
  role: string;
  extra: Record<string, string>;
}

export interface ContextRequest {
  key?: string;
  config: Record<string, string>;
  actor?: ActorDeclaration;
}

export interface ScenarioEnv<Services, States> {
  services: Services;
  spec: SpecAst;
  refs: RefTable;
  context<Name extends keyof States>(name: Name, key?: string): States[Name];
}

export interface ContextHandler<Services, States, State> {
  setup(env: ScenarioEnv<Services, States>, request: ContextRequest): Promise<State>;
  teardown?(state: State, env: ScenarioEnv<Services, States>): Promise<void>;
}

export type ContextHandlers<Services, States> = {
  [Name in keyof States]: ContextHandler<Services, States, States[Name]>;
};

export type StepHandlers<Args, Services, States> = {
  [Id in keyof Args]: (args: Args[Id], env: ScenarioEnv<Services, States>) => Promise<void> | void;
};

export interface RuntimeHandlers<Args, Services, States> {
  contexts: ContextHandlers<Services, States>;
  steps: StepHandlers<Args, Services, States>;
}

export interface StepInvocation {
  id: string;
  line: number;
  args: Record<string, unknown>;
}

export interface StepHooks<Services, States> {
  aroundStep?(
    invocation: StepInvocation,
    perform: () => Promise<void>,
    env: ScenarioEnv<Services, States>,
  ): Promise<void>;
  onNarration?(node: NarrationNode, env: ScenarioEnv<Services, States>): Promise<void>;
}

export interface RunOptions<Services, States> {
  modes: readonly StepMode[];
  hooks?: StepHooks<Services, States>;
}

export interface Runtime<Services, States> {
  runScenario(
    spec: SpecAst,
    scenario: Scenario,
    services: Services,
    options: RunOptions<Services, States>,
  ): Promise<void>;
  dispose(): Promise<void>;
}

type AnyHandler<Services, States> = (
  args: unknown,
  env: ScenarioEnv<Services, States>,
) => Promise<void> | void;

/** Binds context and step handlers to a lock file and executes AST scenarios through them. */
export function runtime<Args, Services, States>(
  lock: LockFile,
  handlers: RuntimeHandlers<Args, Services, States>,
): Runtime<Services, States> {
  assertCoverage(lock, handlers);
  const suiteSession = new Session<Services, States>(lock, handlers.contexts);
  return {
    async runScenario(spec, scenario, services, options) {
      const session = new Session<Services, States>(lock, handlers.contexts, suiteSession);
      const env = session.environment(spec, services);
      try {
        await session.setUpDeclaredContexts(env);
        await executeSteps(lock, handlers.steps, session, env, scenario, options);
      } finally {
        await session.tearDown();
      }
    },
    async dispose() {
      await suiteSession.tearDown();
    },
  };
}

function assertCoverage(lock: LockFile, handlers: { contexts: object; steps: object }): void {
  const missingSteps = lock.steps.map((step) => step.id).filter((id) => !(id in handlers.steps));
  const missingContexts = Object.keys(lock.contexts).filter((name) => !(name in handlers.contexts));
  if (missingSteps.length > 0 || missingContexts.length > 0) {
    throw new Error(
      `handlers for ${lock.dialect.name} lack steps [${missingSteps.join(", ")}] and contexts [${missingContexts.join(", ")}]`,
    );
  }
}

interface ContextInstance {
  state: unknown;
  teardown: () => Promise<void>;
}

class Session<Services, States> {
  private readonly instances = new Map<string, ContextInstance>();
  private readonly surfaceByActor = new Map<string, string>();
  readonly refs = new RefTable();

  constructor(
    private readonly lock: LockFile,
    private readonly contextHandlers: ContextHandlers<Services, States>,
    private readonly suite?: Session<Services, States>,
  ) {}

  environment(spec: SpecAst, services: Services): ScenarioEnv<Services, States> {
    return {
      services,
      spec,
      refs: this.refs,
      context: (name, key) => this.stateOf(String(name), key) as States[typeof name],
    };
  }

  rememberSurface(actorName: string, surfaceName: string): void {
    this.surfaceByActor.set(actorName, surfaceName);
  }

  surfaceOf(actorName: string | undefined): string | undefined {
    return actorName === undefined ? undefined : this.surfaceByActor.get(actorName);
  }

  async setUpDeclaredContexts(env: ScenarioEnv<Services, States>): Promise<void> {
    for (const [name, definition] of Object.entries(this.lock.contexts)) {
      if (name in env.spec.contexts && definition.scope !== "actor") {
        await this.ensure(name, undefined, env);
      }
    }
  }

  async ensure(
    name: string,
    key: string | undefined,
    env: ScenarioEnv<Services, States>,
  ): Promise<void> {
    const definition = this.lock.contexts[name];
    if (definition === undefined) throw new Error(`unknown context "${name}"`);
    const owner = this.ownerOf(name);
    if (owner !== this) return owner.ensure(name, key, env);
    if (this.instances.has(slotKey(name, key))) return;
    for (const required of definition.requires) await this.ensure(required, undefined, env);
    const handler = this.contextHandlers[name as keyof States];
    const state = await handler.setup(env, {
      key,
      config: env.spec.contexts[name] ?? {},
      actor: key === undefined ? undefined : actorDeclaration(env.spec, key),
    });
    this.instances.set(slotKey(name, key), {
      state,
      teardown: async () => handler.teardown?.(state as never, env),
    });
  }

  async tearDown(): Promise<void> {
    const failures: unknown[] = [];
    for (const instance of [...this.instances.values()].reverse()) {
      try {
        await instance.teardown();
      } catch (failure) {
        failures.push(failure);
      }
    }
    this.instances.clear();
    if (failures.length > 0) throw failures[0];
  }

  private ownerOf(name: string): Session<Services, States> {
    const scope = this.lock.contexts[name]?.scope;
    return scope === "suite" && this.suite !== undefined ? this.suite : this;
  }

  private stateOf(name: string, key: string | undefined): unknown {
    const instance = this.ownerOf(name).instances.get(slotKey(name, key));
    if (instance === undefined) throw new Error(`context "${slotKey(name, key)}" is not set up`);
    return instance.state;
  }
}

function slotKey(name: string, key: string | undefined): string {
  return key === undefined ? name : `${name}:${key}`;
}

function actorDeclaration(spec: SpecAst, name: string): ActorDeclaration | undefined {
  const declaration = spec.actors[name];
  if (declaration === undefined) return undefined;
  const { Role, extra } = declaration;
  return {
    name,
    role: typeof Role === "string" ? Role : "",
    extra: typeof extra === "object" ? extra : {},
  };
}

async function executeSteps<Args, Services, States>(
  lock: LockFile,
  stepHandlers: StepHandlers<Args, Services, States>,
  session: Session<Services, States>,
  env: ScenarioEnv<Services, States>,
  scenario: Scenario,
  options: RunOptions<Services, States>,
): Promise<void> {
  for (const node of scenario.steps) {
    if (!runsIn(node, options.modes)) continue;
    if (isNarration(node)) {
      await options.hooks?.onNarration?.(node, env);
      continue;
    }
    const step = lock.steps.find((candidate) => candidate.id === node.id);
    if (step === undefined) throw new Error(`line ${node.line}: unknown step "${node.id}"`);
    for (const used of step.uses) {
      const keyedBy = lock.contexts[used]?.keyedBy;
      await session.ensure(
        used,
        keyedBy === undefined ? undefined : textOf(node.args[keyedBy]),
        env,
      );
    }
    const handler = stepHandlers[node.id as keyof Args] as unknown as AnyHandler<Services, States>;
    const args = resolveArguments(env.spec, session, node.args);
    const perform = async () => handler(args, env);
    try {
      const around = options.hooks?.aroundStep;
      if (around === undefined) await perform();
      else await around.call(options.hooks, { id: node.id, line: node.line, args }, perform, env);
    } catch (failure) {
      throw annotate(failure, scenario, node.line);
    }
    rememberSurfaceUse(session, node.args, env.spec);
  }
}

function isNarration(node: ScenarioNode): node is NarrationNode {
  return "text" in node;
}

function runsIn(node: ScenarioNode, modes: readonly StepMode[]): boolean {
  const nodeModes = "modes" in node ? node.modes : undefined;
  return nodeModes === undefined || modes.some((mode) => nodeModes.includes(mode));
}

function rememberSurfaceUse<Services, States>(
  session: Session<Services, States>,
  args: Record<string, unknown>,
  spec: SpecAst,
): void {
  const actorName = textOf(args["Actor"]);
  const surfaceName = textOf(args["Surface"]);
  const isShared = surfaceName !== undefined && spec.surfaces[surfaceName]?.shared === true;
  if (actorName !== undefined && surfaceName !== undefined && !isShared) {
    session.rememberSurface(actorName, surfaceName);
  }
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function annotate(failure: unknown, scenario: Scenario, line: number): Error {
  const message = failure instanceof Error ? failure.message : String(failure);
  const annotated = new Error(`${scenario.source.file}:${line}: ${message}`);
  if (failure instanceof Error) annotated.stack = `${annotated.message}\n${failure.stack ?? ""}`;
  return annotated;
}

function resolveArguments<Services, States>(
  spec: SpecAst,
  session: Session<Services, States>,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...args };
  const surfaceName = textOf(args["Surface"]);
  if (surfaceName !== undefined) resolved["Surface"] = resolveSurface(spec, surfaceName);
  const controlName = textOf(args["Control"]);
  if (controlName !== undefined) {
    const owningSurface = surfaceName ?? session.surfaceOf(textOf(args["Actor"]));
    resolved["Control"] = resolveControl(spec, controlName, owningSurface);
  }
  return resolved;
}

function resolveSurface(spec: SpecAst, surfaceName: string): ResolvedSurface {
  const node = spec.surfaces[surfaceName];
  if (node === undefined) throw new Error(`surface "${surfaceName}" is not in the AST`);
  return surfaceFrom(surfaceName, node);
}

function surfaceFrom(name: string, node: SurfaceNode): ResolvedSurface {
  const controls = Object.fromEntries(
    Object.entries(node.controls).map(([controlName, control]) => [
      controlName,
      { name: controlName, kind: control.kind, locators: control.locators },
    ]),
  );
  return { name, route: node.route, design: node.design, shared: node.shared, controls };
}

function resolveControl(
  spec: SpecAst,
  controlName: string,
  surfaceName: string | undefined,
): ResolvedControl {
  const candidates = surfaceName === undefined ? Object.keys(spec.surfaces) : [surfaceName];
  for (const candidate of candidates) {
    const control = spec.surfaces[candidate]?.controls[controlName];
    if (control !== undefined) {
      return { name: controlName, kind: control.kind, locators: control.locators };
    }
  }
  throw new Error(`control "${controlName}" is not on ${surfaceName ?? "any surface"}`);
}
