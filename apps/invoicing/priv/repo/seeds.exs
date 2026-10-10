alias Invoicing.Accounts
alias Invoicing.CRM

seed_user = fn name, email, role ->
  case Accounts.get_user_by_email(email, not_found_error?: false, authorize?: false) do
    {:ok, nil} ->
      Accounts.create_user!(%{name: name, email: email, role: role}, authorize?: false)

    {:ok, existing_user} ->
      existing_user
  end
end

seed_user.("Sam Rivera", "sales@example.com", :sales)
seed_user.("Morgan Lee", "manager@example.com", :manager)
seed_user.("Alex Chen", "accounts@example.com", :accountant)
seed_user.("Jordan Patel", "admin@example.com", :admin)

if CRM.list_companies!(nil, authorize?: false) == [] do
  CRM.create_company!(%{name: "Acme", domain: "acme.example", industry: "Manufacturing"},
    authorize?: false
  )
end

if Invoicing.Billing.list_businesses!(authorize?: false) == [] do
  Ash.Seed.seed!(Invoicing.Billing.Business, %{
    name: "Ledger Studio Pty Ltd",
    abn: "51 824 753 556"
  })
end
