defmodule InvoicingWeb.CompanyLive.Show do
  @moduledoc "Shows a company with its properties, contacts, deals and invoices."

  use InvoicingWeb, :live_view

  alias Invoicing.Billing
  alias Invoicing.CRM
  alias Invoicing.Pipeline

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user

    company = CRM.get_company!(id, actor: actor, load: [contacts: [:full_name]])

    socket =
      socket
      |> assign(:company, company)
      |> assign(:deals, Pipeline.list_company_deals!(company.id, actor: actor))
      |> assign(
        :invoices,
        Billing.list_company_invoices!(company.id, actor: actor, load: [:total])
      )
      |> assign(:can_update_company, CRM.can_update_company?(actor, company))

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app
      flash={@flash}
      current_user={@current_user}
      current_path={@current_path}
      width={:wide}
    >
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

      <div class="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <.card id="company-properties" title="Properties">
          <.property label="Domain">
            <a
              :if={@company.domain}
              href={"https://#{@company.domain}"}
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary"
            >
              {@company.domain}
            </a>
          </.property>
          <.property label="Industry">{@company.industry}</.property>
          <.property label="Created">{Format.date(@company.inserted_at)}</.property>
        </.card>

        <div class="flex min-w-0 flex-col gap-5">
          <.card title="Contacts">
            <table id="company-contacts" class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  <th class="py-2 pr-3">Name</th>
                  <th class="py-2 pr-3">Email</th>
                  <th class="py-2">Phone</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  :for={contact <- @company.contacts}
                  id={"contact-#{contact.id}"}
                  class="border-t border-base-300"
                >
                  <td class="py-3 pr-3">
                    <.link navigate={~p"/contacts/#{contact.id}"} class="font-semibold text-primary">
                      {contact.full_name}
                    </.link>
                  </td>
                  <td class="py-3 pr-3">{contact.email}</td>
                  <td class="py-3">{contact.phone}</td>
                </tr>
              </tbody>
            </table>
          </.card>

          <.card title="Deals">
            <table id="company-deals" class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  <th class="py-2 pr-3">Name</th>
                  <th class="py-2 pr-3">Stage</th>
                  <th class="py-2 pr-3 text-right">Amount</th>
                  <th class="py-2 pl-3">Close date</th>
                </tr>
              </thead>
              <tbody>
                <tr :for={deal <- @deals} id={"deal-#{deal.id}"} class="border-t border-base-300">
                  <td class="py-3 pr-3">
                    <.link navigate={~p"/deals/#{deal.id}"} class="font-semibold text-primary">
                      {deal.name}
                    </.link>
                  </td>
                  <td class="py-3 pr-3"><.badge value={deal.stage} /></td>
                  <td class="py-3 pr-3 text-right">{Format.money(deal.amount)}</td>
                  <td class="py-3 pl-3 text-base-content/80">{Format.date(deal.close_date)}</td>
                </tr>
              </tbody>
            </table>
          </.card>

          <.card title="Invoices">
            <table id="company-invoices" class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  <th class="py-2 pr-3">Number</th>
                  <th class="py-2 pr-3">Status</th>
                  <th class="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  :for={invoice <- @invoices}
                  id={"invoice-#{invoice.id}"}
                  class="border-t border-base-300"
                >
                  <td class="py-3 pr-3">
                    <.link
                      navigate={~p"/invoices/#{invoice.id}/edit"}
                      class="font-semibold text-primary"
                    >
                      {invoice.number}
                    </.link>
                  </td>
                  <td class="py-3 pr-3"><.badge value={invoice.status} /></td>
                  <td class="py-3 text-right">{Format.money(invoice.total)}</td>
                </tr>
              </tbody>
            </table>
          </.card>
        </div>
      </div>
    </Layouts.app>
    """
  end
end
