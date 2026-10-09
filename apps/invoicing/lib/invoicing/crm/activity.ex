defmodule Invoicing.CRM.Activity do
  @moduledoc "A note, call, email or meeting logged against a contact."

  use Ash.Resource,
    domain: Invoicing.CRM,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  alias Invoicing.CRM.Activity.AssignUser

  require Ash.Query

  postgres do
    table "activities"
    repo Invoicing.Repo
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true
      argument :contact_id, :uuid
      prepare build(sort: [occurred_at: :desc])
      prepare fn query, _context -> filter_by_contact(query, query.arguments[:contact_id]) end
    end

    create :create do
      primary? true
      accept [:kind, :body, :occurred_at, :contact_id, :user_id]
      change AssignUser
    end

    update :update do
      primary? true
      accept [:kind, :body, :occurred_at]
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

    attribute :kind, :atom,
      allow_nil?: false,
      public?: true,
      constraints: [one_of: [:note, :call, :email, :meeting]]

    attribute :body, :string, allow_nil?: false, public?: true

    attribute :occurred_at, :utc_datetime,
      allow_nil?: false,
      public?: true,
      default: &Invoicing.Clock.now/0

    timestamps()
  end

  relationships do
    belongs_to :contact, Invoicing.CRM.Contact,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true

    belongs_to :user, Invoicing.Accounts.User,
      allow_nil?: false,
      attribute_writable?: true,
      public?: true
  end

  defp filter_by_contact(query, nil), do: query

  defp filter_by_contact(query, contact_id),
    do: Ash.Query.filter(query, contact_id == ^contact_id)
end
