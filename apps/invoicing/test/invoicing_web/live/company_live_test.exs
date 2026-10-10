defmodule InvoicingWeb.CompanyLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Billing, CRM}

  setup %{conn: conn} do
    accountant =
      Accounts.create_user!(
        %{name: "Accounts User", email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    acme =
      CRM.create_company!(%{name: "Acme", domain: "acme.test", industry: "Manufacturing"},
        authorize?: false
      )

    globex = CRM.create_company!(%{name: "Globex"}, authorize?: false)

    CRM.create_contact!(
      %{
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@acme.test",
        company_id: acme.id
      },
      authorize?: false
    )

    CRM.create_contact!(
      %{first_name: "Grace", last_name: "Hopper", company_id: globex.id},
      authorize?: false
    )

    %{conn: Accounts.log_in_conn(conn, accountant), acme: acme, globex: globex}
  end

  test "the company page lists its contacts and links to the editor", %{conn: conn, acme: acme} do
    {:ok, view, _html} = live(conn, ~p"/companies/#{acme.id}")

    assert view |> element("#company-name") |> render() =~ "Acme"
    assert view |> element("#company-contacts") |> render() =~ "Ada Lovelace"
    assert view |> element("#company-contacts") |> render() =~ "ada@acme.test"
    refute view |> element("#company-contacts") |> render() =~ "Grace Hopper"

    {:ok, editor, _html} =
      view |> element("#edit-company") |> render_click() |> follow_redirect(conn)

    assert editor |> element("#company-name") |> render() =~ "Acme"
  end

  test "company page lists its invoices", %{conn: conn, acme: acme, globex: globex} do
    Billing.create_invoice!(%{number: "INV-001", company_id: acme.id}, authorize?: false)
    Billing.create_invoice!(%{number: "INV-002", company_id: acme.id}, authorize?: false)
    Billing.create_invoice!(%{number: "INV-003", company_id: globex.id}, authorize?: false)

    {:ok, view, _html} = live(conn, ~p"/companies/#{acme.id}")

    invoices_table = view |> element("#company-invoices") |> render()
    assert invoices_table =~ ~r/INV-001.*Draft.*INV-002.*Draft/s
    refute invoices_table =~ "INV-003"
  end

  test "an anonymous visitor is sent to the login page" do
    conn = Phoenix.ConnTest.build_conn()

    assert {:error, {:redirect, %{to: "/login"}}} = live(conn, ~p"/companies")
  end
end
