defmodule Invoicing.Pipeline.DealTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)
    company = CRM.create_company!(%{name: "Acme"}, actor: accountant)

    %{accountant: accountant, admin: admin, company: company}
  end

  defp create_deal(accountant, company, stage \\ :lead) do
    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: accountant)
    Ash.Seed.update!(deal, %{stage: stage})
  end

  test "a new deal starts as a lead owned by the user who created it", %{
    accountant: accountant,
    company: company
  } do
    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: accountant)

    assert deal.stage == :lead
    assert deal.owner_id == accountant.id
  end

  test "a deal moves through qualified and proposal to won", %{
    accountant: accountant,
    company: company
  } do
    deal = create_deal(accountant, company)

    qualified_deal = Pipeline.qualify_deal!(deal, actor: accountant)
    proposed_deal = Pipeline.propose_deal!(qualified_deal, actor: accountant)
    won_deal = Pipeline.win_deal!(proposed_deal, actor: accountant)

    assert {qualified_deal.stage, proposed_deal.stage, won_deal.stage} ==
             {:qualified, :proposal, :won}
  end

  for stage <- [:lead, :qualified, :proposal] do
    test "a #{stage} deal can be lost", %{accountant: accountant, company: company} do
      deal = create_deal(accountant, company, unquote(stage))

      assert Pipeline.lose_deal!(deal, actor: accountant).stage == :lost
    end
  end

  test "a lead cannot be won before it is proposed", %{accountant: accountant, company: company} do
    deal = create_deal(accountant, company)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.win_deal(deal, actor: accountant)
  end

  test "a won deal cannot be lost", %{accountant: accountant, company: company} do
    deal = create_deal(accountant, company, :won)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.lose_deal(deal, actor: accountant)
  end

  test "an accountant cannot delete a deal", %{accountant: accountant, company: company} do
    deal = create_deal(accountant, company)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(deal, actor: accountant)
  end

  test "an admin can delete a deal", %{accountant: accountant, admin: admin, company: company} do
    deal = create_deal(accountant, company)

    assert :ok = Ash.destroy(deal, actor: admin)
  end
end
