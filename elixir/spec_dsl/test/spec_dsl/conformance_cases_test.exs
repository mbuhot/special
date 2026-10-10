defmodule SpecDSL.ConformanceCasesTest.Generated do
  defmodule Model do
    use SpecDSL.ModelCase,
      ast: "test/fixtures/conformance/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule Policy do
    use SpecDSL.PolicyCase,
      ast: "test/fixtures/conformance/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule Invariant do
    use SpecDSL.InvariantCase,
      ast: "test/fixtures/conformance/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end

  defmodule Derived do
    use SpecDSL.DerivedCase,
      ast: "test/fixtures/conformance/*.ast.json",
      adapter: SpecDSL.Test.FakeAdapter,
      register: false
  end
end

defmodule SpecDSL.ConformanceCasesTest do
  use ExUnit.Case, async: true

  alias SpecDSL.ConformanceCasesTest.Generated
  alias SpecDSL.Test.FakeAdapter

  defp world(overrides \\ %{}) do
    Map.merge(
      %{
        resources: %{"Widget" => :widget},
        fields: [
          %{name: :title, type: :string, allow_nil?: false, one_of: []},
          %{name: :status, type: :atom, allow_nil?: true, one_of: [:open, :done]},
          %{name: :due_date, type: :date, allow_nil?: true, one_of: []},
          %{name: :quantity, type: :integer, allow_nil?: true, one_of: []},
          %{name: :unit_price, type: :decimal, allow_nil?: true, one_of: []},
          %{name: :total, type: :decimal, allow_nil?: true, one_of: []},
          %{name: :sku, type: :string, allow_nil?: true, one_of: []}
        ],
        relationships: [],
        state_machine: %{field: :status, states: [:open, :done], transitions: [{:open, :done}]},
        actions: [:create, :archive],
        update_actions: [],
        rejects_duplicates: true,
        reload: &product_total/1,
        can?: &permitted?/3,
        app_count: &stale_count/4
      },
      overrides
    )
  end

  defp product_total(%{"quantity" => quantity, "unit_price" => unit_price} = attrs) do
    total = quantity |> Decimal.new() |> Decimal.mult(unit_price)
    Map.put(attrs, "total", Decimal.to_string(total))
  end

  defp product_total(attrs), do: attrs

  defp permitted?("Widget", "create", _role), do: true
  defp permitted?("Widget", "archive", role), do: role == "admin"

  defp stale_count("Widget", "stale", today, records) do
    Enum.count(records, fn record ->
      record["status"] == "open" and
        Date.compare(Date.from_iso8601!(record["due_date"]), today) == :lt
    end)
  end

  defp stale_count(_entity, _predicate, _today, _records), do: 0

  defp run_all(case_module) do
    for %{name: name} <- case_module.__ex_unit__().tests do
      apply(case_module, name, [%{}])
    end
  end

  defp failure_message(case_module, test_name) do
    error =
      assert_raise ExUnit.AssertionError, fn ->
        apply(case_module, :"test #{test_name}", [%{}])
      end

    error.message
  end

  test "an app matching the spec's model passes every model test" do
    FakeAdapter.install(world())

    assert length(run_all(Generated.Model)) == 6
  end

  test "a model test names the entity and field the app does not expose" do
    FakeAdapter.install(world(%{fields: Enum.reject(world().fields, &(&1.name == :title))}))

    message =
      failure_message(
        Generated.Model,
        "Widget: every field is a public attribute, calculation or aggregate"
      )

    assert message =~ "Widget: fields [:title] are not public attributes"
  end

  test "an app matching the spec's policies passes every policy test" do
    FakeAdapter.install(world())

    assert length(run_all(Generated.Policy)) == 3
  end

  test "a policy test names the entity, role and actions the app allows beyond the spec" do
    FakeAdapter.install(world(%{can?: fn _entity, _action, _role -> true end}))

    message =
      failure_message(
        Generated.Policy,
        "Widget: sales may exactly the actions the spec lists"
      )

    assert message =~ "Widget: sales is allowed [\"archive\", \"create\"] by the app"
    assert message =~ "the spec lists [\"create\"]"
  end

  test "an app computing the declared invariants passes every invariant test" do
    FakeAdapter.install(world())

    assert length(run_all(Generated.Invariant)) == 2
  end

  test "an invariant test names the entity and field the app computes wrongly" do
    wrong_total = fn attrs -> Map.put(attrs, "total", "-1") end
    FakeAdapter.install(world(%{reload: wrong_total}))

    message =
      failure_message(Generated.Invariant, "Widget.total equals quantity times unit price")

    assert message =~ "Widget.total is \"-1\""
  end

  test "an app counting exactly the records the predicates select passes every derived test" do
    FakeAdapter.install(world())

    assert length(run_all(Generated.Derived)) == 2
  end

  test "a derived test names the entity and predicate the app counts wrongly" do
    FakeAdapter.install(world(%{app_count: fn _entity, _predicate, _today, _records -> 0 end}))

    message =
      failure_message(
        Generated.Derived,
        "Widget is stale exactly when the app counts the record"
      )

    assert message =~ "Widget"
    assert message =~ "stale"
  end
end
