defmodule InvoicingWeb.ContactLive.Index do
  @moduledoc "Lists contacts, searchable by name and filterable by company."

  use InvoicingWeb, :live_view

  alias Invoicing.CRM
  alias Invoicing.CRM.Contact

  @impl true
  def mount(_params, _session, socket) do
    current_user = socket.assigns.current_user

    socket =
      socket
      |> assign(:can_create_contact, Ash.can?({Contact, :create}, current_user))
      |> assign(
        :companies,
        CRM.list_companies!(nil, actor: current_user, query: [sort: [name: :asc]])
      )
      |> assign(:filter_form, to_form(%{"search" => "", "company" => ""}, as: :filter))
      |> assign_contacts(%{"search" => "", "company" => ""})

    {:ok, socket}
  end

  @impl true
  def handle_event("filter", %{"filter" => filter}, socket) do
    {:noreply,
     socket |> assign(:filter_form, to_form(filter, as: :filter)) |> assign_contacts(filter)}
  end

  defp assign_contacts(socket, %{"search" => search, "company" => company_id}) do
    contacts =
      CRM.list_contacts!(search, company_id,
        actor: socket.assigns.current_user,
        load: [:full_name, :company],
        query: [sort: [last_name: :asc, first_name: :asc]]
      )

    assign(socket, :contacts, contacts)
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} current_path={@current_path}>
      <.header>
        Contacts
        <:actions>
          <.button
            :if={@can_create_contact}
            id="new-contact"
            variant="primary"
            navigate={~p"/contacts/new/edit"}
          >
            New contact
          </.button>
        </:actions>
      </.header>

      <.form for={@filter_form} id="contact-filter-form" phx-change="filter" class="flex gap-2">
        <.input
          type="search"
          id="contact-search"
          field={@filter_form[:search]}
          label="Search"
          phx-debounce="200"
        />
        <.input
          type="select"
          id="contact-company-filter"
          field={@filter_form[:company]}
          label="Company"
          prompt="All companies"
          options={Enum.map(@companies, &{&1.name, &1.id})}
        />
      </.form>

      <table id="contacts" class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Company</th>
          </tr>
        </thead>
        <tbody>
          <tr :for={contact <- @contacts} id={"contact-#{contact.id}"}>
            <td>
              <.link navigate={~p"/contacts/#{contact.id}"}>{contact.full_name}</.link>
            </td>
            <td>{contact.email}</td>
            <td>{contact.company.name}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end
end
