defmodule SpecDSL.Control do
  @moduledoc "A named UI control with a kind and a map of locators."

  @type kind :: :field | :button | :region | :table | :link
  @type locator_key :: :css | :lv | :testid | :role | :form
  @type t :: %__MODULE__{name: String.t(), kind: kind(), locators: %{locator_key() => String.t()}}

  defstruct [:name, :kind, locators: %{}]
end

defmodule SpecDSL.Surface do
  @moduledoc "A routable screen holding named controls; a shared surface is present on every page."

  @type t :: %__MODULE__{
          name: String.t(),
          route: String.t() | nil,
          shared: boolean(),
          controls: %{String.t() => SpecDSL.Control.t()}
        }

  defstruct [:name, :route, shared: false, controls: %{}]
end

defmodule SpecDSL.Step do
  @moduledoc "One bound step of a scenario."

  @type mode :: :test | :demo | :domain
  @type t :: %__MODULE__{
          id: String.t(),
          line: non_neg_integer(),
          args: %{atom() => term()},
          modes: [mode()] | nil,
          text: String.t() | nil
        }

  defstruct [:id, :line, :modes, :text, args: %{}]
end

defmodule SpecDSL.Scenario do
  @moduledoc "A named list of steps with its user story and Markdown source position."

  @type t :: %__MODULE__{
          name: String.t(),
          source: %{file: String.t(), line: non_neg_integer()},
          story: String.t() | nil,
          steps: [SpecDSL.Step.t()]
        }

  defstruct [:name, :source, :story, steps: []]

  @doc "Returns the names of the actors the steps mention, in order of first appearance."
  @spec actors(t()) :: [String.t()]
  def actors(%__MODULE__{steps: steps}) do
    steps
    |> Enum.flat_map(fn
      %SpecDSL.Step{args: %{actor: actor_name}} when is_binary(actor_name) -> [actor_name]
      _step -> []
    end)
    |> Enum.uniq()
  end
end

defmodule SpecDSL.Field do
  @moduledoc "A field of a model entity: its spelling, optional type, requiredness and enum values."

  @type type ::
          :text
          | :email
          | :phone
          | :url
          | :money
          | :integer
          | :decimal
          | :date
          | :datetime
          | :boolean
          | :enum
  @type t :: %__MODULE__{
          name: String.t(),
          type: type() | nil,
          required: boolean(),
          values: [String.t()] | nil
        }

  defstruct [:name, :type, :values, required: false]
end

defmodule SpecDSL.Entity do
  @moduledoc "A domain entity declared in the spec's Model section."

  @type relation :: %{
          kind: :belongs_to | :has_many,
          entity: String.t(),
          name: String.t() | nil
        }
  @type machine :: %{states: [String.t()], transitions: [%{from: String.t(), to: String.t()}]}
  @type t :: %__MODULE__{
          fields: [SpecDSL.Field.t()],
          relations: [relation()],
          machines: %{String.t() => machine()},
          order: %{field: String.t(), direction: String.t()} | nil
        }

  defstruct fields: [], relations: [], machines: %{}, order: nil

  @doc "The spelling of each field, in declaration order."
  @spec field_names(t()) :: [String.t()]
  def field_names(%__MODULE__{fields: fields}), do: Enum.map(fields, & &1.name)
end

defmodule SpecDSL.Invariant do
  @moduledoc "A declarative rule from the Invariants section; entities keep their spec spelling, fields, relations and actions are snake_case atoms."

  @type kind :: :product | :sum | :unique | :frozen_except | :same_parent | :sequence
  @type t :: %__MODULE__{
          kind: kind(),
          entity: String.t(),
          field: atom() | nil,
          left: atom() | nil,
          right: atom() | nil,
          relation: atom() | nil,
          target: String.t() | nil,
          target_field: atom() | nil,
          actions: [atom()],
          prefix: String.t() | nil,
          width: pos_integer() | nil,
          parent: atom() | nil,
          relation_entity: String.t() | nil,
          relation_parent: atom() | nil,
          file: String.t() | nil,
          line: non_neg_integer() | nil
        }

  defstruct [
    :kind,
    :entity,
    :field,
    :left,
    :right,
    :relation,
    :target,
    :target_field,
    :prefix,
    :width,
    :parent,
    :relation_entity,
    :relation_parent,
    :file,
    :line,
    actions: []
  ]
