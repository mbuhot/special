defmodule InvoicingWeb.DealShowLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Clock, CRM, Pipeline}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{email: "sales@example.com", role: :sales},
        authorize?: false
      )

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    deal =
      Pipeline.create_deal!(
        %{name: "Big deal", company_id: acme.id, owner_id: sales_rep.id},
        authorize?: false
      )

    Clock.freeze(~U[2026-01-15 09:00:00Z])
    on_exit(&Clock.unfreeze/0)

    %{conn: Accounts.log_in_conn(conn, sales_rep), sales_rep: sales_rep, deal: deal}
  end

  defp tasks_table(view), do: view |> element("#tasks") |> render()

  defp add_task(view, title, due_date) do
    view
    |> form("#task-form", task: %{title: title, due_date: due_date})
    |> render_change()

    view |> element("#add-task") |> render_click()
  end

  defp create_task(deal, sales_rep, due_date) do
    Pipeline.create_task!(%{title: "Send-proposal", due_date: due_date, deal_id: deal.id},
      actor: sales_rep
    )
  end

  test "the deal page shows the deal name and stage", %{conn: conn, deal: deal} do
    {:ok, view, _html} = live(conn, ~p"/deals/#{deal.id}")

    assert view |> element("#deal-name") |> render() =~ "Big deal"
    assert view |> element("#deal-stage") |> render() =~ "lead"
  end

  test "adding a task lists it with its due date", %{conn: conn, deal: deal} do
    {:ok, view, _html} = live(conn, ~p"/deals/#{deal.id}")

    add_task(view, "Send-proposal", "2026-01-20")

    assert tasks_table(view) =~ "Send-proposal"
    assert tasks_table(view) =~ "2026-01-20"
  end

  test "completing a task shows it as done", %{conn: conn, deal: deal, sales_rep: sales_rep} do
    create_task(deal, sales_rep, ~D[2026-01-20])
    {:ok, view, _html} = live(conn, ~p"/deals/#{deal.id}")

    view |> element("button[data-complete-task]") |> render_click()

    assert tasks_table(view) =~ "done"
    refute has_element?(view, "button[data-complete-task]")
  end

  test "overdue tasks are listed once the clock passes their due date", %{
    conn: conn,
    deal: deal,
    sales_rep: sales_rep
  } do
    create_task(deal, sales_rep, ~D[2026-01-16])
    {:ok, before_view, _html} = live(conn, ~p"/deals/#{deal.id}")

    refute has_element?(before_view, "#overdue-tasks")

    Clock.freeze(~U[2026-01-17 09:00:00Z])
    {:ok, later_view, _html} = live(conn, ~p"/deals/#{deal.id}")

    assert later_view |> element("#overdue-tasks") |> render() =~ "Send-proposal"
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
