defmodule Invoicing.SpecAdapter do
  @moduledoc "Answers the spec conformance and property suites from the Ash resources, the state machines and the domain count functions."

  use Boundary, top_level?: true, check: [in: false, out: false]

  @behaviour SpecDSL.Adapter

  alias Invoicing.{Billing, Pipeline}
  alias Invoicing.SpecSupport.Factory

  @ash_kinds %{
    Ash.Type.String => :string,
    Ash.Type.Decimal => :decimal,
    Ash.Type.Integer => :integer,
    Ash.Type.Date => :date,
    Ash.Type.UtcDatetime => :datetime,
    Ash.Type.UtcDatetimeUsec => :datetime,
    Ash.Type.Boolean => :boolean,
    Ash.Type.Atom => :atom
  }

  @impl true
  def setup(tags), do: Invoicing.DataCase.setup_sandbox(tags)

  @impl true
  def resource_for(entity_name) do
    {:ok, Factory.resource_for!(entity_name)}
  rescue
    ArgumentError -> :error
  end

  @impl true
  def fields(resource) do
    [
      Ash.Resource.Info.public_attributes(resource),
      Ash.Resource.Info.public_calculations(resource),
      Ash.Resource.Info.public_aggregates(resource)
    ]
    |> Enum.concat()
    |> Enum.map(&field(resource, &1))
  end

  @impl true
  def relationships(resource) do
    resource
    |> Ash.Resource.Info.relationships()
    |> Enum.map(fn relationship ->
      %{
        name: relationship.name,
        kind: relationship.type,
        destination: relationship.destination,
        destination_attribute: Map.get(relationship, :destination_attribute)
      }
    end)
  end

  @impl true
  def state_machine(resource) do
    if AshStateMachine in Spark.extensions(resource) do
      %{
        field: AshStateMachine.Info.state_machine_state_attribute!(resource),
        states: AshStateMachine.Info.state_machine_all_states(resource),
        transitions: transition_pairs(resource)
      }
    end
  end

  @impl true
  def actions(resource) do
    resource
    |> Ash.Resource.Info.actions()
    |> Enum.map(& &1.name)
    |> Enum.reject(&(&1 == :destroy))
  end

  @impl true
  def update_actions(resource) do
    resource
    |> Ash.Resource.Info.actions()
    |> Enum.filter(&(&1.type == :update))
    |> Enum.map(& &1.name)
  end

  @impl true
  def create(entity_name, attrs), do: Factory.create(entity_name, attrs)

  @impl true
  def try_create(entity_name, attrs) do
    {:ok, Factory.create(entity_name, attrs)}
  rescue
    error in Ash.Error.Invalid -> {:error, Exception.message(error)}
  end

  @impl true
  def reload(entity_name, record), do: Factory.reload(entity_name, record.id)

  @impl true
  def attempt_update(entity_name, record, action_name, field) do
    resource = Factory.resource_for!(entity_name)
    action = Ash.Resource.Info.action(resource, action_name)

    entity_name
    |> Factory.fetch(record.id)
    |> Ash.Changeset.for_update(action_name, attempted_params(resource, action, field),
      authorize?: false
    )
    |> Ash.update()

    :ok
  end

  @impl true
  def can?(entity_name, "create", role) do
    user = Factory.create("User", %{"role" => role})
    Ash.can?({Factory.resource_for!(entity_name), :create}, user)
  end

  def can?(entity_name, spec_action, role) do
    user = Factory.create("User", %{"role" => role})
    action = action_atom(spec_action)
    record = entity_name |> record_ready_for(action) |> then(&Factory.fetch(entity_name, &1.id))
    Ash.can?({record, action}, user)
  end

  @impl true
  def app_count("Task", "overdue", today),
    do: Pipeline.count_overdue_tasks(today, admin_user())

  def app_count("Deal", "open", _today),
    do:
      admin_user() |> Pipeline.count_open_deals_by_stage() |> Enum.map(&elem(&1, 1)) |> Enum.sum()

  def app_count("Invoice", "unpaid", _today), do: Billing.count_unpaid_invoices(admin_user())

  defp admin_user, do: Factory.create("User", %{"role" => "admin"})

  defp field(resource, %Ash.Resource.Aggregate{} = aggregate) do
    {:ok, type} = Ash.Resource.Info.aggregate_type(resource, aggregate)
    field_definition(aggregate, type, aggregate.constraints)
  end

  defp field(_resource, ash_field),
    do: field_definition(ash_field, ash_field.type, ash_field.constraints)

  defp field_definition(ash_field, type, constraints) do
    ash_type = Ash.Type.get_type(type)

    %{
      name: ash_field.name,
      type: Map.get(@ash_kinds, ash_type, ash_type),
      allow_nil?: Map.get(ash_field, :allow_nil?, true),
      one_of: Keyword.get(constraints || [], :one_of, [])
    }
  end

  defp transition_pairs(resource) do
    all_states = AshStateMachine.Info.state_machine_all_states(resource)

    resource
    |> AshStateMachine.Info.state_machine_transitions()
    |> Enum.flat_map(fn transition ->
      for from_state <- expand_states(transition.from, all_states),
          to_state <- expand_states(transition.to, all_states),
          do: {from_state, to_state}
    end)
    |> Enum.uniq()
  end

  defp expand_states(:*, all_states), do: all_states
  defp expand_states(states, _all_states), do: List.wrap(states)

  defp record_ready_for(entity_name, action) do
    resource = Factory.resource_for!(entity_name)

    case source_state(resource, action) do
      nil -> Factory.create(entity_name, %{})
      state -> Factory.create(entity_name, %{state_attribute(resource) => Atom.to_string(state)})
    end
  end

  defp state_attribute(resource) do
    resource |> AshStateMachine.Info.state_machine_state_attribute!() |> Atom.to_string()
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

  defp attempted_params(resource, action, field) do
    attribute = Ash.Resource.Info.attribute(resource, field)

    if attribute != nil and attribute.type == Ash.Type.String and field in action.accept do
      %{field => "changed-#{System.unique_integer([:positive])}"}
    else
      %{}
    end
  end

  defp action_atom(spec_spelling),
    do: spec_spelling |> String.replace(" ", "_") |> String.to_atom()
end
