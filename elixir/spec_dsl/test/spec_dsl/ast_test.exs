defmodule SpecDSL.ASTTest do
  use ExUnit.Case, async: true

  alias SpecDSL.{AST, Control, Entity, Field, Invariant, Scenario, Step, Surface}

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
            "fields" => [
              %{"name" => "number", "type" => "text", "required" => true},
              %{
                "name" => "status",
                "type" => "enum",
                "values" => ["draft", "sent"]
              },
              %{"name" => "total", "type" => "money"},
              %{"name" => "notes"}
            ],
            "relations" => [
              %{"kind" => "belongs-to", "entity" => "Customer", "name" => "owner"},
              %{"kind" => "has-many", "entity" => "LineItem", "name" => "line_item"}
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
               fields: [
                 %Field{name: "number", type: :text, required: true},
                 %Field{name: "status", type: :enum, values: ["draft", "sent"]},
                 %Field{name: "total", type: :money},
                 %Field{name: "notes"}
               ],
               relations: [
                 %{kind: :belongs_to, entity: "Customer", name: "owner"},
                 %{kind: :has_many, entity: "LineItem", name: "line_item"}
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

  test "lists the names of an entity's fields" do
    ast =
      AST.from_map(%{
        "model" => %{
          "Invoice" => %{"fields" => [%{"name" => "number", "type" => "text"}, "status"]}
        }
      })

    assert Entity.field_names(ast.model["Invoice"]) == ["number", "status"]
  end

  test "rejects an unknown field type" do
    assert_raise ArgumentError, ~r/unknown field type "huge"/, fn ->
      AST.from_map(%{
        "model" => %{"Invoice" => %{"fields" => [%{"name" => "size", "type" => "huge"}]}}
      })
    end
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

  test "reads no effects when the AST has none" do
    assert AST.from_map(%{}).effects == []
  end

  test "reads an effect with snake_case atoms and verbatim value templates" do
    ast =
      AST.from_map(%{
        "effects" => [
          %{
            "entity" => "Invoice",
            "action" => "mark paid",
            "field" => "status",
            "state" => "paid",
            "target" => "Activity",
            "owner" => "Contact",
            "relation" => "company",
            "ownerRelation" => "company",
            "targetRelation" => "contact",
            "values" => [
              %{"field" => "kind", "value" => "note"},
              %{"field" => "body", "value" => "Invoice {number} paid"}
            ],
            "file" => "specs/effects.md",
            "line" => 5
          }
        ]
      })

    assert [effect] = ast.effects

    assert %SpecDSL.Effect{
             entity: "Invoice",
             action: :mark_paid,
             field: :status,
             state: "paid",
             target: "Activity",
             owner: "Contact",
             relation: :company,
             owner_relation: :company,
             target_relation: :contact,
             values: [kind: "note", body: "Invoice {number} paid"],
             file: "specs/effects.md",
             line: 5
           } = effect
  end

  test "reads no invariants when the AST has none" do
    assert AST.from_map(%{}).invariants == []
  end

  test "reads invariants with the kind and snake_case atom names" do
    ast =
      AST.from_map(%{
        "invariants" => [
          %{
            "kind" => "product",
            "entity" => "LineItem",
            "field" => "total",
            "left" => "quantity",
            "right" => "unit price",
            "file" => "specs/invariants.md",
            "line" => 5
          },
          %{
            "kind" => "sum",
            "entity" => "Invoice",
            "field" => "total",
            "relation" => "line_item",
            "target" => "LineItem",
            "targetField" => "total"
          },
          %{
            "kind" => "frozen-except",
            "entity" => "Invoice",
            "field" => "status",
            "actions" => ["send", "mark paid"]
          },
          %{
            "kind" => "same-parent",
            "entity" => "Deal",
            "target" => "Company",
            "relation" => "contact",
            "parent" => "company",
            "relationEntity" => "Contact",
            "relationParent" => "company"
          },
          %{
            "kind" => "sequence",
            "entity" => "Invoice",
            "field" => "number",
            "prefix" => "INV-",
            "width" => 3
          }
        ]
      })

    assert [product, sum, frozen, same_parent, sequence] = ast.invariants

    assert product == %Invariant{
             kind: :product,
             entity: "LineItem",
             field: :total,
             left: :quantity,
             right: :unit_price,
             file: "specs/invariants.md",
             line: 5
           }

    assert {sum.kind, sum.relation, sum.target, sum.target_field} ==
             {:sum, :line_item, "LineItem", :total}

    assert {frozen.kind, frozen.actions} == {:frozen_except, [:send, :mark_paid]}

    assert {same_parent.kind, same_parent.relation, same_parent.parent,
            same_parent.relation_entity, same_parent.relation_parent} ==
             {:same_parent, :contact, :company, "Contact", :company}

    assert {sequence.kind, sequence.prefix, sequence.width} == {:sequence, "INV-", 3}
  end

  test "rejects an unknown invariant kind" do
    assert_raise ArgumentError, ~r/unknown invariant kind "magic"/, fn ->
      AST.from_map(%{"invariants" => [%{"kind" => "magic", "entity" => "Invoice"}]})
    end
  end
end
