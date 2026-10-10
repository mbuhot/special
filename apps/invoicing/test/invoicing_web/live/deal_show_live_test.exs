defmodule InvoicingWeb.DealShowLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Clock, CRM, Pipeline}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: unique_email("sales"), role: :sales},
        authorize?: false
      )

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    deal =
      Pipeline.create_deal!(
        %{name: "Big deal", company_id: acme.id, owner_id: sales_rep.id},
        authorize?: false
      )

    Clock.freeze(~U[2026-01-15 09:00:00Z])

    %{conn: Accounts.log_in_conn(conn, sales_rep), sales_rep: sales_rep, deal: deal}
  end

  test "a board card links the deal name to the deal page", %{conn: conn, deal: deal} do
    {:ok, board, _html} = live(conn, ~p"/pipeline")

    {:ok, page, _html} =
      board |> element("#deal-#{deal.id} a") |> render_click() |> follow_redirect(conn)

    assert page |> element("#deal-name") |> render() =~ "Big deal"
  end
end
