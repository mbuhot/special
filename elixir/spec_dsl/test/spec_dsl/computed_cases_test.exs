defmodule SpecDSL.ComputedCasesTest.ScopedAdapter do
  @moduledoc "The fake adapter extended with a scoped read."

  alias SpecDSL.Test.FakeAdapter

  defdelegate resource_for(entity_name), to: FakeAdapter
  defdelegate fields(resource), to: FakeAdapter
  defdelegate relationships(resource), to: FakeAdapter
  defdelegate state_machine(resource), to: FakeAdapter
  defdelegate actions(resource), to: FakeAdapter
  defdelegate update_actions(resource), to: FakeAdapter
  defdelegate create(entity_name, attrs), to: FakeAdapter
  defdelegate try_create(entity_name, attrs), to: FakeAdapter
  defdelegate reload(entity_name, record), to: FakeAdapter
  defdelegate attempt_update(entity_name, record, action, field), to: FakeAdapter
  defdelegate can?(entity_name, action, role), to: FakeAdapter
  defdelegate app_count(entity_name, predicate_name, today), to: FakeAdapter

  def read_as(_entity_name, _role, actor_user),
    do: Process.get(:read_as).(actor_user, FakeAdapter.records())
end

defmodule SpecDSL.ComputedCasesTest.Generated do
  @glob "test/fixtures/computed/*.ast.json"

  defmodule Invariant do
    use SpecDSL.InvariantCase,
      ast: "test/fixtures/computed/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule Derived do
    use SpecDSL.DerivedCase,
      ast: "test/fixtures/computed/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule Policy do
    use SpecDSL.PolicyCase,
      ast: "test/fixtures/computed/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule ScopedPolicy do
    use SpecDSL.PolicyCase,
      ast: "test/fixtures/computed/*.ast.json",
      adapter: SpecDSL.ComputedCasesTest.ScopedAdapter,
      register: false
  end

  def glob, do: @glob
end

