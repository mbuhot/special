defmodule InvoicingWeb.SessionController do
  @moduledoc "Starts a signed-in session for an existing user."

  use InvoicingWeb, :controller

  alias Invoicing.Accounts

  def create(conn, %{"login" => %{"email" => email}}) do
    case Accounts.get_user_by_email(email, not_found_error?: false, authorize?: false) do
      {:ok, %Accounts.User{id: user_id}} ->
        conn
        |> configure_session(renew: true)
        |> put_session(:user_id, user_id)
        |> redirect(to: ~p"/dashboard")

      _no_user ->
        conn
        |> put_flash(:error, "No such user")
        |> redirect(to: ~p"/login")
    end
  end
end
