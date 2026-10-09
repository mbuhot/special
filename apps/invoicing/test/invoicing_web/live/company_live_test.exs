defmodule InvoicingWeb.CompanyLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM}

  setup %{conn: conn} do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
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

  defp companies_table(view), do: view |> element("#companies") |> render()

  test "the company list shows every company with its domain and industry", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/companies")

    assert companies_table(view) =~ "Acme"
    assert companies_table(view) =~ "acme.test"
    assert companies_table(view) =~ "Manufacturing"
    assert companies_table(view) =~ "Globex"
  end

  test "searching by name narrows the company list", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/companies")

    view |> form("#company-filter-form", filter: %{search: "glo"}) |> render_change()

    assert companies_table(view) =~ "Globex"
    refute companies_table(view) =~ "Acme"
  end

  test "creating a company shows its name in the editor", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/companies")

    {:ok, editor, _html} =
      view |> element("#new-company") |> render_click() |> follow_redirect(conn)

    editor
    |> form("#company-form",
      company: %{name: "Initech", domain: "initech.test", industry: "Software"}
    )
    |> render_change()

    editor |> element("#save-company") |> render_click()

    assert editor |> element("#company-name") |> render() =~ "Initech"
    assert_patch(editor)
  end

  test "editing a company updates its name", %{conn: conn, acme: acme} do
    {:ok, editor, _html} = live(conn, ~p"/companies/#{acme.id}/edit")

    editor |> form("#company-form", company: %{name: "Acme-Corp"}) |> render_change()
    editor |> element("#save-company") |> render_click()

    assert editor |> element("#company-name") |> render() =~ "Acme-Corp"

    {:ok, reopened_editor, _html} = live(conn, ~p"/companies/#{acme.id}/edit")
    assert reopened_editor |> element("#company-name") |> render() =~ "Acme-Corp"
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

  test "an anonymous visitor is sent to the login page" do
    conn = Phoenix.ConnTest.build_conn()

    assert {:error, {:redirect, %{to: "/login"}}} = live(conn, ~p"/companies")
  end
end
