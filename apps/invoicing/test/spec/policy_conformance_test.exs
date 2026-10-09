defmodule Invoicing.PolicyConformanceTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.SpecSupport.Factory

  @ast "../../specs/**/*.ast.json"
       |> Path.expand()
       |> Path.wildcard()
       |> Enum.sort()
       |> hd()
       |> SpecDSL.AST.load!()

  @policies @ast.policies

  @roles (Enum.flat_map(@policies, fn {_entity_name, role_actions} -> Map.keys(role_actions) end) ++
            Enum.flat_map(@ast.actors, fn {_actor_name, actor} -> List.wrap(actor[:role]) end))
         |> Enum.uniq()
         |> Enum.sort()

  for {entity_name, role_actions} <- @policies, role <- @roles do
    test "#{entity_name}: #{role} may exactly the actions the spec lists" do
      entity_name = unquote(entity_name)
      role = unquote(role)
      spec_actions = spec_actions_for_role(unquote(Macro.escape(role_actions)), role)
      user = Factory.create("User", %{"role" => role})

      ash_actions =
        unquote(Macro.escape(role_actions))
        |> spec_action_union()
        |> Enum.filter(&ash_allows?(entity_name, &1, user))
        |> Enum.sort()

      assert ash_actions == spec_actions,
             "#{entity_name}: #{role} is allowed #{inspect(ash_actions)} by Ash, " <>
               "the spec lists #{inspect(spec_actions)}"
    end
  end

  test "every Ash action with a policy is in the spec" do
    for {entity_name, role_actions} <- @policies do
      spec_actions = role_actions |> spec_action_union() |> Enum.map(&action_atom/1)
      ash_actions = entity_name |> Factory.resource_for!() |> public_action_names()
      unlisted_actions = ash_actions -- spec_actions

      assert unlisted_actions == [],
             "#{entity_name}: Ash actions #{inspect(unlisted_actions)} have no policy line in the spec"
    end
  end

  defp spec_action_union(role_actions) do
    role_actions |> Map.values() |> List.flatten() |> Enum.uniq()
  end

  defp spec_actions_for_role(role_actions, role) do
    role_actions |> Map.get(role, []) |> Enum.sort()
  end

  defp ash_allows?(entity_name, "create", user) do
    Ash.can?({Factory.resource_for!(entity_name), :create}, user)
  end

  defp ash_allows?(entity_name, spec_action, user) do
    action = action_atom(spec_action)
    record = entity_name |> record_ready_for(action) |> then(&Factory.fetch(entity_name, &1.id))
    Ash.can?({record, action}, user)
  end

  defp record_ready_for(entity_name, action) do
    resource = Factory.resource_for!(entity_name)

    case source_state(resource, action) do
      nil -> Factory.create(entity_name, %{})
      state -> Factory.create(entity_name, %{"status" => Atom.to_string(state)})
    end
  end

  defp source_state(resource, action) do
    if AshStateMachine in Spark.extensions(resource) do
      resource
      |> AshStateMachine.Info.state_machine_transitions()
      |> Enum.find(&(&1.action == action))
      |> transition_source()
    end
  end

  defp transition_source(nil), do: nil
  defp transition_source(%{from: from}), do: from |> List.wrap() |> hd()

  defp public_action_names(resource) do
    resource
    |> Ash.Resource.Info.actions()
    |> Enum.map(& &1.name)
    |> Enum.reject(&(&1 == :destroy))
    |> Enum.sort()
  end

  defp action_atom(spec_spelling),
    do: spec_spelling |> String.replace(" ", "_") |> String.to_atom()
end
