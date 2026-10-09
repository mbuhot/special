defmodule Invoicing.CRM.Company do
  @moduledoc "An organisation that is sold to and invoiced."

  use Ash.Resource,
    domain: Invoicing.CRM,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    primary_read_warning?: false

  require Ash.Query

  postgres do
    table "companies"
    repo Invoicing.Repo
  end

  actions do
    defaults [
      :destroy,
      create: [:name, :domain, :industry],
      update: [:name, :domain, :industry]
    ]

    read :read do
      primary? true

      argument :search, :string

      prepare fn query, _context ->
        filter_by_name(query, query.arguments[:search])
      end
    end
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
    has_many :contacts, Invoicing.CRM.Contact
    has_many :deals, Invoicing.Pipeline.Deal
  end

  defp filter_by_name(query, search) when search in [nil, ""], do: query

  defp filter_by_name(query, search) do
    pattern = "%#{search}%"
    Ash.Query.filter(query, ilike(name, ^pattern))
  end
end
