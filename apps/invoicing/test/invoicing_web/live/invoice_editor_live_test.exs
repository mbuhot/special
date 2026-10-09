defmodule InvoicingWeb.InvoiceEditorLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Billing}

  setup %{conn: conn} do
    user = Accounts.create_user!(%{email: "accounts@example.com", role: :accountant})
    customer = Billing.create_customer!(%{name: "Acme"})
    invoice = Billing.create_invoice!(%{number: "INV-001", customer_id: customer.id})

    Billing.create_line_item!(%{
      invoice_id: invoice.id,
      description: "Consulting",
      quantity: 1,
      unit_price: "100"
    })

    %{conn: Accounts.log_in_conn(conn, user), invoice: invoice}
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
