defmodule Invoicing.SpecInvariants do
  @moduledoc "Invariants declared across every compiled spec AST, with generators that build the records they constrain."

  import StreamData

  alias Invoicing.SpecSupport.Factory

  @doc "Every distinct invariant from every compiled spec AST."
  def all do
    "../../specs/**/*.ast.json"
    |> Path.expand()
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.flat_map(&(&1 |> SpecDSL.AST.load!() |> Map.fetch!(:invariants)))
    |> Enum.uniq()
  end

  @doc "A generator of attributes that determine the invariant field's value on the named entity."
  def operand_attributes(invariants, entity, field) do
    resource = Factory.resource_for!(entity)

    case Enum.find(
           invariants,
           &(&1.kind == :product and &1.entity == entity and &1.field == field)
         ) do
      %{left: left, right: right} ->
        fixed_map(%{
          left => value_generator(resource, left),
          right => value_generator(resource, right)
        })

      nil ->
        fixed_map(%{field => value_generator(resource, field)})
    end
  end

  @doc "A generator of positive integers or decimals matching the attribute's type."
  def value_generator(resource, field) do
    case Ash.Resource.Info.attribute(resource, field) do
      %{type: Ash.Type.Decimal} ->
        map(integer(1..100_000), &Decimal.div(Decimal.new(&1), 100))

      _integer_or_other ->
        integer(1..1000)
    end
  end

  @doc "The spec spelling of a snake_case atom name."
  def spelling(name), do: name |> Atom.to_string() |> String.replace("_", " ")

  @doc "Reads a field of a reloaded record as a decimal."
  def decimal_field(record, entity, field) do
    case Map.fetch(record, Atom.to_string(field)) do
      {:ok, value} -> Decimal.new(value)
      :error -> raise "#{entity}.#{field} is not readable on the #{entity} record"
    end
  end

  @doc "Spec-spelled string keys for a map of atom-keyed attributes."
  def string_keys(attributes),
    do: Map.new(attributes, fn {key, value} -> {to_string(key), value} end)

  @doc "Update actions of the resource that the invariant does not name."
  def other_update_actions(resource, allowed_actions) do
    resource
    |> Ash.Resource.Info.actions()
    |> Enum.filter(&(&1.type == :update and &1.name not in allowed_actions))
  end

  @doc "Parameters an update action could use to try to change the field."
  def attempted_params(resource, action, field) do
    attribute = Ash.Resource.Info.attribute(resource, field)

    if attribute != nil and attribute.type == Ash.Type.String and field in action.accept do
      %{field => "changed-#{System.unique_integer([:positive])}"}
    else
      %{}
    end
  end
end