end

defmodule SpecDSL.Effect do
  @moduledoc "A cross-entity consequence of an action: creates a target record under the first owner reached through the triggering record's relation; entities keep their spec spelling, fields and relations are snake_case atoms, value templates keep `{field}` placeholders."

  @type t :: %__MODULE__{
          entity: String.t(),
          action: atom(),
          field: atom(),
          state: String.t(),
          target: String.t(),
          owner: String.t(),
          relation: atom(),
          owner_relation: atom(),
          target_relation: atom(),
          values: [{atom(), String.t()}],
          file: String.t() | nil,
          line: non_neg_integer() | nil
        }

  defstruct [
    :entity,
    :action,
    :field,
    :state,
    :target,
    :owner,
    :relation,
    :owner_relation,
    :target_relation,
    :file,
    :line,
    values: []
  ]
end

defmodule SpecDSL.Predicate do
  @moduledoc "A named condition over one entity; the condition is a tree of and/or nodes over field comparisons whose fields are snake_case atoms."

  @type condition ::
          %{op: :and | :or, left: condition(), right: condition()}
          | %{op: :is | :is_not | :before | :after, field: atom(), value: String.t()}
  @type t :: %__MODULE__{
          entity: String.t(),
          name: String.t(),
          condition: condition(),
          file: String.t() | nil,
          line: non_neg_integer() | nil
        }

  defstruct [:entity, :name, :condition, :file, :line]
end

defmodule SpecDSL.Count do
  @moduledoc "A named count of the records of an entity for which a predicate holds."

  @type t :: %__MODULE__{
          name: String.t(),
          entity: String.t(),
          predicate: String.t(),
          file: String.t() | nil,
          line: non_neg_integer() | nil
        }

  defstruct [:name, :entity, :predicate, :file, :line]
end

defmodule SpecDSL.Derived do
  @moduledoc "Declared predicates and counts, with a pure evaluator over plain field maps."

  alias SpecDSL.Predicate

  @type t :: %__MODULE__{predicates: [Predicate.t()], counts: [SpecDSL.Count.t()]}

  defstruct predicates: [], counts: []

  @doc "Whether the record map, keyed by field atoms, satisfies the predicate on the given date."
  @spec holds?(Predicate.t() | Predicate.condition(), map(), Date.t()) :: boolean()
  def holds?(%Predicate{condition: condition}, record, today),
    do: holds?(condition, record, today)

  def holds?(%{op: :and, left: left, right: right}, record, today),
    do: holds?(left, record, today) and holds?(right, record, today)

  def holds?(%{op: :or, left: left, right: right}, record, today),
    do: holds?(left, record, today) or holds?(right, record, today)

  def holds?(%{op: :is, field: field, value: value}, record, today),
    do: equal?(Map.get(record, field), value, today)

  def holds?(%{op: :is_not, field: field, value: value}, record, today),
    do: not equal?(Map.get(record, field), value, today)

  def holds?(%{op: :before, field: field, value: value}, record, today),
    do: compare_dates(Map.get(record, field), value, today) == :lt

  def holds?(%{op: :after, field: field, value: value}, record, today),
    do: compare_dates(Map.get(record, field), value, today) == :gt

  @doc "The field atoms a predicate or condition reads, without repeats."
  @spec fields(Predicate.t() | Predicate.condition()) :: [atom()]
  def fields(%Predicate{condition: condition}), do: fields(condition)
  def fields(%{left: left, right: right}), do: Enum.uniq(fields(left) ++ fields(right))
  def fields(%{field: field}), do: [field]

  defp equal?(%Date{} = actual, value, today),
    do: Date.compare(actual, date_value(value, today)) == :eq

  defp equal?(%DateTime{} = actual, value, today),
    do: equal?(DateTime.to_date(actual), value, today)

  defp equal?(actual, value, _today), do: normalise(actual) == normalise(value)

  defp compare_dates(nil, _value, _today), do: nil

  defp compare_dates(%DateTime{} = actual, value, today),
    do: compare_dates(DateTime.to_date(actual), value, today)

  defp compare_dates(%Date{} = actual, value, today),
    do: Date.compare(actual, date_value(value, today))

  defp date_value("today", today), do: today
  defp date_value(value, _today), do: Date.from_iso8601!(value)

  defp normalise(nil), do: nil
  defp normalise(value), do: value |> to_string() |> String.downcase() |> String.replace(" ", "_")
