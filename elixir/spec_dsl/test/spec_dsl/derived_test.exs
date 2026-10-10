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
    assert [%SpecDSL.Predicate{entity: "Task", name: "overdue", line: 3}, _live] =
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
end
