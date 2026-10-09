defmodule SpecDSL.Control do
  @moduledoc "A named UI control with a kind and a map of locators."

  @type kind :: :field | :button | :region | :table | :link
  @type locator_key :: :css | :lv | :testid | :role | :form
  @type t :: %__MODULE__{name: String.t(), kind: kind(), locators: %{locator_key() => String.t()}}

  defstruct [:name, :kind, locators: %{}]
end

defmodule SpecDSL.Surface do
  @moduledoc "A routable screen holding named controls."

  @type t :: %__MODULE__{
          name: String.t(),
          route: String.t() | nil,
          controls: %{String.t() => SpecDSL.Control.t()}
        }

  defstruct [:name, :route, controls: %{}]
end

defmodule SpecDSL.Step do
  @moduledoc "One bound step of a scenario."

  @type mode :: :test | :demo | :domain
  @type t :: %__MODULE__{
          id: String.t(),
          line: non_neg_integer(),
          args: %{atom() => term()},
          narrate: String.t() | nil,
          modes: [mode()] | nil,
          text: String.t() | nil
        }

  defstruct [:id, :line, :narrate, :modes, :text, args: %{}]
end

defmodule SpecDSL.Scenario do
  @moduledoc "A named list of steps with its Markdown source position."

  @type t :: %__MODULE__{
          name: String.t(),
          source: %{file: String.t(), line: non_neg_integer()},
          steps: [SpecDSL.Step.t()]
        }

  defstruct [:name, :source, steps: []]
end

defmodule SpecDSL.Entity do
  @moduledoc "A domain entity declared in the spec's Model section."

  @type relation :: %{kind: :belongs_to | :has_many, entity: String.t()}
  @type machine :: %{states: [String.t()], transitions: [%{from: String.t(), to: String.t()}]}
  @type t :: %__MODULE__{
          fields: [String.t()],
          relations: [relation()],
          machines: %{String.t() => machine()}
        }

  defstruct fields: [], relations: [], machines: %{}
end

