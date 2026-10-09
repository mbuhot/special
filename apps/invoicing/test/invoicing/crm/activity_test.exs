defmodule Invoicing.CRM.ActivityTest do
  use Invoicing.DataCase

  alias Invoicing.{Accounts, Clock, CRM}

  setup do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)
    company = CRM.create_company!(%{name: "Acme"}, authorize?: false)

    ada =
      CRM.create_contact!(
        %{first_name: "Ada", last_name: "Lovelace", company_id: company.id},
        authorize?: false
      )

    on_exit(&Clock.unfreeze/0)

    %{accountant: accountant, admin: admin, ada: ada}
  end

  defp log_note(contact, actor, attrs \\ %{}) do
    CRM.create_activity!(
      Map.merge(%{kind: :note, body: "Called about renewal", contact_id: contact.id}, attrs),
      actor: actor
    )
  end

  test "an accountant can log an activity authored by themselves", %{
    accountant: accountant,
    ada: ada
  } do
    activity = log_note(ada, accountant)

    assert {activity.kind, activity.user_id} == {:note, accountant.id}
  end

  test "an activity without a time occurs at the current clock time", %{
    accountant: accountant,
    ada: ada
  } do
    Clock.freeze(~U[2026-01-15 09:00:00Z])

    assert log_note(ada, accountant).occurred_at == ~U[2026-01-15 09:00:00Z]
  end

  test "an activity keeps the time it was given", %{accountant: accountant, ada: ada} do
    Clock.freeze(~U[2026-01-15 09:00:00Z])

    activity = log_note(ada, accountant, %{occurred_at: ~U[2026-01-10 10:00:00Z]})

    assert activity.occurred_at == ~U[2026-01-10 10:00:00Z]
  end

  test "a contact's activities are listed newest first", %{accountant: accountant, ada: ada} do
    log_note(ada, accountant, %{body: "Intro call", occurred_at: ~U[2026-01-10 10:00:00Z]})
    log_note(ada, accountant, %{body: "Follow up", occurred_at: ~U[2026-01-12 10:00:00Z]})

    bodies = ada.id |> CRM.list_activities!(actor: accountant) |> Enum.map(& &1.body)

    assert bodies == ["Follow up", "Intro call"]
  end

  test "an activity must be one of the known kinds", %{accountant: accountant, ada: ada} do
    assert {:error, %Ash.Error.Invalid{}} =
             CRM.create_activity(
               %{kind: :carrier_pigeon, body: "Hello", contact_id: ada.id},
               actor: accountant
             )
  end

  test "an accountant cannot delete an activity", %{accountant: accountant, ada: ada} do
    activity = log_note(ada, accountant)

    assert {:error, %Ash.Error.Forbidden{}} = Ash.destroy(activity, actor: accountant)
  end

  test "an admin can delete an activity", %{accountant: accountant, admin: admin, ada: ada} do
    activity = log_note(ada, accountant)

    assert :ok = Ash.destroy(activity, actor: admin)
  end
end
