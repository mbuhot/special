defmodule Invoicing.CRM.Company do
  @moduledoc "An organisation that is sold to and invoiced."

  use Ash.Resource,
    domain: Invoicing.CRM,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "companies"
    repo Invoicing.Repo
  end

  actions do
    defaults [
      :read,
      :destroy,
      create: [:name, :domain, :industry],
      update: [:name, :domain, :industry]
    ]
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
    attribute :domain, :string, public?: true
    attribute :industry, :string, public?: true
    timestamps()
  end

  relationships do
    has_many :invoices, Invoicing.Billing.Invoice
  end
end
