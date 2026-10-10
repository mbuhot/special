defmodule Invoicing.Billing.Business do
  @moduledoc "The business that supplies invoices, identified by name and ABN."

  use Ash.Resource,
    domain: Invoicing.Billing,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "businesses"
    repo Invoicing.Repo
  end

  actions do
    defaults [:read]

    update :update do
      primary? true
      accept [:name, :abn]
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action_type(:update) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :name, :string, allow_nil?: false, public?: true
    attribute :abn, :string, allow_nil?: false, public?: true
    timestamps()
  end

  relationships do
    has_many :supplied_invoices, Invoicing.Billing.Invoice, destination_attribute: :supplier_id
  end
end
