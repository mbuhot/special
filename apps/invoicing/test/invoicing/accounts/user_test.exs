defmodule Invoicing.Accounts.UserTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.Accounts

  setup do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    admin =
      Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)

    %{accountant: accountant, admin: admin}
  end

  test "an accountant cannot create a user", %{accountant: accountant} do
    assert {:error, %Ash.Error.Forbidden{}} =
             Accounts.create_user(%{email: "new@example.com", role: :accountant},
               actor: accountant
             )
  end

  test "an admin can create a user", %{admin: admin} do
    assert {:ok, %{email: "new@example.com"}} =
             Accounts.create_user(%{email: "new@example.com", role: :accountant}, actor: admin)
  end

  test "an accountant can read users", %{accountant: accountant} do
    assert {:ok, %{email: "admin@example.com"}} =
             Accounts.get_user_by_email("admin@example.com", actor: accountant)
  end
end
