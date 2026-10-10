defmodule SpecDSL.PolicyCase do
  @moduledoc "Defines tests holding an app's authorization to the role-by-action matrix the spec's Policies declare."

  import ExUnit.Assertions

  alias SpecDSL.{Adapter, CaseOptions, Union}

  @doc "Defines the policy conformance tests for the ASTs of the `:ast` glob, checked through the `:adapter` module."
  defmacro __using__(opts) do
    config = CaseOptions.read(opts, __CALLER__)
    adapter = config.adapter
    policies = Union.policies(config.asts)
    roles = Union.roles(config.asts)

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

    quote do
      unquote(CaseOptions.preamble(config, true))
      unquote_splicing(role_tests)

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
