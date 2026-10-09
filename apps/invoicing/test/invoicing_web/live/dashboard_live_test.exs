defmodule InvoicingWeb.DashboardLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Clock, CRM, Pipeline}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{email: "sales@example.com", role: :sales}, authorize?: false)

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    Clock.freeze(~U[2026-01-15 09:00:00Z])

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

    assert view |> element("#overdue-tasks-count") |> render() =~ ~r/>\s*1\s*</
  end

  defp create_activity(contact, kind, body, occurred_at, sales_rep) do
    CRM.create_activity!(
      %{
        kind: kind,
        body: body,
        occurred_at: occurred_at,
        contact_id: contact.id,
        user_id: sales_rep.id
      },
      authorize?: false
    )
  end

  test "lists the five most recent activities across contacts, newest first", %{
    conn: conn,
    acme: acme,
    sales_rep: sales_rep
  } do
    ada =
      CRM.create_contact!(%{first_name: "Ada", last_name: "Lovelace", company_id: acme.id},
        authorize?: false
      )

    for day <- 1..6 do
      occurred_at = DateTime.new!(Date.new!(2026, 1, day), ~T[09:00:00], "Etc/UTC")
      create_activity(ada, :call, "Call on day #{day}", occurred_at, sales_rep)
    end

    {:ok, view, _html} = live(conn, ~p"/dashboard")

    recent = view |> element("#recent-activity") |> render()
    assert recent =~ "Call on day 6"
    assert recent =~ "Call on day 2"
    refute recent =~ "Call on day 1<"
    assert recent =~ "Ada Lovelace"
    assert recent =~ "Call"
    assert recent =~ "6 Jan 2026"

    assert recent |> :binary.match("Call on day 6") |> elem(0) <
             recent |> :binary.match("Call on day 5") |> elem(0)
  end

  test "links a recent activity to its contact", %{conn: conn, acme: acme, sales_rep: sales_rep} do
    ada =
      CRM.create_contact!(%{first_name: "Ada", last_name: "Lovelace", company_id: acme.id},
        authorize?: false
      )

    create_activity(ada, :note, "Prefers email", ~U[2026-01-10 09:00:00Z], sales_rep)

    {:ok, view, _html} = live(conn, ~p"/dashboard")

    view |> element("#recent-activity a", "Ada Lovelace") |> render_click()

    assert_redirect(view, ~p"/contacts/#{ada.id}")
  end

  test "says there is no activity when none is logged", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/dashboard")

    assert view |> element("#recent-activity") |> render() =~ "No activity yet"
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
