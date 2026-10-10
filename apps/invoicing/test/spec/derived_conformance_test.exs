defmodule Invoicing.SpecDerived do
  @moduledoc "Derived predicates and counts declared across every compiled spec AST, with generators of records that vary the fields a predicate reads."

  import StreamData

  alias SpecDSL.{AST, Derived}

  @today ~D[2026-01-15]

  @doc "The fixed date every predicate is evaluated on."
  def today, do: @today

  @doc "Every distinct predicate, paired with the model field definitions of its entity."
  def predicates do
    asts()
    |> Enum.flat_map(fn ast ->
      Enum.map(ast.derived.predicates, &{&1, Map.fetch!(ast.model, &1.entity).fields})
    end)
    |> Enum.uniq_by(fn {predicate, _fields} -> {predicate.entity, predicate.name} end)
  end

  @doc "Every distinct count declaration."
  def counts do
    asts() |> Enum.flat_map(& &1.derived.counts) |> Enum.uniq_by(&{&1.entity, &1.name})
  end

  @doc "A generator of atom-keyed field values covering the fields the predicate reads."
  def record_generator(predicate, model_fields) do
    predicate
    |> Derived.fields()
    |> Map.new(fn field -> {field, value_generator(field, model_fields)} end)
    |> fixed_map()
  end

  @doc "Spec-spelled attributes the factory accepts for a generated record."
  def factory_attributes(record) do
    Map.new(record, fn
      {field, %Date{} = date} -> {Atom.to_string(field), Date.to_iso8601(date)}
      {field, value} -> {Atom.to_string(field), value}
    end)
  end

  defp value_generator(field, model_fields) do
    definition = Enum.find(model_fields, &(AST.snake_atom(&1.name) == field))

    case definition do
      %{type: :enum, values: values} -> member_of(values)
      %{type: type} when type in [:date, :datetime] -> map(integer(-3..3), &Date.add(@today, &1))
      other -> raise "no generator for #{inspect(other)} field #{field}"
    end
  end

  defp asts do
    "../../specs/**/*.ast.json"
    |> Path.expand()
    |> Path.wildcard()
    |> Enum.sort()
    |> Enum.map(&AST.load!/1)
  end
end

defmodule Invoicing.DerivedConformanceTest do
  use Invoicing.DataCase, async: true
  use ExUnitProperties

  alias Invoicing.{Billing, Pipeline}
  alias Invoicing.SpecDerived
  alias Invoicing.SpecSupport.Factory
  alias SpecDSL.Derived

  @max_runs 15

  for {predicate, model_fields} <- SpecDerived.predicates() do
    test "#{predicate.entity} is #{predicate.name} exactly when the app counts the record" do
      {predicate, model_fields} = unquote(Macro.escape({predicate, model_fields}))
      actor = Factory.create("User", %{"role" => "admin"})

      check all(
              record <- SpecDerived.record_generator(predicate, model_fields),
              max_runs: @max_runs
            ) do
        before_count = app_count(predicate, actor)
        Factory.create(predicate.entity, SpecDerived.factory_attributes(record))
        counted = app_count(predicate, actor) - before_count

        assert counted ==
                 if(Derived.holds?(predicate, record, SpecDerived.today()), do: 1, else: 0),
               "#{predicate.entity} #{inspect(record)} #{predicate.name}"
      end
    end
  end

  for count <- SpecDerived.counts() do
    test "#{count.name} equals the number of generated #{count.entity} records that are #{count.predicate}" do
      count = unquote(Macro.escape(count))

      {predicate, model_fields} =
        Enum.find(
          SpecDerived.predicates(),
          fn {candidate, _fields} ->
            candidate.entity == count.entity and candidate.name == count.predicate
          end
        )

      actor = Factory.create("User", %{"role" => "admin"})

      check all(
              records <-
                list_of(SpecDerived.record_generator(predicate, model_fields), max_length: 4),
              max_runs: @max_runs
            ) do
        before_count = app_count(predicate, actor)

        Enum.each(
          records,
          &Factory.create(predicate.entity, SpecDerived.factory_attributes(&1))
        )

        expected =
          Enum.count(records, &Derived.holds?(predicate, &1, SpecDerived.today()))

        assert app_count(predicate, actor) - before_count == expected
      end
    end
  end

  defp app_count(%{entity: "Task", name: "overdue"}, actor),
    do: Pipeline.count_overdue_tasks(SpecDerived.today(), actor)

  defp app_count(%{entity: "Deal", name: "open"}, actor),
    do: actor |> Pipeline.count_open_deals_by_stage() |> Enum.map(&elem(&1, 1)) |> Enum.sum()

  defp app_count(%{entity: "Invoice", name: "unpaid"}, actor),
    do: Billing.count_unpaid_invoices(actor)
end
