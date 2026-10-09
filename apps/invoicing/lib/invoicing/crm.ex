defmodule Invoicing.CRM do
  @moduledoc "Companies and contacts that are sold to and invoiced."

  use Ash.Domain

  resources do
    resource Invoicing.CRM.Company do
      define :create_company, action: :create
      define :list_companies, action: :read
    end

    resource Invoicing.CRM.Contact do
      define :list_contacts, action: :read, args: [{:optional, :search}, {:optional, :company_id}]
      define :get_contact, action: :read, get_by: [:id]
      define :create_contact, action: :create
      define :update_contact, action: :update
    end
  end
end
