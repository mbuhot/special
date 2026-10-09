defmodule Invoicing.CRM.Contact do
  @moduledoc "A person at a company who is sold to."

  use Ash.Resource,
    domain: Invoicing.CRM,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    primary_read_warning?: false

  require Ash.Query

  postgres do
    table "contacts"
    repo Invoicing.Repo
  end

  actions do
    defaults [
      :destroy,
      create: [:first_name, :last_name, :email, :phone, :company_id],
      update: [:first_name, :last_name, :email, :phone, :company_id]
    ]

    read :read do
      primary? true

      argument :search, :string
      argument :company_id, :uuid

      prepare fn query, _context ->
        search = query.arguments[:search]
        company_id = query.arguments[:company_id]

        query
        |> filter_by_name(search)
        |> filter_by_company(company_id)
      end
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action_type([:create, :update]) do
      authorize_if actor_attribute_equals(:role, :sales)
      authorize_if actor_attribute_equals(:role, :manager)
      authorize_if actor_attribute_equals(:role, :admin)
    end

    policy action_type(:destroy) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :first_name, :string, allow_nil?: false, public?: true
    attribute :last_name, :string, allow_nil?: false, public?: true
    attribute :email, :string, public?: true
    attribute :phone, :string, public?: true
    timestamps()
  end

  relationships do
    belongs_to :company, Invoicing.CRM.Company,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    has_many :deals, Invoicing.Pipeline.Deal
    has_many :activities, Invoicing.CRM.Activity, sort: [occurred_at: :desc]
  end

  calculations do
    calculate :full_name, :string, expr(first_name <> " " <> last_name), public?: true
  end

  defp filter_by_name(query, search) when search in [nil, ""], do: query

  defp filter_by_name(query, search) do
    pattern = "%#{search}%"
    Ash.Query.filter(query, ilike(first_name, ^pattern) or ilike(last_name, ^pattern))
  end

  defp filter_by_company(query, company_id) when company_id in [nil, ""], do: query

  defp filter_by_company(query, company_id),
    do: Ash.Query.filter(query, company_id == ^company_id)
end
