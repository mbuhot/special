defmodule Invoicing.Accounts.UserTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.Accounts

  setup do
    accountant =
      Accounts.create_user!(
        %{name: "Accounts User", email: unique_email("accounts"), role: :accountant},
        authorize?: false
      )

    admin =
      Accounts.create_user!(%{name: "Admin User", email: unique_email("admin"), role: :admin},
        authorize?: false
      )

    %{accountant: accountant, admin: admin}
  end

  test "an accountant cannot create a user", %{accountant: accountant} do
    assert {:error, %Ash.Error.Forbidden{}} =
             Accounts.create_user(
               %{name: "New User", email: unique_email("new"), role: :accountant},
               actor: accountant
             )
  end

  test "an admin can create a user", %{admin: admin} do
    new_email = unique_email("new")

    assert {:ok, %{email: ^new_email}} =
             Accounts.create_user(
               %{name: "New User", email: new_email, role: :accountant},
               actor: admin
             )
  end

  test "an accountant can read users", %{accountant: accountant, admin: admin} do
    assert {:ok, %{email: admin_email}} =
             Accounts.get_user_by_email(admin.email, actor: accountant)

    assert admin_email == admin.email
  end
end
