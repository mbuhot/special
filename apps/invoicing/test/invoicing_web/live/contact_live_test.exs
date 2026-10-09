defmodule InvoicingWeb.ContactLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{email: "sales@example.com", role: :sales},
        authorize?: false
      )

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)
    globex = CRM.create_company!(%{name: "Globex"}, authorize?: false)

    ada =
      CRM.create_contact!(
        %{first_name: "Ada", last_name: "Lovelace", email: "ada@acme.test", company_id: acme.id},
        authorize?: false
      )

    grace =
      CRM.create_contact!(
        %{first_name: "Grace", last_name: "Hopper", company_id: globex.id},
        authorize?: false
      )

    %{
      conn: Accounts.log_in_conn(conn, sales_rep),
      acme: acme,
      globex: globex,
      ada: ada,
      grace: grace
    }
  end

  defp contacts_table(view), do: view |> element("#contacts") |> render()

  test "the contact list shows every contact with its company", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    assert contacts_table(view) =~ "Ada Lovelace"
    assert contacts_table(view) =~ "ada@acme.test"
    assert contacts_table(view) =~ "Acme"
    assert contacts_table(view) =~ "Grace Hopper"
  end

  test "searching by name narrows the contact list", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    view |> form("#contact-filter-form", filter: %{search: "grace"}) |> render_change()

    assert contacts_table(view) =~ "Grace Hopper"
    refute contacts_table(view) =~ "Ada Lovelace"
  end

  test "filtering by company narrows the contact list", %{conn: conn, acme: acme} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    view |> form("#contact-filter-form", filter: %{company: acme.id}) |> render_change()

    assert contacts_table(view) =~ "Ada Lovelace"
    refute contacts_table(view) =~ "Grace Hopper"
  end

  test "creating a contact shows its full name in the editor", %{conn: conn, acme: acme} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    {:ok, editor, _html} =
      view |> element("#new-contact") |> render_click() |> follow_redirect(conn)

    editor
    |> form("#contact-form",
      contact: %{
        first_name: "Katherine",
        last_name: "Johnson",
        email: "kj@acme.test",
        phone: "555-0100",
        company_id: acme.id
      }
    )
    |> render_change()

    editor |> element("#save-contact") |> render_click()

    assert editor |> element("#contact-name") |> render() =~ "Katherine Johnson"
    assert_patch(editor)
  end

  test "editing a contact updates its full name", %{conn: conn, ada: ada} do
    {:ok, editor, _html} = live(conn, ~p"/contacts/#{ada.id}/edit")

    editor |> form("#contact-form", contact: %{first_name: "Ada-Byron"}) |> render_change()
    editor |> element("#save-contact") |> render_click()

    assert editor |> element("#contact-name") |> render() =~ "Ada-Byron Lovelace"

    {:ok, reopened_editor, _html} = live(conn, ~p"/contacts/#{ada.id}/edit")
    assert reopened_editor |> element("#contact-name") |> render() =~ "Ada-Byron Lovelace"
  end

  test "an anonymous visitor is sent to the login page" do
    conn = Phoenix.ConnTest.build_conn()

    assert {:error, {:redirect, %{to: "/login"}}} = live(conn, ~p"/contacts")
  end
end
