defmodule SpecDSL.Formula do
  @moduledoc "Evaluates the product, sum and formula invariants over plain field maps in dependency order, rounding money results half-up to the cent."

  alias SpecDSL.{AST, Derived, Entity, Invariant}

  @today ~D[2026-01-15]

  @doc "The product, sum and formula invariants ordered so each follows those computing the fields it reads."
  @spec order([Invariant.t()]) :: [Invariant.t()]
  def order(invariants) do
    computed = Enum.filter(invariants, &(&1.kind in [:product, :sum, :formula]))

    {ordered, _visited} =
      Enum.reduce(computed, {[], MapSet.new()}, &visit(&1, computed, &2))

    Enum.reverse(ordered)
  end

  defp visit(invariant, computed, {ordered, visited} = state) do
    if MapSet.member?(visited, invariant) do
      state
    else
      visited = MapSet.put(visited, invariant)

      {ordered, visited} =
        invariant
        |> inputs()
        |> Enum.flat_map(fn input -> Enum.filter(computed, &(output(&1) == input)) end)
        |> Enum.reduce({ordered, visited}, &visit(&1, computed, &2))

      {[invariant | ordered], visited}
    end
  end

  defp output(%Invariant{entity: entity, field: field}), do: {entity, field}

  defp inputs(%Invariant{kind: :product, entity: entity, left: left, right: right}),
    do: [{entity, left}, {entity, right}]

  defp inputs(%Invariant{kind: :sum, target: target, target_field: field}), do: [{target, field}]

  defp inputs(%Invariant{kind: :formula, entity: entity, expression: expression} = invariant) do
    own =
      Enum.map(
        expression_fields(expression) ++ condition_fields(invariant.condition),
        &{entity, &1}
      )

    children =
      expression
      |> sums()
      |> Enum.flat_map(fn sum ->
        [{sum.target, sum.field} | Enum.map(condition_fields(sum.where), &{sum.target, &1})]
      end)

    own ++ children
  end

  defp expression_fields(%{op: :number}), do: []
  defp expression_fields(%{op: :sum}), do: []
  defp expression_fields(%{op: :field, field: field}), do: [field]

  defp expression_fields(%{left: left, right: right}),
    do: expression_fields(left) ++ expression_fields(right)

  defp sums(%{op: :sum} = sum), do: [sum]
  defp sums(%{left: left, right: right}), do: sums(left) ++ sums(right)
  defp sums(_leaf), do: []

  defp condition_fields(nil), do: []
  defp condition_fields(condition), do: Derived.fields(condition)

  @doc "The fields of `entity` the generated inputs must supply, and per child entity the fields of its records, so that `field` can be computed."
  @spec leaves([Invariant.t()], String.t(), atom()) :: %{
          own: [atom()],
          children: %{String.t() => [atom()]}
        }
  def leaves(invariants, entity, field) do
    {own, children} = collect(invariants, entity, field)

    %{
      own: own |> Enum.uniq() |> Enum.sort(),
      children:
        Map.new(children, fn {target, fields} ->
          {target, fields |> Enum.uniq() |> Enum.sort()}
        end)
    }
  end

  defp collect(invariants, entity, field) do
    case Enum.filter(
           invariants,
           &(&1.kind in [:product, :sum, :formula] and output(&1) == {entity, field})
         ) do
      [] ->
        {[field], %{}}

      definitions ->
        definitions
        |> Enum.map(&collect_definition(invariants, &1))
        |> Enum.reduce({[], %{}}, &merge/2)
    end
  end

  defp collect_definition(invariants, %Invariant{kind: :sum, target: target, target_field: field}) do
    {own, _grandchildren} = collect(invariants, target, field)
    {[], %{target => own}}
  end

  defp collect_definition(invariants, %Invariant{entity: entity} = invariant) do
    own =
      invariant
      |> inputs()
      |> Enum.filter(fn {input_entity, _field} -> input_entity == entity end)
      |> Enum.map(&collect_input(invariants, &1))

    children =
      invariant
      |> child_inputs()
      |> Enum.map(fn {target, fields} ->
        {[], %{target => fields |> Enum.flat_map(&elem(collect(invariants, target, &1), 0))}}
      end)

    Enum.reduce(own ++ children, {[], %{}}, &merge/2)
  end

  defp child_inputs(%Invariant{kind: :product}), do: []

  defp child_inputs(%Invariant{expression: expression}) do
    expression
    |> sums()
    |> Enum.map(fn sum -> {sum.target, [sum.field | condition_fields(sum.where)]} end)
  end

  defp collect_input(invariants, {entity, field}), do: collect(invariants, entity, field)

  defp merge({own_left, children_left}, {own_right, children_right}),
    do:
      {own_left ++ own_right,
       Map.merge(children_left, children_right, fn _target, left, right -> left ++ right end)}

  @doc "The record with every computed field of `entity` filled in from its own fields and its `children` (records by child entity name), children computed first."
  @spec compute([Invariant.t()], %{String.t() => Entity.t()}, String.t(), map(), %{
          String.t() => [map()]
        }) :: map()
  def compute(invariants, model, entity, record, children \\ %{}) do
    computed_children =
      Map.new(children, fn {target, records} ->
        {target, Enum.map(records, &compute(invariants, model, target, &1, %{}))}
      end)

    invariants
    |> order()
    |> Enum.filter(&(&1.entity == entity))
    |> Enum.reduce(record, &apply_invariant(&1, &2, model, computed_children))
  end

  defp apply_invariant(%Invariant{kind: :formula} = invariant, record, model, children) do
    if is_nil(invariant.condition) or Derived.holds?(invariant.condition, record, @today) do
      put_result(record, model, invariant, evaluate(invariant.expression, record, children))
    else
      record
    end
  end

  defp apply_invariant(
         %Invariant{kind: :product, left: left, right: right} = invariant,
         record,
         model,
         _children
       ) do
    result = {:ok, Decimal.mult(number(record, left), number(record, right))}
    put_result(record, model, invariant, result)
  end

  defp apply_invariant(%Invariant{kind: :sum} = invariant, record, model, children) do
    total =
      children
      |> Map.get(invariant.target, [])
      |> Enum.reduce(Decimal.new(0), &Decimal.add(number(&1, invariant.target_field), &2))

    put_result(record, model, invariant, {:ok, total})
  end

  defp put_result(record, _model, _invariant, :error), do: record

  defp put_result(record, model, %Invariant{entity: entity, field: field}, {:ok, value}),
    do: Map.put(record, field, round_for(model, entity, field, value))

  defp round_for(model, entity, field, value) do
    case field_type(model, entity, field) do
      :money -> Decimal.round(value, 2, :half_up)
      :integer -> Decimal.round(value, 0, :half_up)
      _unrounded -> value
    end
  end

  defp field_type(model, entity, field) do
    case Map.fetch(model, entity) do
      {:ok, %Entity{fields: fields}} ->
        fields |> Enum.find(&(AST.snake_atom(&1.name) == field)) |> then(&(&1 && &1.type))

      :error ->
        nil
    end
  end

  defp evaluate(%{op: :number, value: value}, _record, _children), do: {:ok, decimal(value)}
  defp evaluate(%{op: :field, field: field}, record, _children), do: {:ok, number(record, field)}

  defp evaluate(%{op: :sum} = sum, _record, children) do
    total =
      children
      |> Map.get(sum.target, [])
      |> Enum.filter(&(is_nil(sum.where) or Derived.holds?(sum.where, &1, @today)))
      |> Enum.reduce(Decimal.new(0), &Decimal.add(number(&1, sum.field), &2))

    {:ok, total}
  end

  defp evaluate(%{op: op, left: left, right: right}, record, children) do
    with {:ok, left_value} <- evaluate(left, record, children),
         {:ok, right_value} <- evaluate(right, record, children) do
      arithmetic(op, left_value, right_value)
    end
  end

  defp arithmetic(:add, left, right), do: {:ok, Decimal.add(left, right)}
  defp arithmetic(:sub, left, right), do: {:ok, Decimal.sub(left, right)}
  defp arithmetic(:mul, left, right), do: {:ok, Decimal.mult(left, right)}

  defp arithmetic(:div, left, right) do
    if Decimal.equal?(right, 0), do: :error, else: {:ok, Decimal.div(left, right)}
  end

  defp number(record, field) do
    case Map.get(record, field) do
      nil -> Decimal.new(0)
      value -> decimal(value)
    end
  end

  defp decimal(%Decimal{} = value), do: value
  defp decimal(value) when is_integer(value), do: Decimal.new(value)
  defp decimal(value) when is_float(value), do: Decimal.from_float(value)
  defp decimal(value) when is_binary(value), do: Decimal.new(value)
end
