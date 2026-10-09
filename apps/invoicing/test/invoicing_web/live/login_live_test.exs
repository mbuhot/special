defmodule InvoicingWeb.LoginLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.Accounts

  test "an unknown email shows that there is no such user", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/login")

    html =
      view
      |> form("#login-form", login: %{email: "nobody@example.com"})
      |> render_submit()

    assert html =~ "No such user"
  end

  test "an existing user is logged in and sees the invoice list", %{conn: conn} do
    Accounts.create_user!(%{email: "accounts@example.com", role: :accountant}, authorize?: false)
    {:ok, view, _html} = live(conn, ~p"/login")

    login_form = form(view, "#login-form", login: %{email: "accounts@example.com"})
    render_submit(login_form)
    logged_in_conn = submit_form(login_form, conn)

    assert redirected_to(logged_in_conn) == "/dashboard"

    {:ok, invoices_view, _html} = live(recycle(logged_in_conn), ~p"/invoices")

    assert has_element?(invoices_view, "#invoices")
  end
end
