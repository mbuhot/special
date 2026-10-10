defmodule SpecDSL.DerivedTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Derived}

  @today ~D[2026-01-15]

  setup_all do
    ast =
      AST.from_map(%{
        "derived" => %{
          "predicates" => [
            %{
              "entity" => "Task",
              "name" => "overdue",
              "condition" => %{
                "op" => "and",
                "left" => %{"op" => "is", "field" => "status", "value" => "open"},
                "right" => %{"op" => "before", "field" => "due date", "value" => "today"}
              },
              "file" => "specs/derived.md",
              "line" => 3
            },
            %{
              "entity" => "Task",
              "name" => "soon",
              "condition" => %{"op" => "within", "field" => "due date", "days" => 7}
            },
            %{
              "entity" => "Deal",
              "name" => "live",
              "condition" => %{
                "op" => "or",
                "left" => %{"op" => "is not", "field" => "stage", "value" => "won"},
                "right" => %{"op" => "after", "field" => "close date", "value" => "2026-02-01"}
              }
            }
          ],
          "counts" => [
            %{"name" => "Overdue tasks", "entity" => "Task", "predicate" => "overdue"}
          ]
        }
      })

    {:ok, predicates: Map.new(ast.derived.predicates, &{&1.name, &1}), derived: ast.derived}
  end

  test "reads predicates and counts into structs", %{derived: derived} do
    assert [%SpecDSL.Predicate{entity: "Task", name: "overdue", line: 3}, _soon, _live] =
             derived.predicates

    assert [%SpecDSL.Count{name: "Overdue tasks", entity: "Task", predicate: "overdue"}] =
             derived.counts
  end

  test "an open task due before today is overdue", %{predicates: predicates} do
    assert Derived.holds?(
             predicates["overdue"],
             %{status: :open, due_date: ~D[2026-01-14]},
             @today
           )
  end

  test "an open task due today is not overdue", %{predicates: predicates} do
    refute Derived.holds?(predicates["overdue"], %{status: :open, due_date: @today}, @today)
  end

  test "a done task past its due date is not overdue", %{predicates: predicates} do
    refute Derived.holds?(
             predicates["overdue"],
             %{status: "done", due_date: ~D[2026-01-01]},
             @today
           )
  end

  test "is not and after comparisons combine with or", %{predicates: predicates} do
    assert Derived.holds?(predicates["live"], %{stage: :lead, close_date: nil}, @today)
    refute Derived.holds?(predicates["live"], %{stage: :won, close_date: ~D[2026-02-01]}, @today)
    assert Derived.holds?(predicates["live"], %{stage: :won, close_date: ~D[2026-02-02]}, @today)
  end

  describe "within 7 days of today" do
    test "holds today and on the last day of the window", %{predicates: predicates} do
      assert Derived.holds?(predicates["soon"], %{due_date: @today}, @today)
      assert Derived.holds?(predicates["soon"], %{due_date: Date.add(@today, 7)}, @today)
    end

    test "fails the day after the window and yesterday", %{predicates: predicates} do
      refute Derived.holds?(predicates["soon"], %{due_date: Date.add(@today, 8)}, @today)
      refute Derived.holds?(predicates["soon"], %{due_date: Date.add(@today, -1)}, @today)
    end

    test "fails when the date is missing", %{predicates: predicates} do
      refute Derived.holds?(predicates["soon"], %{due_date: nil}, @today)
    end

    test "reads the date part of a datetime", %{predicates: predicates} do
      assert Derived.holds?(
               predicates["soon"],
               %{due_date: ~U[2026-01-22 23:00:00Z]},
               @today
             )
    end

    test "reads the field it constrains", %{predicates: predicates} do
      assert Derived.fields(predicates["soon"]) == [:due_date]
    end
  end
end

defmodule SpecDSL.DerivedNumericTest do
  use ExUnit.Case, async: true

  alias SpecDSL.Derived

  @today ~D[2026-01-15]

  test "an amount above the number holds, an amount equal to it does not" do
    above = %{op: :above, field: :gst, value: 0}

    assert Derived.holds?(above, %{gst: Decimal.new("0.01")}, @today)
    refute Derived.holds?(above, %{gst: Decimal.new(0)}, @today)
    refute Derived.holds?(above, %{}, @today)
  end

  test "an amount below the number holds, whatever its type" do
    below = %{op: :below, field: :total, value: 100}

    assert Derived.holds?(below, %{total: 99}, @today)
    assert Derived.holds?(below, %{total: "99.5"}, @today)
    refute Derived.holds?(below, %{total: Decimal.new(100)}, @today)
  end

  test "a relation to the signed-in user holds only for that user" do
    mine = %{op: :is_me, field: :assignee}

    assert Derived.holds?(mine, %{assignee: 7}, @today, 7)
    refute Derived.holds?(mine, %{assignee: 7}, @today, 8)
    refute Derived.holds?(mine, %{assignee: 7}, @today)
  end

  test "a predicate reading the signed-in user is viewer-relative" do
    mine = %{
      op: :and,
      left: %{op: :is, field: :status, value: "open"},
      right: %{op: :is_me, field: :assignee}
    }

    assert Derived.viewer_relative?(mine)
    refute Derived.viewer_relative?(%{op: :above, field: :gst, value: 0})
  end

  test "an enum value with a hyphen equals its atom spelling" do
    assert Derived.holds?(
             %{op: :is, field: :tax_code, value: "gst-free"},
             %{tax_code: :gst_free},
             @today
           )
  end
end
