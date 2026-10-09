defmodule Invoicing.Repo.Migrations.RenameCustomerToCompany do
  @moduledoc """
  Renames customers to companies and replaces email with domain and industry.
  """

  use Ecto.Migration

  def up do
    rename table(:customers), to: table(:companies)
    rename table(:invoices), :customer_id, to: :company_id

    execute "ALTER TABLE invoices RENAME CONSTRAINT invoices_customer_id_fkey TO invoices_company_id_fkey"

    alter table(:companies) do
      add :domain, :text
      add :industry, :text
      remove :email
    end
  end

  def down do
    alter table(:companies) do
      add :email, :text
      remove :industry
      remove :domain
    end

    execute "ALTER TABLE invoices RENAME CONSTRAINT invoices_company_id_fkey TO invoices_customer_id_fkey"

    rename table(:invoices), :company_id, to: :customer_id
    rename table(:companies), to: table(:customers)
  end
end
