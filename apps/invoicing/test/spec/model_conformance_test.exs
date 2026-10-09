defmodule Invoicing.SpecUnion do
  @moduledoc "Union of the model entities declared across every compiled spec AST."

  alias SpecDSL.Entity

  @doc "Entities by name with fields, relations and machines merged across all ASTs."
  def model do
    "../../specs/**/*.ast.json"
    |> Path.expand()
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.map(&(&1 |> SpecDSL.AST.load!() |> Map.fetch!(:model)))
    |> Enum.reduce(
      %{},
      &Map.merge(&2, &1, fn _name, left, right -> merge_entity(left, right) end)
    )
  end

  defp merge_entity(left, right) do
    %Entity{
      fields: Enum.uniq_by(left.fields ++ right.fields, & &1.name),
      relations: Enum.uniq(left.relations ++ right.relations),
      machines:
        Map.merge(left.machines, right.machines, fn _field, a, b -> merge_machine(a, b) end)
    }
  end

  defp merge_machine(left, right) do
    %{
      states: Enum.uniq(left.states ++ right.states),
      transitions: Enum.uniq(left.transitions ++ right.transitions)
    }
  end
end

defmodule Invoicing.ModelConformanceTest do
  use ExUnit.Case, async: true

  alias Invoicing.SpecSupport.Factory
  alias SpecDSL.{Entity, Field}

  @model Invoicing.SpecUnion.model()

  for {entity_name, entity} <- @model do
    test "#{entity_name}: every entity maps to a resource" do
      assert {:ok, _resource} = resource_for(unquote(entity_name)),
             "#{unquote(entity_name)}: no resource is registered for this entity"
    end

    test "#{entity_name}: every field is a public attribute, calculation or aggregate" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))
      expected_fields = entity |> Entity.field_names() |> Enum.map(&field_atom/1) |> Enum.sort()
      public_fields = public_field_names(resource)

      missing_fields = expected_fields -- public_fields

      assert missing_fields == [],
             "#{unquote(entity_name)}: fields #{inspect(missing_fields)} are not public attributes, " <>
               "calculations or aggregates of #{inspect(resource)}"
    end

    test "#{entity_name}: relations match the resource's relationships" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))
      expected_relations = entity.relations |> Enum.map(&spec_relation/1) |> Enum.sort()

      actual_relations =
        resource
        |> Ash.Resource.Info.relationships()
        |> Enum.map(&resource_relation/1)
        |> Enum.sort()

      assert actual_relations == expected_relations,
             "#{unquote(entity_name)}: relations differ; spec has #{inspect(expected_relations)}, " <>
               "#{inspect(resource)} has #{inspect(actual_relations)}"
    end

    test "#{entity_name}: typed fields have the declared type, values and requiredness" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))

      mismatches =
        entity.fields
        |> Enum.flat_map(&field_mismatches(resource, &1))

      assert mismatches == [],
             "#{unquote(entity_name)}: " <> Enum.join(mismatches, "; ")
    end

    test "#{entity_name}: named relations are relationships of that name to the entity's resource" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))

      mismatches =
        entity.relations
        |> Enum.reject(&(&1.name == Macro.underscore(&1.entity)))
        |> Enum.flat_map(&relation_mismatches(resource, &1))

      assert mismatches == [],
             "#{unquote(entity_name)}: " <> Enum.join(mismatches, "; ")
    end

    test "#{entity_name}: state machines match the resource's transitions" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))

      expected_machine_fields =
        entity.machines |> Map.keys() |> Enum.map(&field_atom/1) |> Enum.sort()

      assert actual_machine_fields(resource) == expected_machine_fields,
             "#{unquote(entity_name)}: spec declares machines on #{inspect(expected_machine_fields)}, " <>
               "#{inspect(resource)} has a machine on #{inspect(actual_machine_fields(resource))}"

      for {field_name, machine} <- entity.machines do
        expected_states = machine.states |> Enum.map(&String.to_atom/1) |> Enum.sort()
        actual_states = resource |> AshStateMachine.Info.state_machine_all_states() |> Enum.sort()

        assert actual_states == expected_states,
               "#{unquote(entity_name)}.#{field_name}: spec states #{inspect(expected_states)}, " <>
                 "#{inspect(resource)} states #{inspect(actual_states)}"

        expected_transitions =
          machine.transitions
          |> Enum.map(&{String.to_atom(&1.from), String.to_atom(&1.to)})
          |> Enum.sort()

        actual_transitions = resource |> transition_pairs() |> Enum.sort()

        assert actual_transitions == expected_transitions,
               "#{unquote(entity_name)}.#{field_name}: spec transitions #{inspect(expected_transitions)}, " <>
                 "#{inspect(resource)} transitions #{inspect(actual_transitions)}"
      end
    end
  end

  defp resource_for(entity_name) do
    {:ok, Factory.resource_for!(entity_name)}
  rescue
    ArgumentError -> :error
  end

  defp field_mismatches(resource, field) do
    name = field_atom(field.name)

    case Ash.Resource.Info.field(resource, name) do
      nil ->
        ["#{field.name} is not a field of #{inspect(resource)}"]

      ash_field ->
        type_mismatches(resource, field, ash_field) ++ requiredness_mismatches(field, ash_field)
    end
  end

  defp type_mismatches(_resource, %Field{type: nil}, _ash_field), do: []

  defp type_mismatches(resource, field, ash_field) do
    {ash_type, constraints} = ash_type_and_constraints(resource, ash_field)
    expected_types = ash_types_for(field.type)

    type_problem =
      if ash_type in expected_types do
        []
      else
        [
          "#{field.name} spec says #{field.type} (#{inspect(expected_types)}), " <>
            "Ash has #{inspect(ash_type)}"
        ]
      end

    type_problem ++ enum_mismatches(field, constraints)
  end

  defp enum_mismatches(%Field{type: :enum} = field, constraints) do
    expected_values = field.values |> Enum.map(&String.to_atom/1) |> Enum.sort()
    actual_values = constraints |> Keyword.get(:one_of, []) |> Enum.sort()

    if expected_values == actual_values do
      []
    else
      [
        "#{field.name} spec says one of #{inspect(expected_values)}, " <>
          "Ash has one_of #{inspect(actual_values)}"
      ]
    end
  end

  defp enum_mismatches(_field, _constraints), do: []

  defp requiredness_mismatches(%Field{required: true} = field, ash_field) do
    if Map.get(ash_field, :allow_nil?, true) == false do
      []
    else
      ["#{field.name} spec says required, Ash allows nil"]
    end
  end

  defp requiredness_mismatches(_field, _ash_field), do: []

  defp ash_type_and_constraints(resource, %Ash.Resource.Aggregate{} = aggregate) do
    {:ok, type} = Ash.Resource.Info.aggregate_type(resource, aggregate)
    {Ash.Type.get_type(type), aggregate.constraints || []}
  end

  defp ash_type_and_constraints(_resource, ash_field),
    do: {Ash.Type.get_type(ash_field.type), ash_field.constraints || []}

  defp ash_types_for(type) when type in [:text, :email, :phone, :url], do: [Ash.Type.String]
  defp ash_types_for(type) when type in [:money, :decimal], do: [Ash.Type.Decimal]
  defp ash_types_for(:integer), do: [Ash.Type.Integer]
  defp ash_types_for(:date), do: [Ash.Type.Date]
  defp ash_types_for(:datetime), do: [Ash.Type.UtcDatetime, Ash.Type.UtcDatetimeUsec]
  defp ash_types_for(:boolean), do: [Ash.Type.Boolean]
  defp ash_types_for(:enum), do: [Ash.Type.Atom]

  defp relation_mismatches(resource, relation) do
    name = field_atom(relation.name)
    destination = Factory.resource_for!(relation.entity)

    case Ash.Resource.Info.relationship(resource, name) do
      nil ->
        [
          "relation #{relation.name} to #{relation.entity}: #{inspect(resource)} has no relationship of that name"
        ]

      %{destination: ^destination, type: type} when type == relation.kind ->
        []

      %{destination: actual_destination, type: type} ->
        [
          "relation #{relation.name}: spec says #{relation.kind} #{inspect(destination)}, " <>
            "Ash has #{type} #{inspect(actual_destination)}"
        ]
    end
  end

  defp field_atom(spec_spelling),
    do: spec_spelling |> String.replace(" ", "_") |> String.to_atom()

  defp public_field_names(resource) do
    [
      Ash.Resource.Info.public_attributes(resource),
      Ash.Resource.Info.public_calculations(resource),
      Ash.Resource.Info.public_aggregates(resource)
    ]
    |> Enum.concat()
    |> Enum.map(& &1.name)
    |> Enum.sort()
  end

  defp spec_relation(%{kind: kind, entity: destination_entity}) do
    {kind, Factory.resource_for!(destination_entity)}
  end

  defp resource_relation(%{type: kind, destination: destination}), do: {kind, destination}

  defp actual_machine_fields(resource) do
    if AshStateMachine in Spark.extensions(resource) do
      [AshStateMachine.Info.state_machine_state_attribute!(resource)]
    else
      []
    end
  end

  defp transition_pairs(resource) do
    all_states = AshStateMachine.Info.state_machine_all_states(resource)

    resource
    |> AshStateMachine.Info.state_machine_transitions()
    |> Enum.flat_map(fn transition ->
      for from_state <- expand_states(transition.from, all_states),
          to_state <- expand_states(transition.to, all_states),
          do: {from_state, to_state}
    end)
    |> Enum.uniq()
  end

  defp expand_states(:*, all_states), do: all_states
  defp expand_states(states, _all_states), do: List.wrap(states)
end
