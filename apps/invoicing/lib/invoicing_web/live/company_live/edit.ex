defmodule InvoicingWeb.CompanyLive.Edit do
  @moduledoc "Creates a company or edits an existing one."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.CRM
  alias Invoicing.CRM.Company

  @impl true
  def mount(_params, _session, socket), do: {:ok, socket}

  @impl true
  def handle_params(params, _uri, socket) do
    {:noreply, assign_company(socket, load_company(socket, params))}
  end

  @impl true
  def handle_event("validate", %{"company" => company_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, company_params))}
  end

  def handle_event("save", _params, socket) do
    case Form.submit(socket.assigns.form, params: nil) do
      {:ok, company} ->
        {:noreply,
         socket
         |> put_flash(:info, "Company saved")
         |> assign_company(company)
         |> push_patch(to: ~p"/companies/#{company.id}/edit")}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  defp load_company(%{assigns: %{live_action: :new}}, _params), do: nil

  defp load_company(socket, %{"id" => id}) do
    CRM.get_company!(id, actor: socket.assigns.current_user)
  end

  defp assign_company(socket, company) do
    actor = socket.assigns.current_user

    socket
    |> assign(:company_name, company_name(company))
    |> assign(:form, to_form(company_form(company, actor)))
  end

  defp company_form(nil, actor),
    do: Form.for_create(Company, :create, as: "company", actor: actor)

  defp company_form(company, actor),
    do: Form.for_update(company, :update, as: "company", actor: actor)

  defp company_name(nil), do: "New company"
  defp company_name(company), do: company.name

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} current_path={@current_path}>
      <.header>
        <span id="company-name">{@company_name}</span>
      </.header>

      <.form for={@form} id="company-form" phx-change="validate" phx-submit="save">
        <.input type="text" id="company-name-input" field={@form[:name]} label="Name" />
        <.input type="text" id="company-domain" field={@form[:domain]} label="Domain" />
        <.input type="text" id="company-industry" field={@form[:industry]} label="Industry" />
        <.button id="save-company" type="button" variant="primary" phx-click="save">Save</.button>
        <.button id="cancel-company" navigate={~p"/companies"}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end
end
