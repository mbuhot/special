defmodule Invoicing.Pipeline.TaskTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, CRM, Pipeline}

  setup do
    admin =
      Accounts.create_user!(%{name: "Admin User", email: "admin@example.com", role: :admin},
        authorize?: false
      )

    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: "sales@example.com", role: :sales},
        authorize?: false
      )

    company = CRM.create_company!(%{name: "Acme"}, actor: sales_rep)

    deal = Pipeline.create_deal!(%{name: "Big deal", company_id: company.id}, actor: sales_rep)

    %{sales_rep: sales_rep, admin: admin, deal: deal}
  end

  defp create_task(sales_rep, deal, title \\ "Send proposal", due_date \\ ~D[2026-01-20]) do
    Pipeline.create_task!(%{title: title, due_date: due_date, deal_id: deal.id},
      actor: sales_rep
    )
  end

  test "a new task is open and assigned to the user who created it", %{
    sales_rep: sales_rep,
    deal: deal
  } do
    task = create_task(sales_rep, deal)

    assert task.status == :open
    assert task.assignee_id == sales_rep.id
  end

  test "completing an open task marks it done", %{sales_rep: sales_rep, deal: deal} do
    task = create_task(sales_rep, deal)

    assert Pipeline.complete_task!(task, actor: sales_rep).status == :done
  end

  test "a done task cannot be completed again", %{sales_rep: sales_rep, deal: deal} do
    done_task = sales_rep |> create_task(deal) |> Pipeline.complete_task!(actor: sales_rep)

    assert {:error, %Ash.Error.Invalid{}} = Pipeline.complete_task(done_task, actor: sales_rep)
  end

  test "a task needs a due date", %{sales_rep: sales_rep, deal: deal} do
    assert {:error, %Ash.Error.Invalid{}} =
             Pipeline.create_task(%{title: "Send proposal", deal_id: deal.id}, actor: sales_rep)
  end

  test "a deal lists its tasks by due date", %{sales_rep: sales_rep, deal: deal} do
    create_task(sales_rep, deal, "Later", ~D[2026-02-01])
    create_task(sales_rep, deal, "Sooner", ~D[2026-01-20])

    titles = deal.id |> Pipeline.list_tasks!(actor: sales_rep) |> Enum.map(& &1.title)

    assert titles == ["Sooner", "Later"]
  end

  test "a sales rep cannot delete a task", %{sales_rep: sales_rep, deal: deal} do
    task = create_task(sales_rep, deal)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(task, actor: sales_rep)
  end

  test "an admin can delete a task", %{sales_rep: sales_rep, admin: admin, deal: deal} do
    task = create_task(sales_rep, deal)

    assert :ok = Ash.destroy(task, actor: admin)
  end
end
