defmodule SpecDSL.InvariantCase do
  @moduledoc "Defines tests holding an app's behaviour to the product, sum, unique, frozen-except, same-parent and sequence invariants the spec declares."

  import ExUnit.Assertions
  import StreamData
  use ExUnitProperties

  alias SpecDSL.{Adapter, CaseOptions, Union}

  @max_runs 20

  @doc "Defines the invariant tests for the ASTs of the `:ast` glob, checked through the `:adapter` module."
  defmacro __using__(opts) do
    config = CaseOptions.read(opts, __CALLER__)
    adapter = config.adapter
    invariants = Union.invariants(config.asts)

    tests = Enum.map(invariants, &invariant_test(&1, adapter))

    quote do
      unquote(CaseOptions.preamble(config, true))
      @spec_dsl_invariants unquote(Macro.escape(invariants))
      unquote_splicing(tests)
    end
  end

  defp invariant_test(%{kind: :product} = invariant, adapter) do
    name =
      "#{invariant.entity}.#{invariant.field} equals #{spelling(invariant.left)} times #{spelling(invariant.right)}"

    test_definition(name, :check_product, adapter, invariant)
  end

  defp invariant_test(%{kind: :sum} = invariant, adapter) do
    name =
      "#{invariant.entity}.#{invariant.field} equals the sum of its #{invariant.target}.#{invariant.target_field}"

    quote do
      test unquote(name) do
        SpecDSL.InvariantCase.check_sum(
          unquote(adapter),
          unquote(Macro.escape(invariant)),
          @spec_dsl_invariants
        )
      end
    end
  end

  defp invariant_test(%{kind: :unique} = invariant, adapter) do
    name = "#{invariant.entity}.#{invariant.field} rejects a second record with the same value"
    test_definition(name, :check_unique, adapter, invariant)
  end

  defp invariant_test(%{kind: :frozen_except} = invariant, adapter) do
    name =
      "#{invariant.entity}.#{invariant.field} only changes through #{Enum.join(invariant.actions, ", ")}"

    test_definition(name, :check_frozen_except, adapter, invariant)
  end

  defp invariant_test(%{kind: :same_parent} = invariant, adapter) do
    name =
      "#{invariant.entity} belongs to the same #{invariant.target} as its #{invariant.relation}"

    test_definition(name, :check_same_parent, adapter, invariant)
  end

  defp invariant_test(%{kind: :sequence} = invariant, adapter) do
    name =
      "#{invariant.entity}.#{invariant.field} is assigned on creation as #{invariant.prefix} followed by a #{invariant.width} digit sequence"

    test_definition(name, :check_sequence, adapter, invariant)
  end

  defp test_definition(name, check, adapter, invariant) do
    quote do
      test unquote(name) do
        SpecDSL.InvariantCase.unquote(check)(unquote(adapter), unquote(Macro.escape(invariant)))
      end
    end
  end

  @doc false
  def check_product(adapter, %{entity: entity, field: field, left: left, right: right}) do
    resource = Adapter.resource!(adapter, entity)

    check all(
            left_value <- value_generator(adapter, resource, left),
            right_value <- value_generator(adapter, resource, right),
            max_runs: @max_runs
          ) do
      record = adapter.create(entity, string_keys(%{left => left_value, right => right_value}))
      reloaded = adapter.reload(entity, record)
      expected = Decimal.mult(Decimal.new(left_value), Decimal.new(right_value))

      assert Decimal.equal?(decimal_field(reloaded, entity, field), expected),
             "#{entity}.#{field} is #{inspect(reloaded[Atom.to_string(field)])} for " <>
               "#{left} #{inspect(left_value)} and #{right} #{inspect(right_value)}, " <>
               "expected #{expected}"
    end
  end

  @doc false
  def check_sum(adapter, invariant, invariants) do
    %{entity: entity, field: field, target: target, target_field: target_field} = invariant
    foreign_key = foreign_key_to_children(adapter, entity, target)
    child_attributes = operand_attributes(adapter, invariants, target, target_field)

    check all(children <- list_of(child_attributes, max_length: 4), max_runs: @max_runs) do
      parent = adapter.create(entity, %{})

      child_totals =
        Enum.map(children, fn attributes ->
          child =
            adapter.create(target, Map.put(string_keys(attributes), foreign_key, parent.id))

          target |> adapter.reload(child) |> decimal_field(target, target_field)
        end)

      expected = Enum.reduce(child_totals, Decimal.new(0), &Decimal.add/2)
      reloaded = adapter.reload(entity, parent)

      assert Decimal.equal?(decimal_field(reloaded, entity, field), expected),
             "#{entity}.#{field} is #{inspect(reloaded[Atom.to_string(field)])}, " <>
               "expected the sum #{expected} of #{length(children)} #{target}.#{target_field}"
    end
  end

  @doc false
  def check_unique(adapter, %{entity: entity, field: field}) do
    value = "UNIQUE-#{System.unique_integer([:positive])}"
    attributes = %{Atom.to_string(field) => value}

    adapter.create(entity, attributes)

    assert {:error, message} = adapter.try_create(entity, attributes),
           "#{entity}.#{field} accepted a second record with the value #{value}"

    assert message =~ "has already been taken"
  end

  @doc false
  def check_frozen_except(adapter, %{entity: entity, field: field, actions: actions}) do
    resource = Adapter.resource!(adapter, entity)
    key = Atom.to_string(field)

    for action <- adapter.update_actions(resource) -- actions do
      record = adapter.create(entity, %{})
      before_value = adapter.reload(entity, record)[key]
      adapter.attempt_update(entity, record, action, field)

      assert adapter.reload(entity, record)[key] == before_value,
             "#{entity}.#{field} changed through #{action}"
    end
  end

  @doc false
  def check_same_parent(adapter, invariant) do
    %{
      entity: entity,
      target: target,
      relation: relation,
      parent: parent,
      relation_entity: relation_entity,
      relation_parent: relation_parent
    } = invariant

    parent_key = "#{parent}_id"
    relation_key = "#{relation}_id"
    home = adapter.create(target, %{})
    elsewhere = adapter.create(target, %{})
    local = adapter.create(relation_entity, %{"#{relation_parent}_id" => home.id})
    foreign = adapter.create(relation_entity, %{"#{relation_parent}_id" => elsewhere.id})

    assert {:ok, _record} =
             adapter.try_create(entity, %{parent_key => home.id, relation_key => local.id})

    assert {:error, _message} =
             adapter.try_create(entity, %{parent_key => home.id, relation_key => foreign.id}),
           "#{entity} accepted a #{relation} that belongs to a different #{target}"
  end

  @doc false
  def check_sequence(adapter, %{entity: entity, field: field, prefix: prefix, width: width}) do
    key = Atom.to_string(field)

    numbers =
      for _creation <- 1..3 do
        entity |> adapter.create(%{}) |> then(&adapter.reload(entity, &1)[key])
      end

    pattern = Regex.compile!("^#{Regex.escape(prefix)}\\d{#{width}}$")

    assert Enum.all?(numbers, &Regex.match?(pattern, &1)),
           "#{entity}.#{field} assigned #{inspect(numbers)}"

    sequences =
      Enum.map(numbers, &(&1 |> String.replace_prefix(prefix, "") |> String.to_integer()))

    assert Enum.drop(sequences, 1) == Enum.map(Enum.drop(sequences, -1), &(&1 + 1)),
           "#{entity}.#{field} assigned #{inspect(numbers)}, which is not consecutive"
  end

  defp operand_attributes(adapter, invariants, entity, field) do
    resource = Adapter.resource!(adapter, entity)

    case Enum.find(
           invariants,
           &(&1.kind == :product and &1.entity == entity and &1.field == field)
         ) do
      %{left: left, right: right} ->
        fixed_map(%{
          left => value_generator(adapter, resource, left),
          right => value_generator(adapter, resource, right)
        })

      nil ->
        fixed_map(%{field => value_generator(adapter, resource, field)})
    end
  end

  defp value_generator(adapter, resource, field) do
    case Enum.find(adapter.fields(resource), &(&1.name == field)) do
      %{type: :decimal} -> map(integer(1..100_000), &Decimal.div(Decimal.new(&1), 100))
      _integer_or_other -> integer(1..1000)
    end
  end

  defp foreign_key_to_children(adapter, entity, target) do
    parent_resource = Adapter.resource!(adapter, entity)
    child_resource = Adapter.resource!(adapter, target)

    relationship =
      parent_resource
      |> adapter.relationships()
      |> Enum.find(&(&1.kind == :has_many and &1.destination == child_resource))

    Atom.to_string(relationship.destination_attribute)
  end

  defp decimal_field(record, entity, field) do
    case Map.fetch(record, Atom.to_string(field)) do
      {:ok, value} -> Decimal.new(value)
      :error -> raise "#{entity}.#{field} is not readable on the #{entity} record"
    end
  end

  defp string_keys(attributes),
    do: Map.new(attributes, fn {key, value} -> {to_string(key), value} end)

  defp spelling(name), do: name |> Atom.to_string() |> String.replace("_", " ")
end
