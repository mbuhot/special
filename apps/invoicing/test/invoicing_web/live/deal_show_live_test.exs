defmodule InvoicingWeb.DealShowLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Clock, CRM, Pipeline}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: "sales@example.com", role: :sales},
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

  defp create_task(deal, sales_rep, due_date) do
    Pipeline.create_task!(%{title: "Send-proposal", due_date: due_date, deal_id: deal.id},
      actor: sales_rep
    )
  end

  test "a completed task is no longer overdue", %{conn: conn, deal: deal, sales_rep: sales_rep} do
    deal |> create_task(sales_rep, ~D[2026-01-10]) |> Pipeline.complete_task!(actor: sales_rep)

    {:ok, view, _html} = live(conn, ~p"/deals/#{deal.id}")

    refute has_element?(view, "#overdue-tasks")
  end

  test "a board card links the deal name to the deal page", %{conn: conn, deal: deal} do
    {:ok, board, _html} = live(conn, ~p"/pipeline")

    {:ok, page, _html} =
      board |> element("#deal-#{deal.id} a") |> render_click() |> follow_redirect(conn)

    assert page |> element("#deal-name") |> render() =~ "Big deal"
  end
end