defmodule SpecDSL.ComputedCasesTest do
  use ExUnit.Case, async: true

  import ExUnit.CaptureIO

  alias SpecDSL.ComputedCasesTest.Generated
  alias SpecDSL.Test.FakeAdapter

  defp world(overrides \\ %{}) do
    Map.merge(
      %{
        resources: %{"Invoice" => :invoice, "LineItem" => :line_item, "Task" => :task},
        fields: [
          %{name: :gst_rate, type: :decimal, allow_nil?: true, one_of: []},
          %{name: :prices, type: :atom, allow_nil?: true, one_of: [:exclude_gst, :include_gst]},
          %{name: :quantity, type: :integer, allow_nil?: true, one_of: []},
          %{name: :unit_price, type: :decimal, allow_nil?: true, one_of: []},
          %{name: :tax_code, type: :atom, allow_nil?: true, one_of: [:gst, :gst_free, :exempt]},
          %{name: :gst, type: :decimal, allow_nil?: true, one_of: []}
        ],
        relationships: [
          %{
            name: :line_items,
            kind: :has_many,
            destination: :line_item,
            destination_attribute: :invoice_id
          }
        ],
        state_machine: nil,
        actions: [:read],
        update_actions: [],
        rejects_duplicates: false,
        reload_record: &reload_record/4,
        can?: fn _entity, "read", _role -> true end,
        app_count: fn _entity, _predicate, _today, records ->
          Enum.count(records, &(Decimal.compare(Map.get(&1, "gst", Decimal.new(0)), 0) == :gt))
        end
      },
      overrides
    )
  end

  defp reload_record("Invoice", id, attrs, records) do
    lines = Enum.filter(records, &(&1["invoice_id"] == id))
    taxable = sum_lines(Enum.filter(lines, &(&1["tax_code"] == "gst")))
    lines_total = sum_lines(lines)
    charges = invoice_charges(attrs, taxable, lines_total)

    attrs
    |> Map.put("taxable", taxable)
    |> Map.merge(charges)
    |> Map.put("total", Decimal.add(Map.get(charges, "subtotal", 0), Map.get(charges, "gst", 0)))
  end

  defp reload_record(_entity, _id, attrs, _records) do
    Map.put(attrs, "total", Decimal.mult(attrs["quantity"], attrs["unit_price"]))
  end

  defp invoice_charges(%{"prices" => prices, "gst_rate" => rate}, taxable, lines_total) do
    rate = Decimal.new(to_string(rate))

    if prices == "include_gst" do
      gst = taxable |> Decimal.mult(rate) |> Decimal.div(Decimal.add(100, rate)) |> cents()
      %{"gst" => gst, "subtotal" => Decimal.sub(lines_total, gst)}
    else
      gst = taxable |> Decimal.mult(rate) |> Decimal.div(100) |> cents()
      %{"gst" => gst, "subtotal" => lines_total}
    end
  end

  defp invoice_charges(_attrs, _taxable, _lines_total), do: %{}

  defp cents(amount), do: Decimal.round(amount, 2, :half_up)

  defp sum_lines(lines) do
    Enum.reduce(lines, Decimal.new(0), fn line, total ->
      Decimal.add(total, Decimal.mult(line["quantity"], line["unit_price"]))
    end)
  end

  defp run_all(case_module) do
    for %{name: name} <- case_module.__ex_unit__().tests do
      apply(case_module, name, [%{}])
    end
  end

  test "an app computing GST, subtotal and total as the formulas say passes every invariant test" do
    FakeAdapter.install(world())

    assert length(run_all(Generated.Invariant)) == 5
  end

  test "a formula test names the entity and field the app computes wrongly" do
    overcharging = fn entity, id, attrs, records ->
      computed = reload_record(entity, id, attrs, records)

      case computed do
        %{"gst" => gst} -> Map.put(computed, "gst", Decimal.add(gst, "0.01"))
        other -> other
      end
    end

    FakeAdapter.install(world(%{reload_record: overcharging}))

    error =
      assert_raise ExUnit.AssertionError, fn ->
        apply(Generated.Invariant, :"test Invoice.gst equals the value its formula computes", [
          %{}
        ])
      end

    assert error.message =~ "Invoice.gst is"
  end

  test "a comparison above a number is checked and a viewer-relative predicate is not generated" do
    FakeAdapter.install(world())

    names = Enum.map(Generated.Derived.__ex_unit__().tests, &Atom.to_string(&1.name))

    assert length(run_all(Generated.Derived)) == 2
    assert Enum.any?(names, &(&1 =~ "Invoice is tax invoice"))
    refute Enum.any?(names, &(&1 =~ "mine"))
  end

  test "a scope check is skipped with a message when the adapter has no scoped read" do
    FakeAdapter.install(world())

    output =
      capture_io(fn ->
        apply(Generated.Policy, :"test Task: sales reads only the records that are mine", [%{}])
      end)

    assert output =~ "does not export read_as/3"
  end

  test "an app reading only the actor's records passes the scope check" do
    FakeAdapter.install(world())

    Process.put(:read_as, fn actor, records ->
      Enum.filter(records, &(Map.has_key?(&1, "assignee_id") and &1["assignee_id"] == actor.id))
    end)

    assert [:ok] = [
             apply(
               Generated.ScopedPolicy,
               :"test Task: sales reads only the records that are mine",
               [%{}]
             )
           ]
  end

  test "an app reading another user's record fails the scope check" do
    FakeAdapter.install(world())

    Process.put(:read_as, fn _actor, records ->
      Enum.filter(records, &Map.has_key?(&1, "assignee_id"))
    end)

    error =
      assert_raise ExUnit.AssertionError, fn ->
        apply(Generated.ScopedPolicy, :"test Task: sales reads only the records that are mine", [
          %{}
        ])
      end

    assert error.message =~ "Task: sales reads records that are not mine"
  end
end
