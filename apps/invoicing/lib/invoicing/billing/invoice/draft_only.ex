defmodule Invoicing.Billing.Invoice.DraftOnly do
  @moduledoc "Rejects a change to an invoice, or to a line item of an invoice, whose stored status is not draft."

  use Ash.Resource.Validation

  alias Invoicing.Billing.Invoice

  @message "Only draft invoices can be edited"

  @impl true
  def validate(changeset, _opts, _context) do
    case stored_status(invoice_id(changeset)) do
      :draft -> :ok
      _other_status -> {:error, message: @message}
    end
  end

  defp invoice_id(%{resource: Invoice} = changeset), do: changeset.data.id
  defp invoice_id(changeset), do: Ash.Changeset.get_attribute(changeset, :invoice_id)

  defp stored_status(nil), do: nil

  defp stored_status(invoice_id) do
    case Ash.get(Invoice, invoice_id, authorize?: false) do
      {:ok, invoice} -> invoice.status
      {:error, _not_found} -> nil
    end
  end
end
