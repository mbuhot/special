defmodule Invoicing.Pipeline.Deal do
  @moduledoc "A sales opportunity for a company whose stage follows lead, qualified, proposal, won or lost."

  use Ash.Resource,
    domain: Invoicing.Pipeline,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshStateMachine]

  alias Invoicing.Pipeline.Deal.AssignOwner

  postgres do
    table "deals"
    repo Invoicing.Repo
  end

  state_machine do
    state_attribute :stage
    initial_states [:lead]
    default_initial_state :lead

    transitions do
      transition :qualify, from: :lead, to: :qualified
      transition :propose, from: :qualified, to: :proposal
      transition :win, from: :proposal, to: :won
      transition :lose, from: [:lead, :qualified, :proposal], to: :lost
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:name, :amount, :close_date, :company_id, :contact_id, :owner_id]
      change AssignOwner
    end

    update :update do
      primary? true
      accept [:name, :amount, :close_date, :company_id, :contact_id, :owner_id]
    end

    update :qualify do
      accept []
      change transition_state(:qualified)
    end

    update :propose do
      accept []
      change transition_state(:proposal)
    end

    update :win do
      accept []
      change transition_state(:won)
    end

    update :lose do
      accept []
      change transition_state(:lost)
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action([:create, :update, :qualify, :propose, :win, :lose]) do
      authorize_if actor_attribute_equals(:role, :accountant)
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy action_type(:destroy) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :name, :string, allow_nil?: false, public?: true
    attribute :amount, :decimal, public?: true
    attribute :close_date, :date, public?: true
    timestamps()
  end

  relationships do
    belongs_to :company, Invoicing.CRM.Company,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    belongs_to :contact, Invoicing.CRM.Contact, attribute_writable?: true, public?: true

    belongs_to :owner, Invoicing.Accounts.User,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true
  end
end