defmodule SpecDSL.AST do
  @moduledoc "Loads the AST JSON emitted by the spec compiler into structs."

  alias SpecDSL.{Control, Entity, Scenario, Step, Surface}

  @type t :: %__MODULE__{
          dialect: %{name: String.t(), version: String.t(), step_ids: [String.t()]},
          contexts: %{atom() => %{atom() => term()}},
          actors: %{String.t() => %{atom() => term()}},
          surfaces: %{String.t() => Surface.t()},
          model: %{String.t() => Entity.t()},
          policies: %{String.t() => %{String.t() => [String.t()]}},
          scenarios: [Scenario.t()]
        }

  defstruct [
    :dialect,
    contexts: %{},
    actors: %{},
    surfaces: %{},
    model: %{},
    policies: %{},
    scenarios: []
  ]

  @control_kinds %{
    "field" => :field,
    "button" => :button,
    "region" => :region,
    "table" => :table,
    "link" => :link
  }
  @locator_keys %{
    "css" => :css,
    "lv" => :lv,
    "testid" => :testid,
    "role" => :role,
    "form" => :form
  }
  @relation_kinds %{"belongs-to" => :belongs_to, "has-many" => :has_many}
  @step_modes %{"test" => :test, "demo" => :demo, "domain" => :domain}

  @doc "Reads and decodes an AST JSON file."
  @spec load!(Path.t()) :: t()
  def load!(path) do
    path |> File.read!() |> Jason.decode!() |> from_map()
  end

  @doc "Builds an AST from a decoded JSON map."
  @spec from_map(map()) :: t()
  def from_map(raw) do
    surfaces = raw |> Map.get("surfaces", %{}) |> Map.new(&build_surface/1)

    %__MODULE__{
      dialect: build_dialect(Map.get(raw, "dialect", %{})),
      contexts:
        raw
        |> Map.get("contexts", %{})
        |> Map.new(fn {name, config} -> {snake_atom(name), atomize_keys(config)} end),
      actors:
        raw
        |> Map.get("actors", %{})
        |> Map.new(fn {name, config} -> {name, atomize_keys(config)} end),
      surfaces: surfaces,
      model: raw |> Map.get("model", %{}) |> Map.new(&build_entity/1),
      policies: Map.get(raw, "policies", %{}),
      scenarios: raw |> Map.get("scenarios", []) |> Enum.map(&build_scenario(&1, surfaces))
    }
  end

  @doc "Converts a JSON key such as `Actor` or `Unit price` to a snake_case atom."
  @spec snake_atom(String.t()) :: atom()
  def snake_atom(key) do
    key
    |> Macro.underscore()
    |> String.replace(~r/[^a-z0-9_]+/, "_")
    |> String.to_atom()
  end

  defp build_dialect(raw) do
    %{
      name: Map.get(raw, "name"),
      version: Map.get(raw, "version"),
      step_ids: Map.get(raw, "stepIds", [])
    }
  end

  defp build_entity({name, raw}) do
    {name,
     %Entity{
       fields: Map.get(raw, "fields", []),
       relations: raw |> Map.get("relations", []) |> Enum.map(&build_relation/1),
       machines: raw |> Map.get("machines", %{}) |> Map.new(&build_machine/1)
     }}
  end

  defp build_relation(raw) do
    %{
      kind: fetch_known!(@relation_kinds, Map.fetch!(raw, "kind"), "relation kind"),
      entity: Map.fetch!(raw, "entity")
    }
  end

  defp build_machine({field, raw}) do
    {field,
     %{
       states: Map.get(raw, "states", []),
       transitions:
         raw
         |> Map.get("transitions", [])
         |> Enum.map(fn transition -> %{from: transition["from"], to: transition["to"]} end)
     }}
  end

  defp build_surface({name, raw}) do
    controls =
      raw
      |> Map.get("controls", %{})
      |> Map.new(fn {control_name, control_raw} ->
        {control_name, build_control(control_name, control_raw)}
      end)

    {name, %Surface{name: name, route: Map.get(raw, "route"), controls: controls}}
  end

  defp build_control(name, raw) do
    %Control{
      name: name,
      kind: fetch_known!(@control_kinds, Map.fetch!(raw, "kind"), "control kind"),
      locators:
        raw
        |> Map.get("locators", %{})
        |> Map.new(fn {key, value} -> {fetch_known!(@locator_keys, key, "locator"), value} end)
    }
  end

  defp build_scenario(raw, surfaces) do
    %Scenario{
      name: Map.fetch!(raw, "name"),
      source: %{file: get_in(raw, ["source", "file"]), line: get_in(raw, ["source", "line"])},
      steps: raw |> Map.get("steps", []) |> Enum.map(&build_step(&1, surfaces))
    }
  end

  defp build_step(raw, surfaces) do
    %Step{
      id: Map.fetch!(raw, "id"),
      line: Map.get(raw, "line"),
      args: raw |> Map.get("args", %{}) |> resolve_args(surfaces),
      narrate: Map.get(raw, "narrate"),
      modes: build_modes(Map.get(raw, "modes")),
      text: Map.get(raw, "text")
    }
  end

  defp build_modes(nil), do: nil
  defp build_modes(modes), do: Enum.map(modes, &fetch_known!(@step_modes, &1, "step mode"))

  defp resolve_args(raw_args, surfaces) do
    args = Map.new(raw_args, fn {key, value} -> {snake_atom(key), value} end)

    args
    |> resolve_surface(surfaces)
    |> resolve_control(surfaces)
  end

  defp resolve_surface(%{surface: surface_name} = args, surfaces) when is_binary(surface_name) do
    %{args | surface: fetch_surface!(surfaces, surface_name)}
  end

  defp resolve_surface(args, _surfaces), do: args

  defp resolve_control(%{control: control_name} = args, surfaces) when is_binary(control_name) do
    %{args | control: find_control!(args, surfaces, control_name)}
  end

  defp resolve_control(args, _surfaces), do: args

  defp find_control!(%{surface: %Surface{controls: controls}}, _surfaces, control_name) do
    fetch_control!(controls, control_name)
  end

  defp find_control!(_args, surfaces, control_name) do
    surfaces
    |> Map.values()
    |> Enum.find_value(fn surface -> Map.get(surface.controls, control_name) end)
    |> case do
      nil -> raise ArgumentError, "unknown control #{inspect(control_name)}"
      control -> control
    end
  end

  defp fetch_surface!(surfaces, name) do
    case Map.fetch(surfaces, name) do
      {:ok, surface} -> surface
      :error -> raise ArgumentError, "unknown surface #{inspect(name)}"
    end
  end

  defp fetch_control!(controls, name) do
    case Map.fetch(controls, name) do
      {:ok, control} -> control
      :error -> raise ArgumentError, "unknown control #{inspect(name)}"
    end
  end

  defp fetch_known!(known, key, label) do
    case Map.fetch(known, key) do
      {:ok, value} -> value
      :error -> raise ArgumentError, "unknown #{label} #{inspect(key)}"
    end
  end

  defp atomize_keys(map) when is_map(map),
    do: Map.new(map, fn {key, value} -> {snake_atom(key), value} end)

  defp atomize_keys(other), do: other
end
