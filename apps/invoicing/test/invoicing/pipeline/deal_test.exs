defmodule Invoicing.Pipeline.DealTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup do
    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)

    manager =
      Accounts.create_user!(%{email: "manager@example.com", role: :manager},
        authorize?: false
      )

    new_owner =
      Accounts.create_user!(%{email: "new-owner@example.com", role: :sales}, authorize?: false)

    company = CRM.create_company!(%{name: "Acme"}, actor: manager)

    %{manager: manager, admin: admin, new_owner: new_owner, company: company}
  end

  defp create_deal(manager, company, stage \\ :lead) do
    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: manager)
    Ash.Seed.update!(deal, %{stage: stage})
  end

  test "a new deal starts as a lead owned by the user who created it", %{
    manager: manager,
    company: company
  } do
    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: manager)

    assert deal.stage == :lead
    assert deal.owner_id == manager.id
  end

  test "a deal moves through qualified and proposal to won", %{
    manager: manager,
    company: company
  } do
    deal = create_deal(manager, company)

    qualified_deal = Pipeline.qualify_deal!(deal, actor: manager)
    proposed_deal = Pipeline.propose_deal!(qualified_deal, actor: manager)
    won_deal = Pipeline.win_deal!(proposed_deal, actor: manager)

    assert {qualified_deal.stage, proposed_deal.stage, won_deal.stage} ==
             {:qualified, :proposal, :won}
  end

  for stage <- [:lead, :qualified, :proposal] do
    test "a #{stage} deal can be lost", %{manager: manager, company: company} do
      deal = create_deal(manager, company, unquote(stage))

      assert Pipeline.lose_deal!(deal, actor: manager).stage == :lost
    end
  end

  test "a lead cannot be won before it is proposed", %{manager: manager, company: company} do
    deal = create_deal(manager, company)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.win_deal(deal, actor: manager)
  end

  test "a won deal cannot be lost", %{manager: manager, company: company} do
    deal = create_deal(manager, company, :won)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.lose_deal(deal, actor: manager)
  end

  test "a sales manager can reassign a deal to another user", %{
    manager: manager,
    new_owner: new_owner,
    company: company
  } do
    deal = create_deal(manager, company)

    assert Pipeline.reassign_deal!(deal, new_owner.id, actor: manager).owner_id == new_owner.id
  end

  test "a sales manager cannot delete a deal", %{manager: manager, company: company} do
    deal = create_deal(manager, company)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(deal, actor: manager)
  end

  test "an admin can delete a deal", %{manager: manager, admin: admin, company: company} do
    deal = create_deal(manager, company)

    assert :ok = Ash.destroy(deal, actor: admin)
  end
end
