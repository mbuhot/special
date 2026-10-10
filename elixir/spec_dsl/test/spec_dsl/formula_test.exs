defmodule SpecDSL.FormulaTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Formula, Union}

  setup_all do
    asts = Union.asts("test/fixtures/computed/*.ast.json")
    {:ok, asts: asts, invariants: Union.invariants(asts), model: Union.model(asts)}
  end

  defp lines(codes_and_prices),
    do:
      Enum.map(codes_and_prices, fn {code, price} ->
        %{quantity: 1, unit_price: Decimal.new(price), tax_code: code}
      end)

  defp compute(invariants, model, prices, rate, items) do
    invoice = %{prices: prices, gst_rate: Decimal.new(rate)}
    Formula.compute(invariants, model, "Invoice", invoice, %{"LineItem" => lines(items)})
  end

  test "GST on prices excluding GST is added to the subtotal", %{
    invariants: invariants,
    model: model
  } do
    invoice = compute(invariants, model, :exclude_gst, "10", [{:gst, "100"}, {:gst_free, "40"}])

    assert Decimal.equal?(invoice.taxable, 100)
    assert Decimal.equal?(invoice.gst, 10)
    assert Decimal.equal?(invoice.subtotal, 140)
    assert Decimal.equal?(invoice.total, 150)
  end

  test "GST on prices including GST is contained in the lines", %{
    invariants: invariants,
    model: model
  } do
    invoice = compute(invariants, model, :include_gst, "10", [{:gst, "110"}, {:exempt, "40"}])

    assert Decimal.equal?(invoice.gst, 10)
    assert Decimal.equal?(invoice.subtotal, 140)
    assert Decimal.equal?(invoice.total, 150)
  end

  test "money results round half-up to the cent", %{invariants: invariants, model: model} do
    invoice = compute(invariants, model, :exclude_gst, "10", [{:gst, "0.05"}])

    assert Decimal.equal?(invoice.gst, "0.01")
  end

  test "a field whose conditions all fail keeps its absent value", %{
    invariants: invariants,
    model: model
  } do
    invoice = Formula.compute(invariants, model, "Invoice", %{gst_rate: Decimal.new(10)}, %{})

    refute Map.has_key?(invoice, :gst)
    assert Decimal.equal?(invoice.total, 0)
  end

  test "computed fields follow the fields they read", %{invariants: invariants} do
    order = invariants |> Formula.order() |> Enum.map(&{&1.entity, &1.field})

    assert Enum.find_index(order, &(&1 == {"Invoice", :total})) >
             Enum.find_index(order, &(&1 == {"Invoice", :gst}))

    assert Enum.find_index(order, &(&1 == {"Invoice", :gst})) >
             Enum.find_index(order, &(&1 == {"Invoice", :taxable}))

    assert Enum.find_index(order, &(&1 == {"Invoice", :taxable})) >
             Enum.find_index(order, &(&1 == {"LineItem", :total}))
  end

  test "the inputs a total needs are the rate, the price mode and the line fields", %{
    invariants: invariants
  } do
    assert %{
             own: [:gst_rate, :prices],
             children: %{"LineItem" => [:quantity, :tax_code, :unit_price]}
           } = Formula.leaves(invariants, "Invoice", :total)
  end

  test "an AST reads a formula's expression tree and condition", %{asts: [ast]} do
    gst = Enum.find(ast.invariants, &(&1.kind == :formula and &1.field == :gst))

    assert %{
             op: :div,
             left: %{
               op: :mul,
               left: %{op: :field, field: :taxable},
               right: %{op: :field, field: :gst_rate}
             },
             right: %{op: :number, value: 100}
           } = gst.expression

    assert gst.condition == %{op: :is, field: :prices, value: "exclude gst"}
  end

  test "an AST separates a role's actions from its read scope", %{asts: [ast]} do
    assert ast.policies == %{"Task" => %{"sales" => ["read"], "admin" => ["read"]}}
    assert ast.scopes == %{"Task" => %{"sales" => "mine"}}
  end

  test "an AST without scoped roles has no scopes" do
    assert AST.from_map(%{"policies" => %{"Task" => %{"admin" => ["read"]}}}).scopes == %{}
  end
end
