defmodule Invoicing.Accounts do
  @moduledoc "Users who can sign in."

  use Ash.Domain, extensions: [AshBoundary]

  boundary do
    deps([Invoicing])
  end

  require Ash.Query

  @assignable_roles [:sales, :manager]

  resources do
    resource Invoicing.Accounts.User do
      define :create_user, action: :create
      define :get_user, action: :read, get_by: [:id]
      define :get_user_by_email, action: :read, get_by: [:email]
      define :update_user, action: :update
    end
  end

  @doc "Lists the users a task may be assigned to by name."
  def list_assignable_users!(opts \\ []) do
    Invoicing.Accounts.User
    |> Ash.Query.filter(role in ^@assignable_roles)
    |> Ash.Query.sort(name: :asc)
    |> Ash.read!(opts)
  end

  @doc "Returns the number of users a task may be assigned to."
  def count_assignable_users(actor) do
    Invoicing.Accounts.User
    |> Ash.Query.filter(role in ^@assignable_roles)
    |> Ash.count!(actor: actor)
  end

  @doc "Returns the conn carrying a test session logged in as the given user."
  def log_in_conn(conn, %Invoicing.Accounts.User{id: user_id}) do
    Plug.Test.init_test_session(conn, %{user_id: user_id})
  end
end
