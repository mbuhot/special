alias Invoicing.Accounts
alias Invoicing.Billing

seed_user = fn email, role ->
  case Accounts.get_user_by_email(email, not_found_error?: false) do
    {:ok, nil} -> Accounts.create_user!(%{email: email, role: role})
    {:ok, existing_user} -> existing_user
  end
end

seed_user.("accounts@example.com", :accountant)
seed_user.("admin@example.com", :admin)

if Billing.list_customers!() == [] do
  Billing.create_customer!(%{name: "Acme", email: "billing@acme.example"})
end
