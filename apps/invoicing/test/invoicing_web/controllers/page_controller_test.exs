defmodule InvoicingWeb.PageControllerTest do
  use InvoicingWeb.ConnCase, async: true

  alias Invoicing.Accounts

  test "the root path sends a visitor who is not signed in to the login page", %{conn: conn} do
    conn = get(conn, ~p"/")

    assert redirected_to(conn) == "/login"
  end

  test "the root path sends a signed-in user to the dashboard", %{conn: conn} do
    user =
      Accounts.create_user!(%{name: "Sales User", email: unique_email("sales"), role: :sales},
        authorize?: false
      )

    conn = conn |> Accounts.log_in_conn(user) |> get(~p"/")

    assert redirected_to(conn) == "/dashboard"
  end
end
