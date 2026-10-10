defmodule SpecDSL.Test.FakeAdapter do
  @moduledoc "An in-memory adapter whose answers come from a map of data and functions stored in the test process."

  @behaviour SpecDSL.Adapter

  @doc "Installs the world the adapter answers from in the calling process and empties its record store."
  def install(world) do
    Process.put(:fake_adapter_world, world)
    Process.put(:fake_adapter_records, [])
    :ok
  end

  @doc "Every record created so far in the calling process, as attribute maps."
  def records, do: Process.get(:fake_adapter_records)

  @impl true
  def resource_for(entity_name), do: Map.fetch(world().resources, entity_name)

  @impl true
  def fields(_resource), do: world().fields

  @impl true
  def relationships(_resource), do: world().relationships

  @impl true
  def state_machine(_resource), do: world().state_machine

  @impl true
  def actions(_resource), do: world().actions

  @impl true
  def update_actions(_resource), do: world().update_actions

  @impl true
  def create(_entity_name, attrs) do
    records = records()
    Process.put(:fake_adapter_records, records ++ [attrs])
    %{id: length(records) + 1, attrs: attrs}
  end

  @impl true
  def try_create(entity_name, attrs) do
    if world().rejects_duplicates and Enum.any?(records(), &(&1["sku"] == attrs["sku"])) do
      {:error, "sku has already been taken"}
    else
      {:ok, create(entity_name, attrs)}
    end
  end

  @impl true
  def reload(_entity_name, record), do: world().reload.(record.attrs)

  @impl true
  def attempt_update(_entity_name, _record, _action, _field), do: :ok

  @impl true
  def can?(entity_name, action, role), do: world().can?.(entity_name, action, role)

  @impl true
  def app_count(entity_name, predicate_name, today),
    do: world().app_count.(entity_name, predicate_name, today, records())

  defp world, do: Process.get(:fake_adapter_world)
end
