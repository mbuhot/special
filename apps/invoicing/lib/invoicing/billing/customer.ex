defmodule Invoicing.Billing.Customer do
  @moduledoc "A party that is invoiced."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "customers"
    repo Invoicing.Repo
  end

  actions do
    defaults [:read, :destroy, create: [:name, :email], update: [:name, :email]]
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