defmodule Invoicing.InvariantTest do
  use Invoicing.DataCase, async: true
  use ExUnitProperties

  alias Invoicing.SpecInvariants
  alias Invoicing.SpecSupport.Factory

  @invariants SpecInvariants.all()

  @max_runs 20

  for %{kind: :product} = invariant <- @invariants do
    test "#{invariant.entity}.#{invariant.field} equals #{SpecInvariants.spelling(invariant.left)} times #{SpecInvariants.spelling(invariant.right)}" do
      %{entity: entity, field: field, left: left, right: right} =
        unquote(Macro.escape(invariant))

      resource = Factory.resource_for!(entity)

      check all(
              left_value <- SpecInvariants.value_generator(resource, left),
              right_value <- SpecInvariants.value_generator(resource, right),
              max_runs: @max_runs
            ) do
        record =
          Factory.create(
            entity,
            SpecInvariants.string_keys(%{left => left_value, right => right_value})
          )

        reloaded = Factory.reload(entity, record.id)
        expected = Decimal.mult(Decimal.new(left_value), Decimal.new(right_value))

        assert Decimal.equal?(SpecInvariants.decimal_field(reloaded, entity, field), expected)
      end
    end
  end

  for %{kind: :sum} = invariant <- @invariants do
    test "#{invariant.entity}.#{invariant.field} equals the sum of its #{invariant.target}.#{invariant.target_field}" do
      %{entity: entity, field: field, target: target, target_field: target_field} =
        unquote(Macro.escape(invariant))

      foreign_key = foreign_key_to_children(entity, target)
      child_attributes = SpecInvariants.operand_attributes(@invariants, target, target_field)

      check all(
              children <- list_of(child_attributes, max_length: 4),
              max_runs: @max_runs
            ) do
        parent = Factory.create(entity, %{})

        child_totals =
          Enum.map(children, fn attributes ->
            child =
              Factory.create(
                target,
                Map.put(SpecInvariants.string_keys(attributes), foreign_key, parent.id)
              )

            target
            |> Factory.reload(child.id)
            |> SpecInvariants.decimal_field(target, target_field)
          end)

        expected = Enum.reduce(child_totals, Decimal.new(0), &Decimal.add/2)
        reloaded = Factory.reload(entity, parent.id)

        assert Decimal.equal?(SpecInvariants.decimal_field(reloaded, entity, field), expected)
      end
    end
  end

  for %{kind: :unique} = invariant <- @invariants do
    test "#{invariant.entity}.#{invariant.field} rejects a second record with the same value" do
      %{entity: entity, field: field} = unquote(Macro.escape(invariant))
      value = "UNIQUE-#{System.unique_integer([:positive])}"
      attributes = %{Atom.to_string(field) => value}

      Factory.create(entity, attributes)

      error = assert_raise Ash.Error.Invalid, fn -> Factory.create(entity, attributes) end
      assert Exception.message(error) =~ "has already been taken"
    end
  end

  for %{kind: :frozen_except} = invariant <- @invariants do
    test "#{invariant.entity}.#{invariant.field} only changes through #{Enum.join(invariant.actions, ", ")}" do
      %{entity: entity, field: field, actions: actions} = unquote(Macro.escape(invariant))
      resource = Factory.resource_for!(entity)
      key = Atom.to_string(field)

      for action <- SpecInvariants.other_update_actions(resource, actions) do
        record = Factory.create(entity, %{})
        before_value = Factory.reload(entity, record.id)[key]
        params = SpecInvariants.attempted_params(resource, action, field)

        entity
        |> Factory.fetch(record.id)
        |> Ash.Changeset.for_update(action.name, params, authorize?: false)
        |> Ash.update()

        assert Factory.reload(entity, record.id)[key] == before_value,
               "#{entity}.#{field} changed through #{action.name}"
      end
    end
  end

  for %{kind: :same_parent} = invariant <- @invariants do
    test "#{invariant.entity} belongs to the same #{invariant.target} as its #{invariant.relation}" do
      %{
        entity: entity,
        target: target,
        relation: relation,
        parent: parent,
        relation_entity: relation_entity,
        relation_parent: relation_parent
      } = unquote(Macro.escape(invariant))

      parent_key = "#{parent}_id"
      relation_key = "#{relation}_id"
      home = Factory.create(target, %{})
      elsewhere = Factory.create(target, %{})
      local_contact = Factory.create(relation_entity, %{"#{relation_parent}_id" => home.id})

      foreign_contact =
        Factory.create(relation_entity, %{"#{relation_parent}_id" => elsewhere.id})

      assert %{id: _id} =
               Factory.create(entity, %{parent_key => home.id, relation_key => local_contact.id})

      assert_raise Ash.Error.Invalid, fn ->
        Factory.create(entity, %{parent_key => home.id, relation_key => foreign_contact.id})
      end
    end
  end

  for %{kind: :sequence} = invariant <- @invariants do
    test "#{invariant.entity}.#{invariant.field} is assigned on creation as #{invariant.prefix} followed by a #{invariant.width} digit sequence" do
      %{entity: entity, field: field, prefix: prefix, width: width} =
        unquote(Macro.escape(invariant))

      key = Atom.to_string(field)

      numbers =
        for _creation <- 1..3 do
          record = Factory.create(entity, %{})
          Factory.reload(entity, record.id)[key]
        end

      pattern = Regex.compile!("^#{Regex.escape(prefix)}\\d{#{width}}$")
      assert Enum.all?(numbers, &Regex.match?(pattern, &1)), "assigned #{inspect(numbers)}"

      sequences =
        Enum.map(numbers, &(&1 |> String.replace_prefix(prefix, "") |> String.to_integer()))

      assert Enum.drop(sequences, 1) == Enum.map(Enum.drop(sequences, -1), &(&1 + 1))
    end
  end

  defp foreign_key_to_children(entity, target) do
    parent_resource = Factory.resource_for!(entity)
    child_resource = Factory.resource_for!(target)

    relationship =
      parent_resource
      |> Ash.Resource.Info.relationships()
      |> Enum.find(&(&1.type == :has_many and &1.destination == child_resource))

    Atom.to_string(relationship.destination_attribute)
  end
end
