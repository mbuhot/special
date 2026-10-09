defmodule Invoicing.Accounts.User do
  @moduledoc "A person who signs in with their email."

  use Ash.Resource,
    domain: Invoicing.Accounts,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "users"
    repo Invoicing.Repo
  end

  actions do
    defaults [:read, :destroy, create: [:email, :role], update: [:email, :role]]
  end

  policies do
    policy action_type(:read) do
      authorize_if actor_present()
    end

    policy action_type([:create, :update, :destroy]) do
      authorize_if actor_attribute_equals(:role, :admin)
    end
  end

  attributes do
    uuid_primary_key :id
    attribute :email, :string, allow_nil?: false, public?: true

    attribute :role, :atom,
      allow_nil?: false,
      default: :accountant,
      public?: true,
      constraints: [one_of: [:accountant, :admin]]

    timestamps()
  end

  identities do
    identity :unique_email, [:email]
  end
end
