defmodule InvoicingWeb.InvoiceEditorLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Billing}

  setup %{conn: conn} do
    accountant = Accounts.create_user!(%{email: "accounts@example.com", role: :accountant})
    customer = Billing.create_customer!(%{name: "Acme"}, authorize?: false)

    invoice =
      Billing.create_invoice!(%{number: "INV-001", customer_id: customer.id}, authorize?: false)

    Billing.create_line_item!(
      %{invoice_id: invoice.id, description: "Consulting", quantity: 1, unit_price: "100"},
      authorize?: false
    )

    %{conn: Accounts.log_in_conn(conn, accountant), invoice: invoice}
  end

  defp sign_in_as_admin(conn) do
    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin})
    Accounts.log_in_conn(conn, admin)
  end

  test "changing the quantity recalculates the invoice total", %{conn: conn, invoice: invoice} do
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    view
    |> form("#invoice-form", invoice: %{lines: %{"0" => %{quantity: "3"}}})
    |> render_change()

    assert view |> element("#totals") |> render() =~ "300.00"
  end

  test "a changed quantity is saved with the invoice", %{conn: conn, invoice: invoice} do
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    view
    |> form("#invoice-form", invoice: %{lines: %{"0" => %{quantity: "3"}}})
    |> render_change()

    {:ok, reloaded_view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert reloaded_view |> element("#totals") |> render() =~ "300.00"
  end

  test "sending the invoice shows the sent status", %{conn: conn, invoice: invoice} do
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert view |> element("#invoice-status") |> render() =~ "draft"

    view |> element("#send-invoice") |> render_click()

    assert view |> element("#invoice-status") |> render() =~ "sent"
  end

  test "an admin marks a sent invoice paid", %{conn: conn, invoice: invoice} do
    Billing.send_invoice!(invoice, authorize?: false)
    conn = sign_in_as_admin(conn)
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert view |> element("#invoice-status") |> render() =~ "sent"

    view |> element("#mark-paid-invoice") |> render_click()

    assert view |> element("#invoice-status") |> render() =~ "paid"
  end

  test "an admin voids a draft invoice", %{conn: conn, invoice: invoice} do
    conn = sign_in_as_admin(conn)
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert view |> element("#invoice-status") |> render() =~ "draft"

    view |> element("#void-invoice") |> render_click()

    assert view |> element("#invoice-status") |> render() =~ "void"
  end

  test "an accountant does not see Mark paid or Void", %{conn: conn, invoice: invoice} do
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert has_element?(view, "#send-invoice")
    refute has_element?(view, "#mark-paid-invoice")
    refute has_element?(view, "#void-invoice")
  end

  test "an anonymous visitor is sent to the login page", %{invoice: invoice} do
    conn = Phoenix.ConnTest.build_conn()

    assert {:error, {:redirect, %{to: "/login"}}} = live(conn, ~p"/invoices/#{invoice.id}/edit")
  end

  test "creating a new invoice opens its editor", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/invoices")

    assert view |> element("#invoices") |> render() =~ "INV-001"

    {:ok, _editor_view, html} =
      view |> element("#new-invoice") |> render_click() |> follow_redirect(conn)

    assert html =~ "INV-2"
  end
end
