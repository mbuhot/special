defmodule InvoicingWeb.DealLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup %{conn: conn} do
    manager =
      Accounts.create_user!(
        %{name: "Manager User", email: unique_email("manager"), role: :manager},
        authorize?: false
      )

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

    deal =
      Pipeline.create_deal!(
        %{name: "Big deal", amount: "12000", company_id: acme.id, owner_id: manager.id},
        authorize?: false
      )

    %{
      conn: Accounts.log_in_conn(conn, manager),
      sales_rep: sales_rep,
      acme: acme,
      ada: ada,
      deal: deal
    }
  end

  test "the deal editor lists contacts by full name", %{conn: conn, deal: deal} do
    {:ok, editor, _html} = live(conn, ~p"/deals/#{deal.id}/edit")

    assert editor |> element("#deal-contact") |> render() =~ "Ada Lovelace"
  end

  test "editing a deal updates its name", %{conn: conn, deal: deal} do
    {:ok, editor, _html} = live(conn, ~p"/deals/#{deal.id}/edit")

    editor |> form("#deal-form", deal: %{name: "Bigger-deal"}) |> render_change()
    editor |> element("#save-deal") |> render_click()

    assert editor |> element("#deal-name") |> render() =~ "Bigger-deal"
  end
end
