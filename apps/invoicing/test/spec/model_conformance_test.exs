defmodule Invoicing.ModelConformanceTest do
  use ExUnit.Case, async: true

  alias Invoicing.SpecSupport.Factory

  @model "../../specs/**/*.ast.json"
         |> Path.expand()
         |> Path.wildcard()
         |> Enum.sort()
         |> hd()
         |> SpecDSL.AST.load!()
         |> Map.fetch!(:model)

  for {entity_name, entity} <- @model do
    test "#{entity_name}: every entity maps to a resource" do
      assert {:ok, _resource} = resource_for(unquote(entity_name)),
             "#{unquote(entity_name)}: no resource is registered for this entity"
    end

    test "#{entity_name}: every field is a public attribute, calculation or aggregate" do
      entity = unquote(Macro.escape(entity))
      resource = Factory.resource_for!(unquote(entity_name))
      expected_fields = entity.fields |> Enum.map(&field_atom/1) |> Enum.sort()
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
