defmodule InvoicingWeb.InvoiceLive.Index do
  @moduledoc "Lists invoices and creates new drafts."

  use InvoicingWeb, :live_view

  alias Invoicing.Billing
  alias Invoicing.CRM
  alias Invoicing.Billing.Invoice
  alias InvoicingWeb.AmountFormat

  @impl true
  def mount(_params, _session, socket) do
    current_user = socket.assigns.current_user

    invoices =
      Billing.list_invoices!(
        actor: current_user,
        load: [:total, :company],
        query: [sort: [number: :asc]]
      )

    socket =
      socket
      |> assign(:can_create_invoice, Ash.can?({Invoice, :create}, current_user))
      |> stream(:invoices, invoices)

    {:ok, socket}
  end

  @impl true
  def handle_event("new_invoice", _params, socket) do
    case CRM.list_companies!(
           nil,
           actor: socket.assigns.current_user,
           query: [sort: [inserted_at: :asc], limit: 1]
         ) do
      [company | _] ->
        invoice =
          Billing.create_invoice!(
            %{number: Billing.next_invoice_number(), company_id: company.id},
            actor: socket.assigns.current_user
          )

        {:noreply, push_navigate(socket, to: ~p"/invoices/#{invoice.id}/edit")}

      [] ->
        {:noreply, put_flash(socket, :error, "Create a company before creating an invoice")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        Invoices
        <:actions>
          <.button
            :if={@can_create_invoice}
            id="new-invoice"
            variant="primary"
            phx-click="new_invoice"
          >
            New invoice
          </.button>
        </:actions>
      </.header>

      <table id="invoices" class="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Company</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody id="invoice-rows" phx-update="stream">
          <tr :for={{row_id, invoice} <- @streams.invoices} id={row_id}>
            <td><.link navigate={~p"/invoices/#{invoice.id}/edit"}>{invoice.number}</.link></td>
            <td>{invoice.company.name}</td>
            <td>{invoice.status}</td>
            <td>{AmountFormat.format(invoice.total)}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end
end
