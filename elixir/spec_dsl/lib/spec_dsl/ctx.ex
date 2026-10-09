defmodule SpecDSL.Ctx do
  @moduledoc "Scenario execution state: context instances, actor sessions, refs and per-actor views and paths."

  alias SpecDSL.{AST, Lock, Scenario}

  @type setup_entry :: {:context, atom()} | {:actor, String.t()}
  @type t :: %__MODULE__{
          ast: AST.t(),
          scenario: Scenario.t() | nil,
          handlers: module(),
          lock: Lock.t(),
          contexts: %{atom() => term()},
          actors: %{String.t() => term()},
          refs: %{String.t() => term()},
          views: %{String.t() => term()},
          paths: %{String.t() => String.t()},
          setup_order: [setup_entry()]
        }

  defstruct [
    :ast,
    :scenario,
    :handlers,
    :lock,
    contexts: %{},
    actors: %{},
    refs: %{},
    views: %{},
    paths: %{},
    setup_order: []
  ]

  @doc "Creates an empty execution state for an AST, a handlers module and the scenario about to run."
  @spec new(AST.t(), module(), Scenario.t() | nil) :: t()
  def new(%AST{} = ast, handlers, scenario \\ nil) do
    %__MODULE__{ast: ast, handlers: handlers, lock: handlers.__spec_lock__(), scenario: scenario}
  end

  @doc "Returns the instance of a context that has been set up."
  @spec context(t(), atom()) :: term()
  def context(%__MODULE__{contexts: contexts}, name) do
    case Map.fetch(contexts, name) do
      {:ok, instance} -> instance
      :error -> raise ArgumentError, "context #{inspect(name)} has not been set up"
    end
  end

  @doc "Sets up a context and the contexts it requires, once."
  @spec ensure_context(t(), atom()) :: t()
  def ensure_context(%__MODULE__{contexts: contexts} = ctx, name) when is_map_key(contexts, name),
    do: ctx

  def ensure_context(%__MODULE__{} = ctx, name) do
    definition = fetch_definition!(ctx, name)
    ctx = Enum.reduce(definition.requires, ctx, &ensure_context(&2, &1))
    config = Map.get(ctx.ast.contexts, name, %{})
    instance = ctx.handlers.setup_context(name, config, ctx)

    %{
      ctx
      | contexts: Map.put(ctx.contexts, name, instance),
        setup_order: [{:context, name} | ctx.setup_order]
    }
  end

  @doc "Returns an actor session, setting it up through the handlers on first access."
  @spec actor(t(), String.t()) :: {term(), t()}
  def actor(%__MODULE__{actors: actors} = ctx, actor_name) when is_map_key(actors, actor_name) do
    {Map.fetch!(actors, actor_name), ctx}
  end

  def actor(%__MODULE__{} = ctx, actor_name) do
    definition = fetch_actor_definition!(ctx)
    ctx = Enum.reduce(definition.requires, ctx, &ensure_context(&2, &1))
    declaration = ctx.ast.actors |> Map.get(actor_name, %{}) |> Map.put(:name, actor_name)
    session = ctx.handlers.setup_context(definition.name, declaration, ctx)

    ctx = %{
      ctx
      | actors: Map.put(ctx.actors, actor_name, session),
        setup_order: [{:actor, actor_name} | ctx.setup_order]
    }

    {session, ctx}
  end

  @doc "Stores a value under a ref name."
  @spec put_ref(t(), String.t(), term()) :: t()
  def put_ref(%__MODULE__{} = ctx, name, value), do: %{ctx | refs: Map.put(ctx.refs, name, value)}

  @doc "Returns the value stored under a ref name."
  @spec ref(t(), String.t()) :: term()
  def ref(%__MODULE__{refs: refs}, name) do
    case Map.fetch(refs, name) do
      {:ok, value} -> value
      :error -> raise ArgumentError, "ref #{inspect(name)} has not been declared"
    end
  end

  @doc "Stores the current view of an actor."
  @spec put_view(t(), String.t(), term()) :: t()
  def put_view(%__MODULE__{} = ctx, actor_name, view),
    do: %{ctx | views: Map.put(ctx.views, actor_name, view)}

  @doc "Returns the current view of an actor, or nil before the first navigation."
  @spec view(t(), String.t()) :: term()
  def view(%__MODULE__{views: views}, actor_name), do: Map.get(views, actor_name)

  @doc "Stores the current path of an actor."
  @spec put_path(t(), String.t(), String.t()) :: t()
  def put_path(%__MODULE__{} = ctx, actor_name, path),
    do: %{ctx | paths: Map.put(ctx.paths, actor_name, path)}

  @doc "Returns the current path of an actor, or nil before the first navigation."
  @spec path(t(), String.t()) :: String.t() | nil
  def path(%__MODULE__{paths: paths}, actor_name), do: Map.get(paths, actor_name)

  @doc "Tears down actors and contexts in reverse setup order."
  @spec teardown(t()) :: :ok
  def teardown(%__MODULE__{setup_order: setup_order} = ctx) do
    failures =
      Enum.flat_map(setup_order, fn entry ->
        try do
          teardown_entry(ctx, entry)
          []
        rescue
          exception -> [{exception, __STACKTRACE__}]
        end
      end)

    case failures do
      [] -> :ok
      [{exception, stacktrace} | _] -> reraise exception, stacktrace
    end
  end

  defp teardown_entry(ctx, {:context, name}) do
    ctx.handlers.teardown_context(name, Map.fetch!(ctx.contexts, name), ctx)
  end

  defp teardown_entry(ctx, {:actor, actor_name}) do
    definition = fetch_actor_definition!(ctx)
    ctx.handlers.teardown_context(definition.name, Map.fetch!(ctx.actors, actor_name), ctx)
  end

  defp fetch_definition!(%__MODULE__{lock: lock}, name) do
    case Map.fetch(lock.contexts, name) do
      {:ok, definition} -> definition
      :error -> raise ArgumentError, "context #{inspect(name)} is not declared in the lock"
    end
  end

  defp fetch_actor_definition!(%__MODULE__{lock: lock}) do
    case Lock.contexts_in_scope(lock, :actor) do
      [definition | _] -> definition
      [] -> raise ArgumentError, "the lock declares no actor-scoped context"
    end
  end
end
