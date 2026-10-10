defmodule Invoicing.CRM.ActivityTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, Clock, CRM}

  setup do
    admin =
      Accounts.create_user!(%{name: "Admin User", email: unique_email("admin"), role: :admin},
        authorize?: false
      )

    sales_rep =
      Accounts.create_user!(%{name: "Sales User", email: unique_email("sales"), role: :sales},
        authorize?: false
      )

    company = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    ada =
      CRM.create_contact!(
        %{first_name: "Ada", last_name: "Lovelace", company_id: company.id},
        authorize?: false
      )

    %{sales_rep: sales_rep, admin: admin, ada: ada}
  end

  defp log_note(contact, actor, attrs \\ %{}) do
    CRM.create_activity!(
      Map.merge(%{kind: :note, body: "Called about renewal", contact_id: contact.id}, attrs),
      actor: actor
    )
  end

  test "a sales rep can log an activity authored by themselves", %{
    sales_rep: sales_rep,
    ada: ada
  } do
    activity = log_note(ada, sales_rep)

    assert {activity.kind, activity.user_id} == {:note, sales_rep.id}
  end

  test "an activity without a time occurs at the current clock time", %{
    sales_rep: sales_rep,
    ada: ada
  } do
    Clock.freeze(~U[2026-01-15 09:00:00Z])

    assert log_note(ada, sales_rep).occurred_at == ~U[2026-01-15 09:00:00Z]
  end

  test "an activity keeps the time it was given", %{sales_rep: sales_rep, ada: ada} do
    Clock.freeze(~U[2026-01-15 09:00:00Z])

    activity = log_note(ada, sales_rep, %{occurred_at: ~U[2026-01-10 10:00:00Z]})

    assert activity.occurred_at == ~U[2026-01-10 10:00:00Z]
  end

  test "a contact's activities are listed newest first", %{sales_rep: sales_rep, ada: ada} do
    log_note(ada, sales_rep, %{body: "Intro call", occurred_at: ~U[2026-01-10 10:00:00Z]})
    log_note(ada, sales_rep, %{body: "Follow up", occurred_at: ~U[2026-01-12 10:00:00Z]})

    bodies = ada.id |> CRM.list_activities!(actor: sales_rep) |> Enum.map(& &1.body)

    assert bodies == ["Follow up", "Intro call"]
  end

  test "an activity must be one of the known kinds", %{sales_rep: sales_rep, ada: ada} do
    assert {:error, %Ash.Error.Invalid{}} =
             CRM.create_activity(
               %{kind: :carrier_pigeon, body: "Hello", contact_id: ada.id},
               actor: sales_rep
             )
  end

  test "a sales rep cannot delete an activity", %{sales_rep: sales_rep, ada: ada} do
    activity = log_note(ada, sales_rep)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(activity, actor: sales_rep)
  end

  test "an admin can delete an activity", %{sales_rep: sales_rep, admin: admin, ada: ada} do
    activity = log_note(ada, sales_rep)

    assert :ok = Ash.destroy(activity, actor: admin)
  end
end
