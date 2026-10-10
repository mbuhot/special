defmodule InvoicingWeb.DealLiveTest do
  use InvoicingWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup %{conn: conn} do
    manager =
      Accounts.create_user!(%{name: "Manager User", email: "manager@example.com", role: :manager},
        authorize?: false
      )

    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: "sales@example.com", role: :sales},
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

  defp column(view, stage), do: view |> element("#column-#{stage}") |> render()

  test "a lead card offers Qualify and Lose", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/pipeline")

    assert has_element?(view, "#column-lead button[data-transition='qualify']")
    assert has_element?(view, "#column-lead button[data-transition='lose']")
    refute has_element?(view, "#column-lead button[data-transition='win']")
  end

  test "a sales rep does not see Win or Lose on the board", %{
    conn: conn,
    deal: deal,
    sales_rep: sales_rep
  } do
    deal |> Pipeline.qualify_deal!(authorize?: false) |> Pipeline.propose_deal!(authorize?: false)

    {:ok, view, _html} = live(Accounts.log_in_conn(conn, sales_rep), ~p"/pipeline")

    assert column(view, :proposal) =~ "Big deal"
    refute has_element?(view, "#column-proposal button", "Win")
    refute has_element?(view, "#column-proposal button", "Lose")
  end

  test "a won deal offers no moves", %{conn: conn, deal: deal} do
    deal
    |> Pipeline.qualify_deal!(authorize?: false)
    |> Pipeline.propose_deal!(authorize?: false)
    |> Pipeline.win_deal!(authorize?: false)

    {:ok, view, _html} = live(conn, ~p"/pipeline")

    refute has_element?(view, "#column-won button[data-transition]")
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
