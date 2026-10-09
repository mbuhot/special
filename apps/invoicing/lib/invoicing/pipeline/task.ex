defmodule Invoicing.Pipeline.Task do
  @moduledoc "A piece of follow-up work on a deal that is open until completed."

  use Ash.Resource,
    domain: Invoicing.Pipeline,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    primary_read_warning?: false,
    extensions: [AshStateMachine]

  alias Invoicing.Pipeline.Task.AssignAssignee

  require Ash.Query

  postgres do
    table "tasks"
    repo Invoicing.Repo
  end

  state_machine do
    state_attribute :status
    initial_states [:open]
    default_initial_state :open

    transitions do
      transition :complete, from: :open, to: :done
    end
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true
      argument :deal_id, :uuid
      prepare build(sort: [due_date: :asc, inserted_at: :asc])
      prepare fn query, _context -> filter_by_deal(query, query.arguments[:deal_id]) end
    end

    create :create do
      primary? true
      accept [:title, :due_date, :deal_id, :assignee_id]
      change AssignAssignee
    end

    update :update do
      primary? true
      accept [:title, :due_date, :assignee_id]
    end

    update :complete do
      accept []
      change transition_state(:done)
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action([:create, :update, :complete]) do
      authorize_if actor_attribute_equals(:role, :accountant)
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy action_type(:destroy) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :title, :string, allow_nil?: false, public?: true
    attribute :due_date, :date, allow_nil?: false, public?: true
    timestamps()
  end

  relationships do
    belongs_to :deal, Invoicing.Pipeline.Deal,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    belongs_to :assignee, Invoicing.Accounts.User,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true
  end

  defp filter_by_deal(query, nil), do: query
  defp filter_by_deal(query, deal_id), do: Ash.Query.filter(query, deal_id == ^deal_id)
end
