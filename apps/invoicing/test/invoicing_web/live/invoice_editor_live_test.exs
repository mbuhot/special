defmodule InvoicingWeb.InvoiceEditorLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Billing, CRM}

  setup %{conn: conn} do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    company = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    invoice =
      Billing.create_invoice!(%{number: "INV-001", company_id: company.id}, authorize?: false)

    Billing.create_line_item!(
      %{invoice_id: invoice.id, description: "Consulting", quantity: 1, unit_price: "100"},
      authorize?: false
    )

    %{conn: Accounts.log_in_conn(conn, accountant), invoice: invoice}
  end

  test "a changed quantity is saved with the invoice", %{conn: conn, invoice: invoice} do
    {:ok, view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    view
    |> form("#invoice-form", invoice: %{lines: %{"0" => %{quantity: "3"}}})
    |> render_change()

    {:ok, reloaded_view, _html} = live(conn, ~p"/invoices/#{invoice.id}/edit")

    assert reloaded_view |> element("#totals") |> render() =~ "300.00"
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
end
