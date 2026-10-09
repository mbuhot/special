defmodule Invoicing.Billing.Customer do
  @moduledoc "A party that is invoiced."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "customers"
    repo Invoicing.Repo
  end

  actions do
    defaults [:read, :destroy, create: [:name, :email], update: [:name, :email]]
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action_type([:create, :update]) do
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
    attribute :email, :string, public?: true
    timestamps()
  end

  relationships do
    has_many :invoices, Invoicing.Billing.Invoice
  end
end
