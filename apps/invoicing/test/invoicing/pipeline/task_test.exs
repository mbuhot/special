defmodule Invoicing.Pipeline.TaskTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)
    company = CRM.create_company!(%{name: "Acme"}, actor: accountant)

    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: accountant)

    %{accountant: accountant, admin: admin, deal: deal}
  end

  defp create_task(accountant, deal, title \\ "Send proposal", due_date \\ ~D[2026-01-20]) do
    Pipeline.create_task!(%{title: title, due_date: due_date, deal_id: deal.id},
      actor: accountant
    )
  end

  test "a new task is open and assigned to the user who created it", %{
    accountant: accountant,
    deal: deal
  } do
    task = create_task(accountant, deal)

    assert task.status == :open
    assert task.assignee_id == accountant.id
  end

  test "completing an open task marks it done", %{accountant: accountant, deal: deal} do
    task = create_task(accountant, deal)

    assert Pipeline.complete_task!(task, actor: accountant).status == :done
  end

  test "a done task cannot be completed again", %{accountant: accountant, deal: deal} do
    done_task = accountant |> create_task(deal) |> Pipeline.complete_task!(actor: accountant)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.complete_task(done_task, actor: accountant)
  end

  test "a task needs a due date", %{accountant: accountant, deal: deal} do
    assert {:error, %Ash.Error.Invalid{}} =
             Pipeline.create_task(%{title: "Send proposal", deal_id: deal.id}, actor: accountant)
  end

  test "a deal lists its tasks by due date", %{accountant: accountant, deal: deal} do
    create_task(accountant, deal, "Later", ~D[2026-02-01])
    create_task(accountant, deal, "Sooner", ~D[2026-01-20])

    titles = deal.id |> Pipeline.list_tasks!(actor: accountant) |> Enum.map(& &1.title)

    assert titles == ["Sooner", "Later"]
  end

  test "an accountant cannot delete a task", %{accountant: accountant, deal: deal} do
    task = create_task(accountant, deal)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(task, actor: accountant)
  end

  test "an admin can delete a task", %{accountant: accountant, admin: admin, deal: deal} do
    task = create_task(accountant, deal)

    assert :ok = Ash.destroy(task, actor: admin)
  end
end
