defmodule InvoicingWeb.CompanyLive.Index do
  @moduledoc "Lists companies, searchable by name."

  use InvoicingWeb, :live_view

  alias Invoicing.CRM

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:can_create_company, CRM.can_create_company?(socket.assigns.current_user))
      |> assign(:filter_form, to_form(%{"search" => ""}, as: :filter))
      |> assign_companies("")

    {:ok, socket}
  end

  @impl true
  def handle_event("filter", %{"filter" => %{"search" => search} = filter}, socket) do
    {:noreply,
     socket |> assign(:filter_form, to_form(filter, as: :filter)) |> assign_companies(search)}
  end

  defp assign_companies(socket, search) do
    companies =
      CRM.list_companies!(search,
        actor: socket.assigns.current_user,
        query: [sort: [name: :asc]]
      )

    assign(socket, :companies, companies)
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} current_path={@current_path}>
      <.header>
        Companies
        <:actions>
          <.button
            :if={@can_create_company}
            id="new-company"
            variant="primary"
            navigate={~p"/companies/new/edit"}
          >
            New company
          </.button>
        </:actions>
      </.header>

      <.form for={@filter_form} id="company-filter-form" phx-change="filter" class="flex gap-2">
        <.input
          type="search"
          id="company-search"
          field={@filter_form[:search]}
          label="Search"
          phx-debounce="200"
        />
      </.form>

      <table id="companies" class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Domain</th>
            <th>Industry</th>
          </tr>
        </thead>
        <tbody>
          <tr :for={company <- @companies} id={"company-#{company.id}"}>
            <td>
              <.link navigate={~p"/companies/#{company.id}"}>{company.name}</.link>
            </td>
            <td>{company.domain}</td>
            <td>{company.industry}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end
end
