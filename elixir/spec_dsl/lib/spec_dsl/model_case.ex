defmodule SpecDSL.ModelCase do
  @moduledoc "Defines tests holding an app's resources to the entities, fields, relations and state machines the spec's Model declares."

  import ExUnit.Assertions

  alias SpecDSL.{Adapter, CaseOptions, Entity, Field, Union}

  @doc "Defines the model conformance tests for the ASTs of the `:ast` glob, checked through the `:adapter` module."
  defmacro __using__(opts) do
    config = CaseOptions.read(opts, __CALLER__)
    adapter = config.adapter
    model = Union.model(config.asts)

    tests =
      for {entity_name, entity} <- model do
        entity_tests(entity_name, entity, adapter)
      end

    quote do
      unquote(CaseOptions.preamble(config, false))
      unquote_splicing(List.flatten(tests))
    end
  end

  defp entity_tests(entity_name, entity, adapter) do
    escaped = Macro.escape(entity)

    for {title, check} <- [
          {"every entity maps to a resource", :check_resource},
          {"every field is a public attribute, calculation or aggregate", :check_fields},
          {"relations match the resource's relationships", :check_relations},
          {"typed fields have the declared type, values and requiredness", :check_typed_fields},
          {"named relations are relationships of that name to the entity's resource",
           :check_named_relations},
          {"state machines match the resource's transitions", :check_state_machines}
        ] do
      quote do
        test unquote("#{entity_name}: #{title}") do
          SpecDSL.ModelCase.unquote(check)(
            unquote(adapter),
            unquote(entity_name),
            unquote(escaped)
          )
        end
      end
    end
  end

  @doc false
  def check_resource(adapter, entity_name, _entity) do
    assert {:ok, _resource} = adapter.resource_for(entity_name),
           "#{entity_name}: no resource is registered for this entity"
  end

  @doc false
  def check_fields(adapter, entity_name, entity) do
    resource = Adapter.resource!(adapter, entity_name)
    expected_fields = entity |> Entity.field_names() |> Enum.map(&field_atom/1) |> Enum.sort()
    public_fields = resource |> adapter.fields() |> Enum.map(& &1.name) |> Enum.sort()
    missing_fields = expected_fields -- public_fields

    assert missing_fields == [],
           "#{entity_name}: fields #{inspect(missing_fields)} are not public attributes, " <>
             "calculations or aggregates of #{inspect(resource)}"
  end

  @doc false
  def check_relations(adapter, entity_name, entity) do
    resource = Adapter.resource!(adapter, entity_name)

    expected_relations =
      entity.relations
      |> Enum.map(&{&1.kind, Adapter.resource!(adapter, &1.entity)})
      |> Enum.sort()

    actual_relations =
      resource |> adapter.relationships() |> Enum.map(&{&1.kind, &1.destination}) |> Enum.sort()

    assert actual_relations == expected_relations,
           "#{entity_name}: relations differ; spec has #{inspect(expected_relations)}, " <>
             "#{inspect(resource)} has #{inspect(actual_relations)}"
  end

  @doc false
  def check_typed_fields(adapter, entity_name, entity) do
    resource = Adapter.resource!(adapter, entity_name)
    resource_fields = adapter.fields(resource)
    mismatches = Enum.flat_map(entity.fields, &field_mismatches(resource, resource_fields, &1))

    assert mismatches == [], "#{entity_name}: " <> Enum.join(mismatches, "; ")
  end

  @doc false
  def check_named_relations(adapter, entity_name, entity) do
    resource = Adapter.resource!(adapter, entity_name)
    relationships = adapter.relationships(resource)

    mismatches =
      entity.relations
      |> Enum.reject(&(&1.name == Macro.underscore(&1.entity)))
      |> Enum.flat_map(&relation_mismatches(adapter, resource, relationships, &1))

    assert mismatches == [], "#{entity_name}: " <> Enum.join(mismatches, "; ")
  end

  @doc false
  def check_state_machines(adapter, entity_name, entity) do
    resource = Adapter.resource!(adapter, entity_name)
    machine = adapter.state_machine(resource)

    expected_machine_fields =
      entity.machines |> Map.keys() |> Enum.map(&field_atom/1) |> Enum.sort()

    actual_machine_fields = if machine, do: [machine.field], else: []

    assert actual_machine_fields == expected_machine_fields,
           "#{entity_name}: spec declares machines on #{inspect(expected_machine_fields)}, " <>
             "#{inspect(resource)} has a machine on #{inspect(actual_machine_fields)}"

    for {field_name, spec_machine} <- entity.machines do
      assert_machine_matches(entity_name, field_name, resource, machine, spec_machine)
    end
  end

  defp assert_machine_matches(entity_name, field_name, resource, machine, spec_machine) do
    expected_states = spec_machine.states |> Enum.map(&String.to_atom/1) |> Enum.sort()
    actual_states = Enum.sort(machine.states)

    assert actual_states == expected_states,
           "#{entity_name}.#{field_name}: spec states #{inspect(expected_states)}, " <>
             "#{inspect(resource)} states #{inspect(actual_states)}"

    expected_transitions =
      spec_machine.transitions
      |> Enum.map(&{String.to_atom(&1.from), String.to_atom(&1.to)})
      |> Enum.sort()

    actual_transitions = Enum.sort(machine.transitions)

    assert actual_transitions == expected_transitions,
           "#{entity_name}.#{field_name}: spec transitions #{inspect(expected_transitions)}, " <>
             "#{inspect(resource)} transitions #{inspect(actual_transitions)}"
  end

  defp field_mismatches(resource, resource_fields, field) do
    name = field_atom(field.name)

    case Enum.find(resource_fields, &(&1.name == name)) do
      nil ->
        ["#{field.name} is not a field of #{inspect(resource)}"]

      resource_field ->
        type_mismatches(field, resource_field) ++ requiredness_mismatches(field, resource_field)
    end
  end

  defp type_mismatches(%Field{type: nil}, _resource_field), do: []

  defp type_mismatches(field, resource_field) do
    expected_kind = kind_for(field.type)

    type_problem =
      if resource_field.type == expected_kind do
        []
      else
        [
          "#{field.name} spec says #{field.type} (#{inspect(expected_kind)}), " <>
            "app has #{inspect(resource_field.type)}"
        ]
      end

    type_problem ++ enum_mismatches(field, resource_field)
  end

  defp enum_mismatches(%Field{type: :enum} = field, resource_field) do
    expected_values = field.values |> Enum.map(&String.to_atom/1) |> Enum.sort()
    actual_values = Enum.sort(resource_field.one_of)

    if expected_values == actual_values do
      []
    else
      [
        "#{field.name} spec says one of #{inspect(expected_values)}, " <>
          "app has one_of #{inspect(actual_values)}"
      ]
    end
  end

  defp enum_mismatches(_field, _resource_field), do: []

  defp requiredness_mismatches(%Field{required: true} = field, resource_field) do
    if resource_field.allow_nil? == false do
      []
    else
      ["#{field.name} spec says required, app allows nil"]
    end
  end

  defp requiredness_mismatches(_field, _resource_field), do: []

  defp kind_for(type) when type in [:text, :email, :phone, :url], do: :string
  defp kind_for(type) when type in [:money, :decimal], do: :decimal
  defp kind_for(:enum), do: :atom
  defp kind_for(type), do: type

  defp relation_mismatches(adapter, resource, relationships, relation) do
    name = field_atom(relation.name)
    destination = Adapter.resource!(adapter, relation.entity)

    case Enum.find(relationships, &(&1.name == name)) do
      nil ->
        [
          "relation #{relation.name} to #{relation.entity}: #{inspect(resource)} has no relationship of that name"
        ]

      %{destination: ^destination, kind: kind} when kind == relation.kind ->
        []

      %{destination: actual_destination, kind: kind} ->
        [
          "relation #{relation.name}: spec says #{relation.kind} #{inspect(destination)}, " <>
            "app has #{kind} #{inspect(actual_destination)}"
        ]
    end
  end

  defp field_atom(spec_spelling),
    do: spec_spelling |> String.replace(" ", "_") |> String.to_atom()
end
