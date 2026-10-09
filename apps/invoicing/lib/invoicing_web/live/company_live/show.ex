defmodule InvoicingWeb.CompanyLive.Show do
  @moduledoc "Shows a company with its contacts and invoices."

  use InvoicingWeb, :live_view

  alias Invoicing.CRM

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user

    company =
      CRM.get_company!(id,
        actor: actor,
        load: [:invoices, contacts: Ash.Query.load(Invoicing.CRM.Contact, :full_name)]
      )

    socket =
      socket
      |> assign(:company, company)
      |> assign(:can_update_company, Ash.can?({company, :update}, actor))

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        <span id="company-name">{@company.name}</span>
        <:actions>
          <.button
            :if={@can_update_company}
            id="edit-company"
            variant="primary"
            navigate={~p"/companies/#{@company.id}/edit"}
          >
            Edit company
          </.button>
        </:actions>
      </.header>

      <table id="company-contacts" class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          <tr :for={contact <- @company.contacts} id={"contact-#{contact.id}"}>
            <td>{contact.full_name}</td>
            <td>{contact.email}</td>
          </tr>
        </tbody>
      </table>

      <table id="company-invoices" class="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr :for={invoice <- @company.invoices} id={"invoice-#{invoice.id}"}>
            <td>{invoice.number}</td>
            <td>{invoice.status}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end
end
