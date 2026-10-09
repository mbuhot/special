defmodule Invoicing.CRM do
  @moduledoc "Companies that are sold to and invoiced."

  use Ash.Domain

  resources do
    resource Invoicing.CRM.Company do
      define :create_company, action: :create
      define :list_companies, action: :read
    end
  end
end
