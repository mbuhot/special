defmodule SpecDSL.DerivedCase do
  @moduledoc "Defines tests holding an app's counts to the named predicates and counts the spec's Derived section declares."

  import ExUnit.Assertions
  import StreamData
  use ExUnitProperties

  alias SpecDSL.{AST, CaseOptions, Derived, Union}

  @max_runs 15
  @today ~D[2026-01-15]

  @doc "The fixed date every predicate is evaluated on."
  @spec today() :: Date.t()
  def today, do: @today

  @doc "Defines the derived conformance tests for the ASTs of the `:ast` glob, checked through the `:adapter` module."
  defmacro __using__(opts) do
    config = CaseOptions.read(opts, __CALLER__)
    adapter = config.adapter
    predicates = Union.predicates(config.asts)

    predicate_tests =
      for {predicate, model_fields} <- predicates do
        quote do
          test unquote(
                 "#{predicate.entity} is #{predicate.name} exactly when the app counts the record"
               ) do
            SpecDSL.DerivedCase.check_predicate(
              unquote(adapter),
              unquote(Macro.escape(predicate)),
              unquote(Macro.escape(model_fields))
            )
          end
        end
      end

    count_tests =
      for count <- Union.counts(config.asts) do
        quote do
          test unquote(
                 "#{count.name} equals the number of generated #{count.entity} records that are #{count.predicate}"
               ) do
            SpecDSL.DerivedCase.check_count(
              unquote(adapter),
              unquote(Macro.escape(count)),
              @spec_dsl_predicates
            )
          end
        end
      end

    quote do
      unquote(CaseOptions.preamble(config, true))
      @spec_dsl_predicates unquote(Macro.escape(predicates))
      unquote_splicing(predicate_tests)
      unquote_splicing(count_tests)
    end
  end

  @doc false
  def check_predicate(adapter, predicate, model_fields) do
    check all(record <- record_generator(predicate, model_fields), max_runs: @max_runs) do
      before_count = adapter.app_count(predicate.entity, predicate.name, @today)
      adapter.create(predicate.entity, factory_attributes(record))
      counted = adapter.app_count(predicate.entity, predicate.name, @today) - before_count

      assert counted == if(Derived.holds?(predicate, record, @today), do: 1, else: 0),
             "#{predicate.entity} #{inspect(record)} #{predicate.name}"
    end
  end

  @doc false
  def check_count(adapter, count, predicates) do
    {predicate, model_fields} =
      Enum.find(predicates, fn {candidate, _fields} ->
        candidate.entity == count.entity and candidate.name == count.predicate
      end)

    check all(
            records <- list_of(record_generator(predicate, model_fields), max_length: 4),
            max_runs: @max_runs
          ) do
      before_count = adapter.app_count(predicate.entity, predicate.name, @today)
      Enum.each(records, &adapter.create(predicate.entity, factory_attributes(&1)))
      expected = Enum.count(records, &Derived.holds?(predicate, &1, @today))
      counted = adapter.app_count(predicate.entity, predicate.name, @today) - before_count

      assert counted == expected,
             "#{count.name}: the app counted #{counted} #{count.entity} records that are " <>
               "#{count.predicate}, the spec expects #{expected}"
    end
  end

  defp record_generator(predicate, model_fields) do
    predicate
    |> Derived.fields()
    |> Map.new(fn field -> {field, value_generator(field, model_fields)} end)
    |> fixed_map()
  end

  defp factory_attributes(record) do
    Map.new(record, fn
      {field, %Date{} = date} -> {Atom.to_string(field), Date.to_iso8601(date)}
      {field, value} -> {Atom.to_string(field), value}
    end)
  end

  defp value_generator(field, model_fields) do
    case Enum.find(model_fields, &(AST.snake_atom(&1.name) == field)) do
      %{type: :enum, values: values} -> member_of(values)
      %{type: type} when type in [:date, :datetime] -> map(integer(-3..3), &Date.add(@today, &1))
      other -> raise "no generator for #{inspect(other)} field #{field}"
    end
  end
end
