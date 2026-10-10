defmodule Invoicing.Billing do
  @moduledoc "Invoices and line items."

  use Ash.Domain, extensions: [AshBoundary]

  boundary do
    deps([Invoicing, Invoicing.CRM])
  end

  require Ash.Query

  resources do
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
      define :remove_line_item, action: :destroy
    end
  end

  @doc "Lists the company's invoices ordered by invoice sequence."
  def list_company_invoices(company_id, opts \\ []) do
    list_invoices(with_company_query(opts, company_id))
  end

  @doc "Lists the company's invoices ordered by invoice sequence, raising on error."
  def list_company_invoices!(company_id, opts \\ []) do
    list_invoices!(with_company_query(opts, company_id))
  end

  defp with_company_query(opts, company_id) do
    Keyword.put(opts, :query,
      filter: [company_id: company_id],
      sort: [sequence: :asc, number: :asc]
    )
  end

  @doc "Returns the human readable messages of an error returned by an action."
  def error_messages(error) do
    error
    |> Ash.Error.to_error_class()
    |> Map.fetch!(:errors)
    |> Enum.map(&error_message/1)
  end

  defp error_message(%Ash.Error.Changes.Required{field: field}),
    do: "#{field_label(field)} is required"

  defp error_message(%{message: message} = error) when is_binary(message) do
    text =
      Enum.reduce(Map.get(error, :vars) || [], message, fn {key, value}, text ->
        String.replace(text, "%{#{key}}", to_string(value))
      end)

    case Map.get(error, :field) do
      nil -> text
      field -> "#{field_label(field)} #{text}"
    end
  end

  defp error_message(error), do: Exception.message(error)

  defp field_label(field),
    do: field |> to_string() |> String.replace("_", " ") |> String.capitalize()

  @doc "Returns the number of invoices in status draft or sent."
  def count_unpaid_invoices(actor) do
    Invoicing.Billing.Invoice
    |> Ash.Query.filter(status in [:draft, :sent])
    |> Ash.count!(actor: actor)
  end
end
