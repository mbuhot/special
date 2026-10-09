defmodule SpecDSL.Lock.Context do
  @moduledoc "A context declared by a dialect lock file."

  @type scope :: :suite | :scenario | :actor
  @type t :: %__MODULE__{
          name: atom(),
          scope: scope(),
          keyed_by: String.t() | nil,
          requires: [atom()],
          config_keys: [String.t()]
        }

  defstruct [:name, :scope, :keyed_by, requires: [], config_keys: []]
end

defmodule SpecDSL.Lock do
  @moduledoc "Loads the dialect lock JSON listing step ids, slots, contexts and config keys."

  alias SpecDSL.Lock.Context

  @type slot :: %{name: String.t(), type: String.t()}
  @type t :: %__MODULE__{
          dialect: %{name: String.t() | nil, version: String.t() | nil},
          steps: %{String.t() => [slot()]},
          contexts: %{atom() => Context.t()}
        }

  defstruct [:dialect, steps: %{}, contexts: %{}]

  @scopes %{"suite" => :suite, "scenario" => :scenario, "actor" => :actor}

  @doc "Reads and decodes a lock JSON file."
  @spec load!(Path.t()) :: t()
  def load!(path) do
    path |> File.read!() |> Jason.decode!() |> from_map()
  end

  @doc "Builds a lock from a decoded JSON map."
  @spec from_map(map()) :: t()
  def from_map(raw) do
    %__MODULE__{
      dialect: %{
        name: get_in(raw, ["dialect", "name"]),
        version: get_in(raw, ["dialect", "version"])
      },
      steps: raw |> Map.get("steps", []) |> build_steps(),
      contexts: raw |> Map.get("contexts", %{}) |> Map.new(&build_context/1)
    }
  end

  @doc "Lists the step ids in lock order."
  @spec step_ids(t()) :: [String.t()]
  def step_ids(%__MODULE__{steps: steps}), do: steps |> Map.keys() |> Enum.sort()

  @doc "Lists the context names in lock order."
  @spec context_names(t()) :: [atom()]
  def context_names(%__MODULE__{contexts: contexts}), do: contexts |> Map.keys() |> Enum.sort()

  @doc "Lists the contexts of one scope, sorted by name."
  @spec contexts_in_scope(t(), Context.scope()) :: [Context.t()]
  def contexts_in_scope(%__MODULE__{contexts: contexts}, scope) do
    contexts |> Map.values() |> Enum.filter(&(&1.scope == scope)) |> Enum.sort_by(& &1.name)
  end

  defp build_steps(steps) when is_map(steps) do
    Map.new(steps, fn {id, slots} -> {id, build_slots(slots)} end)
  end

  defp build_steps(steps) when is_list(steps) do
    Map.new(steps, fn
      id when is_binary(id) -> {id, []}
      %{"id" => id} = step -> {id, step |> Map.get("slots", []) |> build_slots()}
    end)
  end

  defp build_slots(slots) when is_map(slots) do
    Enum.map(slots, fn {name, type} -> %{name: name, type: type} end)
  end

  defp build_slots(slots) when is_list(slots) do
    Enum.map(slots, fn %{"name" => name} = slot ->
      %{name: name, type: slot_type(slot)}
    end)
  end

  defp slot_type(%{"type" => type}), do: type
  defp slot_type(%{"namespace" => namespace}), do: namespace

  defp build_context({name, raw}) do
    context_name = String.to_atom(name)

    {context_name,
     %Context{
       name: context_name,
       scope: fetch_scope!(Map.fetch!(raw, "scope")),
       keyed_by: Map.get(raw, "keyedBy"),
       requires: raw |> Map.get("requires", []) |> Enum.map(&String.to_atom/1),
       config_keys: raw |> Map.get("config", []) |> config_keys()
     }}
  end

  defp config_keys(keys) when is_map(keys), do: Map.keys(keys)
  defp config_keys(keys) when is_list(keys), do: keys

  defp fetch_scope!(scope) do
    case Map.fetch(@scopes, scope) do
      {:ok, atom} -> atom
      :error -> raise ArgumentError, "unknown context scope #{inspect(scope)}"
    end
  end
end
