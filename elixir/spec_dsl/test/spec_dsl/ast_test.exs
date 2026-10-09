defmodule SpecDSL.ASTTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Control, Entity, Scenario, Step, Surface}

  setup_all do
    {:ok, ast: AST.load!("test/fixtures/invoicing.ast.json")}
  end

  test "reads dialect, contexts and actors with snake_case atom keys", %{ast: ast} do
    assert ast.dialect == %{
             name: "invoicing",
             version: "1",
             step_ids: ["given-entity", "opens", "enters", "sees"]
           }

    assert ast.contexts == %{clock: %{date_time: "2026-01-15T09:00:00Z"}}
    assert ast.actors == %{"Accounts" => %{role: "accountant", extra: %{}}}
  end

  test "reads each scenario with its Markdown source position", %{ast: ast} do
    assert Enum.map(ast.scenarios, &{&1.name, &1.source}) == [
             {"Line total updates as quantity changes", %{file: "specs/invoicing.md", line: 20}},
             {"Invoice list shows the new invoice button",
              %{file: "specs/invoicing.md", line: 30}}
           ]
  end

  test "reads a scenario's story, or nil when it has none" do
    ast =
      AST.from_map(%{
        "scenarios" => [
          %{"name" => "With story", "story" => "As accounts, I need X, so that Y."},
          %{"name" => "Without story"}
        ]
      })

    assert Enum.map(ast.scenarios, & &1.story) == ["As accounts, I need X, so that Y.", nil]
  end

  test "resolves surface and control arguments to structs with atom kinds", %{ast: ast} do
    %Scenario{steps: [_given, opens, enters, sees, _narrate]} = hd(ast.scenarios)

    assert %Step{id: "opens", line: 23, args: %{actor: "Accounts", ref: "INV-001"}} = opens

    assert opens.args.surface == %Surface{
             name: "Invoice editor",
             route: "/invoices/{id}/edit",
             controls: ast.surfaces["Invoice editor"].controls
           }

    assert enters.args.control == %Control{
             name: "Quantity",
             kind: :field,
             locators: %{
               css: "#line-0-quantity",
               lv: "invoice[lines][0][quantity]",
               form: "#invoice-form"
             }
           }

    assert sees.args.control == %Control{
             name: "Totals",
             kind: :region,
             locators: %{testid: "totals", role: "status"}
           }
  end

  test "reads the form locator of a field control alongside css and lv", %{ast: ast} do
    quantity = ast.surfaces["Invoice editor"].controls["Quantity"]

    assert quantity.locators == %{
             css: "#line-0-quantity",
             lv: "invoice[lines][0][quantity]",
             form: "#invoice-form"
           }
  end

  test "reads narration text and step modes", %{ast: ast} do
    %Scenario{steps: [given, _opens, _enters, _sees, narrate]} = hd(ast.scenarios)

    assert given.modes == nil

    assert narrate == %Step{
             id: "narrate",
             line: 26,
             text: "The line total updates as the quantity changes.",
             modes: [:demo]
           }
  end

  test "keeps non-reference arguments as given", %{ast: ast} do
    %Scenario{steps: [given | _]} = hd(ast.scenarios)

    assert given.args == %{entity: "Customer", ref: "Acme", pairs: []}
  end

  test "reads each Model entity with its relations and state machines" do
    ast =
      AST.from_map(%{
        "model" => %{
          "Invoice" => %{
            "fields" => ["number", "status", "total"],
            "relations" => [
              %{"kind" => "belongs-to", "entity" => "Customer"},
              %{"kind" => "has-many", "entity" => "LineItem"}
            ],
            "machines" => %{
              "status" => %{
                "states" => ["draft", "sent"],
                "transitions" => [%{"from" => "draft", "to" => "sent"}]
              }
            }
          }
        }
      })

    assert ast.model == %{
             "Invoice" => %Entity{
               fields: ["number", "status", "total"],
               relations: [
                 %{kind: :belongs_to, entity: "Customer"},
                 %{kind: :has_many, entity: "LineItem"}
               ],
               machines: %{
                 "status" => %{
                   states: ["draft", "sent"],
                   transitions: [%{from: "draft", to: "sent"}]
                 }
               }
             }
           }
  end

  test "reads the actions each role may perform per entity" do
    ast = AST.from_map(%{"policies" => %{"Invoice" => %{"admin" => ["read", "mark paid"]}}})

    assert ast.policies == %{"Invoice" => %{"admin" => ["read", "mark paid"]}}
  end

  test "marks a shared surface as present on every page" do
    ast =
      AST.from_map(%{
        "surfaces" => %{
          "Sidebar" => %{"shared" => true, "controls" => %{}},
          "Invoice list" => %{"route" => "/invoices", "controls" => %{}}
        }
      })

    assert {ast.surfaces["Sidebar"].shared, ast.surfaces["Invoice list"].shared} == {true, false}
  end

  test "reads no policies when the AST has none" do
    assert AST.from_map(%{}).policies == %{}
  end
end
