defmodule SpecDSL.Union do
  @moduledoc "Merges the model, policies, actors, invariants and derived declarations across the AST files a glob matches."

  alias SpecDSL.{AST, Entity}

  @doc "Loads every AST file the glob matches, in path order."
  @spec asts(String.t()) :: [AST.t()]
  def asts(glob) do
    glob |> files() |> Enum.map(&AST.load!/1)
  end

  @doc "The sorted paths the glob matches."
  @spec files(String.t()) :: [Path.t()]
  def files(glob), do: glob |> Path.expand() |> Path.wildcard() |> Enum.sort()

  @doc "Entities by name with fields, relations and machines merged across all ASTs."
  @spec model([AST.t()]) :: %{String.t() => Entity.t()}
  def model(asts) do
    asts
    |> Enum.map(& &1.model)
    |> Enum.reduce(
      %{},
      &Map.merge(&2, &1, fn _name, left, right -> merge_entity(left, right) end)
    )
  end

  @doc "Allowed actions by entity and role, merged across all ASTs."
  @spec policies([AST.t()]) :: %{String.t() => %{String.t() => [String.t()]}}
  def policies(asts) do
    Enum.reduce(asts, %{}, fn ast, merged ->
      Map.merge(merged, ast.policies, fn _entity, left, right ->
        Map.merge(left, right, fn _role, a, b -> Enum.uniq(a ++ b) end)
      end)
    end)
  end

  @doc "Every role named by a policy or an actor, sorted."
  @spec roles([AST.t()]) :: [String.t()]
  def roles(asts) do
    actors = Enum.reduce(asts, %{}, &Map.merge(&2, &1.actors))

    policy_roles =
      asts
      |> policies()
      |> Enum.flat_map(fn {_entity, role_actions} -> Map.keys(role_actions) end)

    actor_roles = Enum.flat_map(actors, fn {_name, actor} -> List.wrap(actor[:role]) end)
    (policy_roles ++ actor_roles) |> Enum.uniq() |> Enum.sort()
  end

  @doc "Every distinct invariant."
  @spec invariants([AST.t()]) :: [SpecDSL.Invariant.t()]
  def invariants(asts), do: asts |> Enum.flat_map(& &1.invariants) |> Enum.uniq()

  @doc "Every distinct predicate, paired with the model field definitions of its entity."
  @spec predicates([AST.t()]) :: [{SpecDSL.Predicate.t(), [SpecDSL.Field.t()]}]
  def predicates(asts) do
    asts
    |> Enum.flat_map(fn ast ->
      Enum.map(ast.derived.predicates, &{&1, Map.fetch!(ast.model, &1.entity).fields})
    end)
    |> Enum.uniq_by(fn {predicate, _fields} -> {predicate.entity, predicate.name} end)
  end

  @doc "Every distinct count declaration."
  @spec counts([AST.t()]) :: [SpecDSL.Count.t()]
  def counts(asts) do
    asts |> Enum.flat_map(& &1.derived.counts) |> Enum.uniq_by(&{&1.entity, &1.name})
  end

  defp merge_entity(left, right) do
    %Entity{
      fields: Enum.uniq_by(left.fields ++ right.fields, & &1.name),
      relations: Enum.uniq(left.relations ++ right.relations),
      machines:
        Map.merge(left.machines, right.machines, fn _field, a, b -> merge_machine(a, b) end),
      order: left.order || right.order
    }
  end

  defp merge_machine(left, right) do
    %{
      states: Enum.uniq(left.states ++ right.states),
      transitions: Enum.uniq(left.transitions ++ right.transitions)
    }
  end
end
