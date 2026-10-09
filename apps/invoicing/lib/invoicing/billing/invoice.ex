defmodule Invoicing.Billing.Invoice do
  @moduledoc "A bill for a customer whose status follows draft, sent, paid or void."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshStateMachine]

  postgres do
    table "invoices"
    repo Invoicing.Repo
  end

  state_machine do
    state_attribute :status
    initial_states [:draft]
    default_initial_state :draft

    transitions do
      transition :send, from: :draft, to: :sent
      transition :mark_paid, from: :sent, to: :paid
      transition :void, from: :draft, to: :void
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:number, :customer_id]
    end

    update :update do
      primary? true
      accept [:number, :customer_id]
    end

    update :send do
      accept []
      change transition_state(:sent)
    end

    update :mark_paid do
      accept []
      change transition_state(:paid)
    end

    update :void do
      accept []
      change transition_state(:void)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :number, :string, allow_nil?: false, public?: true
    timestamps()
  end

  relationships do
    belongs_to :customer, Invoicing.Billing.Customer,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    has_many :line_items, Invoicing.Billing.LineItem do
      sort inserted_at: :asc, id: :asc
    end
  end

  calculations do
    calculate :total, :decimal, expr(line_items_total), public?: true
  end

  aggregates do
    sum :line_items_total, :line_items, :line_total, default: Decimal.new(0)
  end

  identities do
    identity :unique_number, [:number]
  end
end
