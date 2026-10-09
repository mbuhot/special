defmodule Invoicing.Billing do
  @moduledoc "Customers, invoices and line items."

  use Ash.Domain

  resources do
    resource Invoicing.Billing.Customer do
      define :create_customer, action: :create
      define :list_customers, action: :read
    end

    resource Invoicing.Billing.Invoice do
      define :create_invoice, action: :create
      define :update_invoice, action: :update
      define :get_invoice, action: :read, get_by: [:id]
      define :list_invoices, action: :read
      define :send_invoice, action: :send
      define :mark_invoice_paid, action: :mark_paid
      define :void_invoice, action: :void
    end

    resource Invoicing.Billing.LineItem do
      define :create_line_item, action: :create
      define :update_line_item, action: :update
      define :get_line_item, action: :read, get_by: [:id]
    end
  end

  @doc "Returns the next unused invoice number of the form INV-<n>."
  def next_invoice_number do
    highest_sequence =
      list_invoices!()
      |> Enum.map(& &1.number)
      |> Enum.flat_map(&sequence_of/1)
      |> Enum.max(fn -> 0 end)

    "INV-#{highest_sequence + 1}"
  end

  defp sequence_of(number) do
    case Regex.run(~r/^INV-(\d+)$/, number) do
      [_, digits] -> [String.to_integer(digits)]
      nil -> []
    end
  end
end
