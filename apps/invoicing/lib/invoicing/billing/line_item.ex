defmodule Invoicing.Billing.LineItem do
  @moduledoc "A priced quantity of something on an invoice."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "line_items"
    repo Invoicing.Repo
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:description, :quantity, :unit_price, :invoice_id]
      validate Invoicing.Billing.Invoice.DraftOnly
    end

    update :update do
      primary? true
      require_atomic? false
      accept [:description, :quantity, :unit_price]
      validate Invoicing.Billing.Invoice.DraftOnly
    end

    destroy :destroy do
      primary? true
      require_atomic? false
      validate Invoicing.Billing.Invoice.DraftOnly
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action_type([:create, :update, :destroy]) do
      authorize_if actor_attribute_equals(:role, :accountant)
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :description, :string,
      allow_nil?: false,
      default: "",
      public?: true,
      constraints: [allow_empty?: true]

    attribute :quantity, :integer,
      allow_nil?: false,
      default: 1,
      public?: true,
      constraints: [min: 0]

    attribute :unit_price, :decimal,
      allow_nil?: false,
      default: Decimal.new(0),
      public?: true,
      constraints: [min: 0]

    timestamps()
  end

  relationships do
    belongs_to :invoice, Invoicing.Billing.Invoice,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true
  end

  calculations do
    calculate :total, :decimal, expr(quantity * unit_price), public?: true
  end
end
