alias Invoicing.Accounts
alias Invoicing.CRM

seed_user = fn email, role ->
  case Accounts.get_user_by_email(email, not_found_error?: false, authorize?: false) do
    {:ok, nil} -> Accounts.create_user!(%{email: email, role: role}, authorize?: false)
    {:ok, existing_user} -> existing_user
  end
end

seed_user.("sales@example.com", :sales)
seed_user.("manager@example.com", :manager)
seed_user.("accounts@example.com", :accountant)
seed_user.("admin@example.com", :admin)

if CRM.list_companies!(authorize?: false) == [] do
  CRM.create_company!(%{name: "Acme", domain: "acme.example", industry: "Manufacturing"},
    authorize?: false
  )
end
