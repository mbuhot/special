defmodule Invoicing.Billing.Invoice.AssignSupplier do
  @moduledoc "Makes the single business the supplier of a new invoice."

  use Ash.Resource.Change

  alias Invoicing.Billing.Business

  @impl true
  def change(changeset, _opts, _context) do
    Ash.Changeset.before_action(changeset, fn changeset ->
      case Ash.Changeset.get_attribute(changeset, :supplier_id) do
        nil -> Ash.Changeset.force_change_attribute(changeset, :supplier_id, business_id())
        _given_supplier -> changeset
      end
    end)
  end

  defp business_id do
    case Ash.read_first(Business, authorize?: false) do
      {:ok, %Business{id: id}} -> id
      {:ok, nil} -> nil
    end
  end
end
