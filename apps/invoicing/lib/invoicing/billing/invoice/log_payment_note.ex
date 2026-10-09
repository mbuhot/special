defmodule Invoicing.Billing.Invoice.LogPaymentNote do
  @moduledoc "Logs a note on the company's primary contact when an invoice is paid."

  use Ash.Resource.Change

  alias Invoicing.CRM

  @impl true
  def change(changeset, _opts, %{actor: actor}) do
    Ash.Changeset.after_action(changeset, fn _changeset, invoice ->
      with :ok <- log_note(invoice, actor), do: {:ok, invoice}
    end)
  end

  defp log_note(invoice, actor) do
    case primary_contact(invoice.company_id, actor) do
      nil -> :ok
      contact -> create_note(contact, invoice, actor)
    end
  end

  defp primary_contact(company_id, actor) do
    nil
    |> CRM.list_contacts!(company_id,
      query: [sort: [inserted_at: :asc, id: :asc], limit: 1],
      actor: actor
    )
    |> List.first()
  end

  defp create_note(contact, invoice, actor) do
    case CRM.create_activity(
           %{kind: :note, body: "Invoice #{invoice.number} paid", contact_id: contact.id},
           actor: actor
         ) do
      {:ok, _activity} -> :ok
      {:error, error} -> {:error, error}
    end
  end
end
