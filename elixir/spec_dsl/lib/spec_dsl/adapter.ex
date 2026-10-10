defmodule SpecDSL.Adapter do
  @moduledoc "The application-side operations the conformance and property case templates call; entities are addressed by spec name and records by spec-spelled string keys."

  @type entity_name :: String.t()
  @type resource :: term()
  @type stored_record :: %{required(:id) => term(), optional(atom()) => term()}
  @type field_kind :: :string | :decimal | :integer | :date | :datetime | :boolean | :atom
  @type field :: %{
          name: atom(),
          type: field_kind(),
          allow_nil?: boolean(),
          one_of: [atom()]
        }
  @type relationship :: %{
          name: atom(),
          kind: atom(),
          destination: resource(),
          destination_attribute: atom() | nil
        }
  @type state_machine :: %{
          field: atom(),
          states: [atom()],
          transitions: [{atom(), atom()}]
        }

  @doc "The resource registered for a spec entity name."
  @callback resource_for(entity_name()) :: {:ok, resource()} | :error

  @doc "Public attributes, calculations and aggregates of the resource."
  @callback fields(resource()) :: [field()]

  @doc "Relationships of the resource."
  @callback relationships(resource()) :: [relationship()]

  @doc "The state machine of the resource with transitions expanded to state pairs, or nil."
  @callback state_machine(resource()) :: state_machine() | nil

  @doc "Names of the actions the resource exposes, destroy excluded."
  @callback actions(resource()) :: [atom()]

  @doc "Names of the update actions of the resource."
  @callback update_actions(resource()) :: [atom()]

  @doc "Creates a record from spec-spelled string-keyed attributes and raises when it is invalid."
  @callback create(entity_name(), %{String.t() => term()}) :: stored_record()

  @doc "Creates a record and returns the validation message when the app refuses it."
  @callback try_create(entity_name(), %{String.t() => term()}) ::
              {:ok, stored_record()} | {:error, String.t()}

  @doc "The record's fields as a string-keyed map, calculations included."
  @callback reload(entity_name(), stored_record()) :: %{String.t() => term()}

  @doc "Tries to change the field of the record through the update action."
  @callback attempt_update(entity_name(), stored_record(), atom(), atom()) :: :ok

  @doc "Whether a user of the role may run the spec-spelled action on a record of the entity."
  @callback can?(entity_name(), action :: String.t(), role :: String.t()) :: boolean()

  @doc "The number of records of the entity the app counts for the named predicate on the date."
  @callback app_count(entity_name(), predicate_name :: String.t(), Date.t()) :: integer()

  @doc "The records of the entity a user of the role reads, as `reload/2`-style string-keyed maps, for the given actor user record."
  @callback read_as(entity_name(), role :: String.t(), actor_user :: stored_record()) :: [
              %{String.t() => term()}
            ]

  @doc "Prepares per-test state such as a database sandbox."
  @callback setup(ExUnit.Callbacks.context()) :: term()

  @optional_callbacks setup: 1, read_as: 3

  @doc "Runs the adapter's optional per-test setup."
  @spec setup(module(), map()) :: :ok
  def setup(adapter, tags) do
    Code.ensure_loaded(adapter)
    if function_exported?(adapter, :setup, 1), do: adapter.setup(tags)
    :ok
  end

  @doc "The resource of the entity; fails the test naming the entity when none is registered."
  @spec resource!(module(), entity_name()) :: resource()
  def resource!(adapter, entity_name) do
    case adapter.resource_for(entity_name) do
      {:ok, resource} ->
        resource

      :error ->
        raise ExUnit.AssertionError,
          message: "#{entity_name}: no resource is registered for this entity"
    end
  end
end
