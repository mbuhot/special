defmodule SpecDSL.PolicyCase do
  @moduledoc "Defines tests holding an app's authorization to the role-by-action matrix and read scopes the spec's Policies declare."

  import ExUnit.Assertions

  alias SpecDSL.{Adapter, CaseOptions, Derived, Union}

  @today ~D[2026-01-15]

  @doc "Defines the policy conformance tests for the ASTs of the `:ast` glob, checked through the `:adapter` module."
  defmacro __using__(opts) do
    config = CaseOptions.read(opts, __CALLER__)
    adapter = config.adapter
    policies = Union.policies(config.asts)
    roles = Union.roles(config.asts)
    predicates = Union.predicates(config.asts)

    role_tests =
      for {entity_name, role_actions} <- policies, role <- roles do
        quote do
          test unquote("#{entity_name}: #{role} may exactly the actions the spec lists") do
            SpecDSL.PolicyCase.check_role(
              unquote(adapter),
              unquote(entity_name),
              unquote(role),
              unquote(Macro.escape(role_actions))
            )
          end
        end
      end

    scope_tests =
      for {entity_name, role_scopes} <- Union.scopes(config.asts),
          {role, predicate_name} <- role_scopes do
        {predicate, _fields} =
          Enum.find(predicates, fn {candidate, _fields} ->
            candidate.entity == entity_name and candidate.name == predicate_name
          end)

        quote do
          test unquote(
                 "#{entity_name}: #{role} reads only the records that are #{predicate_name}"
               ) do
            SpecDSL.PolicyCase.check_read_scope(
              unquote(adapter),
              unquote(entity_name),
              unquote(role),
              unquote(Macro.escape(predicate))
            )
          end
        end
      end

    quote do
      unquote(CaseOptions.preamble(config, true))
      unquote_splicing(role_tests)
      unquote_splicing(scope_tests)

      test "every Ash action with a policy is in the spec" do
        SpecDSL.PolicyCase.check_actions_listed(unquote(adapter), unquote(Macro.escape(policies)))
      end
    end
  end

  @doc false
  def check_role(adapter, entity_name, role, role_actions) do
    spec_actions = role_actions |> Map.get(role, []) |> Enum.sort()

    app_actions =
      role_actions
      |> spec_action_union()
      |> Enum.filter(&adapter.can?(entity_name, &1, role))
      |> Enum.sort()

    assert app_actions == spec_actions,
           "#{entity_name}: #{role} is allowed #{inspect(app_actions)} by the app, " <>
             "the spec lists #{inspect(spec_actions)}"
  end

  @doc false
  def check_read_scope(adapter, entity_name, role, predicate) do
    Code.ensure_loaded(adapter)

    if function_exported?(adapter, :read_as, 3) do
      read_scoped_records(adapter, entity_name, role, predicate)
    else
      IO.puts(
        "skipped: #{inspect(adapter)} does not export read_as/3, so #{entity_name}: #{role} " <>
          "reading only #{predicate.name} is not checked"
      )
    end
  end

  defp read_scoped_records(adapter, entity_name, role, predicate) do
    actor = adapter.create("User", %{"role" => role})
    other = adapter.create("User", %{"role" => role})
    seeded? = seed_viewer_relation(adapter, entity_name, predicate, actor, other)

    records = adapter.read_as(entity_name, role, actor)

    assert Enum.all?(records, &Derived.holds?(predicate, atomized(&1), @today, actor.id)),
           "#{entity_name}: #{role} reads records that are not #{predicate.name}: #{inspect(records)}"

    assert not seeded? or records != [],
           "#{entity_name}: #{role} reads no record that is #{predicate.name}"
  end

  defp seed_viewer_relation(
         adapter,
         entity_name,
         %{condition: %{op: :is_me, field: field}},
         actor,
         other
       ) do
    key = "#{field}_id"
    adapter.create(entity_name, %{key => actor.id})
    adapter.create(entity_name, %{key => other.id})
    true
  end

  defp seed_viewer_relation(_adapter, _entity_name, _predicate, _actor, _other), do: false

  defp atomized(record) do
    Enum.reduce(record, %{}, fn {key, value}, atomized ->
      name = String.to_atom(key)
      atomized = Map.put(atomized, name, value)

      if String.ends_with?(key, "_id"),
        do: Map.put(atomized, key |> String.replace_suffix("_id", "") |> String.to_atom(), value),
        else: atomized
    end)
  end

  @doc false
  def check_actions_listed(adapter, policies) do
    for {entity_name, role_actions} <- policies do
      spec_actions = role_actions |> spec_action_union() |> Enum.map(&action_atom/1)

      app_actions =
        entity_name |> then(&Adapter.resource!(adapter, &1)) |> adapter.actions() |> Enum.sort()

      unlisted_actions = app_actions -- spec_actions

      assert unlisted_actions == [],
             "#{entity_name}: actions #{inspect(unlisted_actions)} have no policy line in the spec"
    end
  end

  defp spec_action_union(role_actions) do
    role_actions |> Map.values() |> List.flatten() |> Enum.uniq()
  end

  defp action_atom(spec_spelling),
    do: spec_spelling |> String.replace(" ", "_") |> String.to_atom()
end
