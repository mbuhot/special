defmodule Invoicing.Accounts do
  @moduledoc "Users who can sign in."

  use Ash.Domain

  resources do
    resource Invoicing.Accounts.User do
      define :create_user, action: :create
      define :get_user, action: :read, get_by: [:id]
      define :get_user_by_email, action: :read, get_by: [:email]
    end
  end

  @doc "Returns the conn carrying a test session logged in as the given user."
  def log_in_conn(conn, %Invoicing.Accounts.User{id: user_id}) do
    Plug.Test.init_test_session(conn, %{user_id: user_id})
  end
end
