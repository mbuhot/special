defmodule InvoicingWeb.InvoiceLive.Index do
  @moduledoc "Lists invoices and creates new drafts."

  use InvoicingWeb, :live_view

  alias Invoicing.Billing
  alias InvoicingWeb.AmountFormat

  @impl true
  def mount(_params, _session, socket) do
    invoices = Billing.list_invoices!(load: [:total, :customer], query: [sort: [number: :asc]])
    {:ok, stream(socket, :invoices, invoices)}
  end

  @impl true
  def handle_event("new_invoice", _params, socket) do
    case Billing.list_customers!(query: [sort: [inserted_at: :asc], limit: 1]) do
      [customer | _] ->
        invoice =
          Billing.create_invoice!(%{
            number: Billing.next_invoice_number(),
            customer_id: customer.id
          })

        {:noreply, push_navigate(socket, to: ~p"/invoices/#{invoice.id}/edit")}

      [] ->
        {:noreply, put_flash(socket, :error, "Create a customer before creating an invoice")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        Invoices
        <:actions>
          <.button id="new-invoice" variant="primary" phx-click="new_invoice">New invoice</.button>
        </:actions>
      </.header>

      <table id="invoices" class="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody id="invoice-rows" phx-update="stream">
          <tr :for={{row_id, invoice} <- @streams.invoices} id={row_id}>
            <td><.link navigate={~p"/invoices/#{invoice.id}/edit"}>{invoice.number}</.link></td>
            <td>{invoice.customer.name}</td>
            <td>{invoice.status}</td>
            <td>{AmountFormat.format(invoice.total)}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end
end
