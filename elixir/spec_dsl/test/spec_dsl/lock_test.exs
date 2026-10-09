defmodule SpecDSL.LockTest do
  use ExUnit.Case, async: true

  alias SpecDSL.Lock
  alias SpecDSL.Lock.Context

  setup_all do
    {:ok, lock: Lock.load!("test/fixtures/invoicing.lock.json")}
  end

  test "lists step ids", %{lock: lock} do
    assert Lock.step_ids(lock) == ["enters", "given-entity", "opens", "sees"]
  end

  test "lists slot names and types of a step", %{lock: lock} do
    assert lock.steps["opens"] == [
             %{name: "Actor", type: "Actor"},
             %{name: "Surface", type: "Surface"},
             %{name: "Ref", type: "Ref"}
           ]
  end

  test "lists context names with scopes, requirements and config keys", %{lock: lock} do
    assert Lock.context_names(lock) == [:actor, :clock, :data]

    assert lock.contexts[:actor] == %Context{
             name: :actor,
             scope: :actor,
             keyed_by: "Actor",
             requires: [:data],
             config_keys: ["Role"]
           }

    assert lock.contexts[:clock].scope == :suite
    assert lock.contexts[:data].scope == :scenario
  end
end