end

defmodule SpecDSL.AST do
  @moduledoc "Loads the AST JSON emitted by the spec compiler into structs."

  alias SpecDSL.{Control, Entity, Field, Invariant, Scenario, Step, Surface}

  @type t :: %__MODULE__{
          dialect: %{name: String.t(), version: String.t(), step_ids: [String.t()]},
          contexts: %{atom() => %{atom() => term()}},
          actors: %{String.t() => %{atom() => term()}},
          surfaces: %{String.t() => Surface.t()},
          model: %{String.t() => Entity.t()},
          policies: %{String.t() => %{String.t() => [String.t()]}},
          invariants: [Invariant.t()],
          derived: SpecDSL.Derived.t(),
          effects: [SpecDSL.Effect.t()],
          scenarios: [Scenario.t()]
        }

  defstruct [
    :dialect,
    contexts: %{},
    actors: %{},
    surfaces: %{},
    model: %{},
    policies: %{},
    invariants: [],
    derived: %SpecDSL.Derived{},
    effects: [],
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
  @field_types %{
    "text" => :text,
    "email" => :email,
    "phone" => :phone,
    "url" => :url,
    "money" => :money,
    "integer" => :integer,
    "decimal" => :decimal,
    "date" => :date,
    "datetime" => :datetime,
    "boolean" => :boolean,
    "enum" => :enum
  }
  @step_modes %{"test" => :test, "demo" => :demo, "domain" => :domain}
  @invariant_kinds %{
    "product" => :product,
    "sum" => :sum,
    "unique" => :unique,
    "frozen-except" => :frozen_except,
    "same-parent" => :same_parent,
    "sequence" => :sequence
  }

  @comparison_ops %{"is" => :is, "is not" => :is_not, "before" => :before, "after" => :after}

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
      invariants: raw |> Map.get("invariants", []) |> Enum.map(&build_invariant/1),
      derived: raw |> Map.get("derived", %{}) |> build_derived(),
      effects: raw |> Map.get("effects", []) |> Enum.map(&build_effect/1),
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
       fields: raw |> Map.get("fields", []) |> Enum.map(&build_field/1),
       relations: raw |> Map.get("relations", []) |> Enum.map(&build_relation/1),
       machines: raw |> Map.get("machines", %{}) |> Map.new(&build_machine/1),
       order: raw |> Map.get("order") |> build_order()
     }}
  end

  defp build_order(nil), do: nil

  defp build_order(raw),
    do: %{field: Map.fetch!(raw, "field"), direction: Map.fetch!(raw, "direction")}

  defp build_field(name) when is_binary(name), do: %Field{name: name}

  defp build_field(raw) do
    %Field{
      name: Map.fetch!(raw, "name"),
      type: raw |> Map.get("type") |> build_field_type(),
      required: Map.get(raw, "required", false),
      values: Map.get(raw, "values")
    }
  end

  defp build_field_type(nil), do: nil
  defp build_field_type(type), do: fetch_known!(@field_types, type, "field type")

  defp build_relation(raw) do
    %{
      kind: fetch_known!(@relation_kinds, Map.fetch!(raw, "kind"), "relation kind"),
      entity: Map.fetch!(raw, "entity"),
      name: Map.get(raw, "name")
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

  defp build_invariant(raw) do
    %Invariant{
      kind: fetch_known!(@invariant_kinds, Map.fetch!(raw, "kind"), "invariant kind"),
      entity: Map.fetch!(raw, "entity"),
      field: raw |> Map.get("field") |> optional_atom(),
      left: raw |> Map.get("left") |> optional_atom(),
      right: raw |> Map.get("right") |> optional_atom(),
      relation: raw |> Map.get("relation") |> optional_atom(),
      target: Map.get(raw, "target"),
      target_field: raw |> Map.get("targetField") |> optional_atom(),
      actions: raw |> Map.get("actions", []) |> Enum.map(&snake_atom/1),
      prefix: Map.get(raw, "prefix"),
      width: Map.get(raw, "width"),
      parent: raw |> Map.get("parent") |> optional_atom(),
      relation_entity: Map.get(raw, "relationEntity"),
      relation_parent: raw |> Map.get("relationParent") |> optional_atom(),
      file: Map.get(raw, "file"),
      line: Map.get(raw, "line")
    }
  end

  defp build_effect(raw) do
    %SpecDSL.Effect{
      entity: Map.fetch!(raw, "entity"),
      action: raw |> Map.fetch!("action") |> snake_atom(),
      field: raw |> Map.fetch!("field") |> snake_atom(),
      state: Map.fetch!(raw, "state"),
      target: Map.fetch!(raw, "target"),
      owner: Map.fetch!(raw, "owner"),
      relation: raw |> Map.fetch!("relation") |> snake_atom(),
      owner_relation: raw |> Map.fetch!("ownerRelation") |> snake_atom(),
      target_relation: raw |> Map.fetch!("targetRelation") |> snake_atom(),
      values:
        raw
        |> Map.get("values", [])
        |> Enum.map(fn %{"field" => field, "value" => value} -> {snake_atom(field), value} end),
      file: Map.get(raw, "file"),
      line: Map.get(raw, "line")
    }
  end

  defp build_derived(raw) do
    %SpecDSL.Derived{
      predicates: raw |> Map.get("predicates", []) |> Enum.map(&build_predicate/1),
      counts: raw |> Map.get("counts", []) |> Enum.map(&build_count/1)
    }
  end

  defp build_predicate(raw) do
    %SpecDSL.Predicate{
      entity: Map.fetch!(raw, "entity"),
      name: Map.fetch!(raw, "name"),
      condition: raw |> Map.fetch!("condition") |> build_condition(),
      file: Map.get(raw, "file"),
      line: Map.get(raw, "line")
    }
  end

  defp build_condition(%{"op" => op, "left" => left, "right" => right}) when op in ["and", "or"],
    do: %{
      op: String.to_existing_atom(op),
      left: build_condition(left),
      right: build_condition(right)
    }

  defp build_condition(%{"op" => op, "field" => field, "value" => value}),
    do: %{
      op: fetch_known!(@comparison_ops, op, "comparison"),
      field: snake_atom(field),
      value: value
    }

  defp build_count(raw) do
    %SpecDSL.Count{
      name: Map.fetch!(raw, "name"),
      entity: Map.fetch!(raw, "entity"),
      predicate: Map.fetch!(raw, "predicate"),
      file: Map.get(raw, "file"),
      line: Map.get(raw, "line")
    }
  end

  defp optional_atom(nil), do: nil
  defp optional_atom(name), do: snake_atom(name)

  defp build_surface({name, raw}) do
    controls =
      raw
      |> Map.get("controls", %{})
      |> Map.new(fn {control_name, control_raw} ->
        {control_name, build_control(control_name, control_raw)}
      end)

    {name,
     %Surface{
       name: name,
       route: Map.get(raw, "route"),
       shared: Map.get(raw, "shared", false),
       controls: controls
     }}
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
      story: Map.get(raw, "story"),
      steps: raw |> Map.get("steps", []) |> Enum.map(&build_step(&1, surfaces))
    }
  end

  defp build_step(raw, surfaces) do
    %Step{
      id: Map.fetch!(raw, "id"),
      line: Map.get(raw, "line"),
      args: raw |> Map.get("args", %{}) |> resolve_args(surfaces),
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
