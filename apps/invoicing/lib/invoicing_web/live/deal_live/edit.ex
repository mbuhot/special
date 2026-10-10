defmodule InvoicingWeb.DealLive.Edit do
  @moduledoc "Creates a deal or edits an existing one."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.{CRM, Pipeline}
  alias Invoicing.Pipeline.Deal

  @impl true
  def mount(_params, _session, socket) do
    actor = socket.assigns.current_user

    companies = CRM.list_companies!(nil, actor: actor, query: [sort: [name: :asc]])

    contacts =
      CRM.list_contacts!(nil, nil,
        actor: actor,
        load: [:full_name],
        query: [sort: [first_name: :asc, last_name: :asc]]
      )

    socket =
      socket
      |> assign(:company_options, Enum.map(companies, &{&1.name, &1.id}))
      |> assign(:contact_options, Enum.map(contacts, &{&1.full_name, &1.id}))

    {:ok, socket}
  end

  @impl true
  def handle_params(params, _uri, socket) do
    {:noreply, assign_deal(socket, load_deal(socket, params))}
  end

  @impl true
  def handle_event("validate", %{"deal" => deal_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, deal_params))}
  end

  def handle_event("save", _params, socket) do
    case Form.submit(socket.assigns.form, params: nil) do
      {:ok, deal} ->
        {:noreply,
         socket
         |> put_flash(:info, "Deal saved")
         |> assign_deal(deal)
         |> push_patch(to: ~p"/deals/#{deal.id}/edit")}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  defp load_deal(%{assigns: %{live_action: :new}}, _params), do: nil

  defp load_deal(socket, %{"id" => id}) do
    Pipeline.get_deal!(id, actor: socket.assigns.current_user)
  end

  defp assign_deal(socket, deal) do
    actor = socket.assigns.current_user

    socket
    |> assign(:deal_name, deal_name(deal))
    |> assign(:deal_stage, deal_stage(deal))
    |> assign(:form, to_form(deal_form(deal, actor)))
  end

  defp deal_form(nil, actor), do: Form.for_create(Deal, :create, as: "deal", actor: actor)
  defp deal_form(deal, actor), do: Form.for_update(deal, :update, as: "deal", actor: actor)

  defp deal_name(nil), do: "New deal"
  defp deal_name(deal), do: deal.name

  defp deal_stage(nil), do: nil
  defp deal_stage(deal), do: Format.label(deal.stage)

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} current_path={@current_path}>
      <.header>
        <span id="deal-name">{@deal_name}</span>
        <:subtitle>
          <span :if={@deal_stage} id="deal-stage">{@deal_stage}</span>
        </:subtitle>
      </.header>

      <.form for={@form} id="deal-form" phx-change="validate" phx-submit="save">
        <.input type="text" id="deal-name-input" field={@form[:name]} label="Name" />
        <.input type="number" step="any" id="deal-amount" field={@form[:amount]} label="Amount" />
        <.input type="date" id="deal-close-date" field={@form[:close_date]} label="Close date" />
        <.input
          type="select"
          id="deal-company"
          field={@form[:company_id]}
          label="Company"
          prompt="Select a company"
          options={@company_options}
        />
        <.input
          type="select"
          id="deal-contact"
          field={@form[:contact_id]}
          label="Contact"
          prompt="Select a contact"
          options={@contact_options}
        />
        <.button id="save-deal" type="button" variant="primary" phx-click="save">Save</.button>
        <.button id="cancel-deal" navigate={~p"/pipeline"}>Cancel</.button>
      </.form>
    </Layouts.app>
    """
  end
end
