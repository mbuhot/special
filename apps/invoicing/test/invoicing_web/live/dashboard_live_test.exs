defmodule InvoicingWeb.DashboardLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Billing, Clock, CRM, Pipeline}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{email: "sales@example.com", role: :sales}, authorize?: false)

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    Clock.freeze(~U[2026-01-15 09:00:00Z])
    on_exit(&Clock.unfreeze/0)

    %{conn: Accounts.log_in_conn(conn, sales_rep), sales_rep: sales_rep, acme: acme}
  end

  defp create_deal(name, acme, sales_rep) do
    Pipeline.create_deal!(%{name: name, company_id: acme.id, owner_id: sales_rep.id},
      authorize?: false
    )
  end

  defp create_task(deal, due_date, sales_rep) do
    Pipeline.create_task!(
      %{title: "Follow-up", due_date: due_date, deal_id: deal.id, assignee_id: sales_rep.id},
      authorize?: false
    )
  end

  defp create_invoice(number, acme) do
    Billing.create_invoice!(%{number: number, company_id: acme.id}, authorize?: false)
  end

  test "counts open deals per stage and leaves out closed deals", %{
    conn: conn,
    acme: acme,
    sales_rep: sales_rep
  } do
    create_deal("Lead one", acme, sales_rep)
    create_deal("Lead two", acme, sales_rep)

    "Proposal one"
    |> create_deal(acme, sales_rep)
    |> Pipeline.qualify_deal!(authorize?: false)
    |> Pipeline.propose_deal!(authorize?: false)

    "Won one"
    |> create_deal(acme, sales_rep)
    |> Pipeline.qualify_deal!(authorize?: false)
    |> Pipeline.propose_deal!(authorize?: false)
    |> Pipeline.win_deal!(authorize?: false)

    {:ok, view, _html} = live(conn, ~p"/dashboard")

    stages = view |> element("#open-deals-by-stage") |> render()
    assert stages =~ "lead 2"
    assert stages =~ "qualified 0"
    assert stages =~ "proposal 1"
    refute stages =~ "won"
  end

  test "counts open tasks due before today as overdue", %{
    conn: conn,
    acme: acme,
    sales_rep: sales_rep
  } do
    deal = create_deal("Big deal", acme, sales_rep)
    create_task(deal, ~D[2026-01-10], sales_rep)
    create_task(deal, ~D[2026-02-01], sales_rep)
    create_task(deal, ~D[2026-01-15], sales_rep)

    done_task = create_task(deal, ~D[2026-01-05], sales_rep)
    Pipeline.complete_task!(done_task, authorize?: false)

    {:ok, view, _html} = live(conn, ~p"/dashboard")

    assert view |> element("#overdue-tasks-count") |> render() =~ ">1<"
  end

  test "counts draft and sent invoices as unpaid", %{conn: conn, acme: acme} do
    "INV-001" |> create_invoice(acme) |> Billing.send_invoice!(authorize?: false)

    "INV-002"
    |> create_invoice(acme)
    |> Billing.send_invoice!(authorize?: false)
    |> Billing.mark_invoice_paid!(authorize?: false)

    create_invoice("INV-003", acme)

    {:ok, view, _html} = live(conn, ~p"/dashboard")

    assert view |> element("#unpaid-invoices-count") |> render() =~ ">2<"
  end

  test "logging in lands on the dashboard", %{conn: conn, sales_rep: sales_rep} do
    {:ok, view, _html} = live(conn, ~p"/login")

    login_form = form(view, "#login-form", login: %{email: sales_rep.email})
    render_submit(login_form)
    logged_in_conn = submit_form(login_form, conn)

    assert redirected_to(logged_in_conn) == "/dashboard"

    {:ok, dashboard_view, _html} = live(recycle(logged_in_conn), ~p"/dashboard")

    assert has_element?(dashboard_view, "#open-deals-by-stage")
  end
end
