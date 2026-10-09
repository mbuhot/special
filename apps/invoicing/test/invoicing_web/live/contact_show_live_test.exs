defmodule InvoicingWeb.ContactShowLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, Clock, CRM}

  setup %{conn: conn} do
    sales_rep =
      Accounts.create_user!(%{email: "sales@example.com", role: :sales},
        authorize?: false
      )

    acme = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    ada =
      CRM.create_contact!(
        %{first_name: "Ada", last_name: "Lovelace", company_id: acme.id},
        authorize?: false
      )

    Clock.freeze(~U[2026-01-15 09:00:00Z])
    on_exit(&Clock.unfreeze/0)

    %{conn: Accounts.log_in_conn(conn, sales_rep), sales_rep: sales_rep, ada: ada}
  end

  defp timeline(view), do: view |> element("#timeline") |> render()

  test "the timeline lists a contact's activities newest first", %{
    conn: conn,
    sales_rep: sales_rep,
    ada: ada
  } do
    for {body, occurred_at} <- [
          {"Intro-call", ~U[2026-01-10 10:00:00Z]},
          {"Follow-up", ~U[2026-01-12 10:00:00Z]}
        ] do
      CRM.create_activity!(
        %{kind: :call, body: body, occurred_at: occurred_at, contact_id: ada.id},
        actor: sales_rep
      )
    end

    {:ok, view, _html} = live(conn, ~p"/contacts/#{ada.id}")

    assert view |> element("#contact-name") |> render() =~ "Ada Lovelace"
    assert [_, follow_up_onward] = String.split(timeline(view), "Follow-up")
    assert follow_up_onward =~ "Intro-call"
    assert timeline(view) =~ "2026-01-12"
  end

  test "logging a note records the date of the current clock time", %{conn: conn, ada: ada} do
    {:ok, view, _html} = live(conn, ~p"/contacts/#{ada.id}")

    view
    |> form("#activity-form", activity: %{kind: "note", body: "Called-about-renewal"})
    |> render_change()

    view |> element("#log-activity") |> render_click()

    assert timeline(view) =~ "Called-about-renewal"
    assert timeline(view) =~ "2026-01-15"
  end

  test "an activity logged after the clock advances carries the later date", %{
    conn: conn,
    ada: ada
  } do
    {:ok, view, _html} = live(conn, ~p"/contacts/#{ada.id}")
    Clock.freeze(~U[2026-01-17 09:00:00Z])

    view
    |> form("#activity-form", activity: %{kind: "meeting", body: "Kickoff"})
    |> render_change()

    view |> element("#log-activity") |> render_click()

    assert timeline(view) =~ "2026-01-17"
  end

  test "the contact list links each name to the contact page", %{conn: conn, ada: ada} do
    {:ok, view, _html} = live(conn, ~p"/contacts")

    {:ok, page, _html} =
      view |> element("#contact-#{ada.id} a") |> render_click() |> follow_redirect(conn)

    assert page |> element("#contact-name") |> render() =~ "Ada Lovelace"
  end
end
