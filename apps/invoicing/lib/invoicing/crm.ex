defmodule Invoicing.CRM do
  @moduledoc "Companies, contacts and the activities logged against them."

  use Ash.Domain

  resources do
    resource Invoicing.CRM.Company do
      define :create_company, action: :create
      define :list_companies, action: :read, args: [{:optional, :search}]
      define :get_company, action: :read, get_by: [:id]
      define :update_company, action: :update
    end

    resource Invoicing.CRM.Contact do
      define :list_contacts, action: :read, args: [{:optional, :search}, {:optional, :company_id}]
      define :get_contact, action: :read, get_by: [:id]
      define :create_contact, action: :create
      define :update_contact, action: :update
    end

    resource Invoicing.CRM.Activity do
      define :list_activities, action: :read, args: [:contact_id]
      define :create_activity, action: :create
    end
  end
end
