defmodule InvoicingWeb.DealLiveTest do
  use InvoicingWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup %{conn: conn} do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
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
        %{name: "Big deal", amount: "12000", company_id: acme.id, owner_id: accountant.id},
        authorize?: false
      )

    %{conn: Accounts.log_in_conn(conn, accountant), acme: acme, ada: ada, deal: deal}
  end

  defp column(view, stage), do: view |> element("#column-#{stage}") |> render()

  defp move(view, transition) do
    view |> element("button[data-transition='#{transition}']") |> render_click()
  end

  test "the board shows a column per stage with the deal card in its stage", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    for stage <- [:qualified, :proposal, :won, :lost] do
      refute column(view, stage) =~ "Big deal"
    end

    assert column(view, :lead) =~ "Big deal"
    assert column(view, :lead) =~ "12000"
    assert column(view, :lead) =~ "Acme"
  end

  test "a lead card offers Qualify and Lose", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    assert has_element?(view, "#column-lead button[data-transition='qualify']")
    assert has_element?(view, "#column-lead button[data-transition='lose']")
    refute has_element?(view, "#column-lead button[data-transition='win']")
  end

  test "qualifying a lead moves it to the qualified column", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    move(view, "qualify")

    assert column(view, :qualified) =~ "Big deal"
    refute column(view, :lead) =~ "Big deal"
  end

  test "proposing a qualified deal moves it to the proposal column", %{conn: conn, deal: deal} do
    Pipeline.qualify_deal!(deal, authorize?: false)
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    move(view, "propose")

    assert column(view, :proposal) =~ "Big deal"
    refute column(view, :qualified) =~ "Big deal"
  end

  test "winning a proposal moves it to the won column", %{conn: conn, deal: deal} do
    deal |> Pipeline.qualify_deal!(authorize?: false) |> Pipeline.propose_deal!(authorize?: false)
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    move(view, "win")

    assert column(view, :won) =~ "Big deal"
    refute column(view, :proposal) =~ "Big deal"
  end

  test "losing a lead moves it to the lost column", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    move(view, "lose")

    assert column(view, :lost) =~ "Big deal"
    refute column(view, :lead) =~ "Big deal"
  end

  test "a won deal offers no moves", %{conn: conn, deal: deal} do
    deal
    |> Pipeline.qualify_deal!(authorize?: false)
    |> Pipeline.propose_deal!(authorize?: false)
    |> Pipeline.win_deal!(authorize?: false)

    {:ok, view, _html} = live(conn, ~p"/pipeline")

    refute has_element?(view, "#column-won button[data-transition]")
  end

  test "creating a deal shows its name in the lead stage", %{conn: conn, acme: acme, ada: ada} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    {:ok, editor, _html} =
      view |> element("#new-deal") |> render_click() |> follow_redirect(conn)

    editor
    |> form("#deal-form",
      deal: %{
        name: "New-deal",
        amount: "5000",
        close_date: "2026-03-31",
        company_id: acme.id,
        contact_id: ada.id
      }
    )
    |> render_change()

    editor |> element("#save-deal") |> render_click()

    assert editor |> element("#deal-name") |> render() =~ "New-deal"
    assert editor |> element("#deal-stage") |> render() =~ "lead"
    assert_patch(editor)
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
