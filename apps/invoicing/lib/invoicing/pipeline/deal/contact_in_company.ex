defmodule Invoicing.Pipeline.Deal.ContactInCompany do
  @moduledoc "Rejects a deal whose contact belongs to a different company than the deal."

  use Ash.Resource.Validation

  @message "must belong to the deal's company"

  @impl true
  def validate(changeset, _opts, _context) do
    contact_id = Ash.Changeset.get_attribute(changeset, :contact_id)
    company_id = Ash.Changeset.get_attribute(changeset, :company_id)

    if contact_company_id(changeset.resource, contact_id) in [:no_contact, company_id] do
      :ok
    else
      {:error, field: :contact_id, message: @message}
    end
  end

  defp contact_company_id(_resource, nil), do: :no_contact

  defp contact_company_id(resource, contact_id) do
    contact_resource =
      resource |> Ash.Resource.Info.relationship(:contact) |> Map.fetch!(:destination)

    case Ash.get(contact_resource, contact_id, authorize?: false) do
      {:ok, contact} -> contact.company_id
      {:error, _not_found} -> :unknown_contact
    end
  end
end
