defmodule Invoicing.CRM do
  @moduledoc "Companies, contacts and the activities logged against them."

  use Ash.Domain, extensions: [AshBoundary]

  boundary do
    deps([Invoicing])
  end

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

  @doc "Returns the kinds an activity can have."
  def activity_kinds do
    Invoicing.CRM.Activity
    |> Ash.Resource.Info.attribute(:kind)
    |> Map.fetch!(:constraints)
    |> Keyword.fetch!(:one_of)
  end

  @doc "Newest activities first, with contact names loaded."
  def list_recent_activities!(limit \\ 5, opts \\ []) do
    Invoicing.CRM.Activity
    |> Ash.Query.sort(occurred_at: :desc, id: :desc)
    |> Ash.Query.limit(limit)
    |> Ash.Query.load(contact: [:full_name])
    |> Ash.read!(opts)
  end
end
