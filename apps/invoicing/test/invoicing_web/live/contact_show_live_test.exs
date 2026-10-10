defmodule InvoicingWeb.ContactShowLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: unique_email("sales"), role: :sales},
        authorize?: false
      )

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    ada =
      CRM.create_contact!(
        %{first_name: "Ada", last_name: "Lovelace", company_id: acme.id},
        authorize?: false
      )

    %{conn: Accounts.log_in_conn(conn, sales_rep), ada: ada}
  end

  test "the contact list links each name to the contact page", %{conn: conn, ada: ada} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    {:ok, page, _html} =
      view |> element("#contact-#{ada.id} a") |> render_click() |> follow_redirect(conn)

    assert page |> element("#contact-name") |> render() =~ "Ada Lovelace"
  end
end
