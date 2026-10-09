defmodule InvoicingWeb.ContactLive.Edit do
  @moduledoc "Creates a contact or edits an existing one."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.CRM
  alias Invoicing.CRM.Contact

  @impl true
  def mount(_params, _session, socket) do
    companies =
      CRM.list_companies!(nil, actor: socket.assigns.current_user, query: [sort: [name: :asc]])

    {:ok, assign(socket, :company_options, Enum.map(companies, &{&1.name, &1.id}))}
  end

  @impl true
  def handle_params(params, _uri, socket) do
    {:noreply, assign_contact(socket, load_contact(socket, params))}
  end

  @impl true
  def handle_event("validate", %{"contact" => contact_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, contact_params))}
  end

  def handle_event("save", _params, socket) do
    case Form.submit(socket.assigns.form, params: nil) do
      {:ok, contact} ->
        saved_contact = CRM.get_contact!(contact.id, load: [:full_name], authorize?: false)

        {:noreply,
         socket
         |> put_flash(:info, "Contact saved")
         |> assign_contact(saved_contact)
         |> push_patch(to: ~p"/contacts/#{saved_contact.id}/edit")}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  defp load_contact(%{assigns: %{live_action: :new}}, _params), do: nil

  defp load_contact(socket, %{"id" => id}) do
    CRM.get_contact!(id, actor: socket.assigns.current_user, load: [:full_name])
  end

  defp assign_contact(socket, contact) do
    actor = socket.assigns.current_user

    socket
    |> assign(:contact_name, contact_name(contact))
    |> assign(:form, to_form(contact_form(contact, actor)))
  end

  defp contact_form(nil, actor),
    do: Form.for_create(Contact, :create, as: "contact", actor: actor)

  defp contact_form(contact, actor),
    do: Form.for_update(contact, :update, as: "contact", actor: actor)

  defp contact_name(nil), do: "New contact"
  defp contact_name(contact), do: contact.full_name

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} current_path={@current_path}>
      <.header>
        <span id="contact-name">{@contact_name}</span>
      </.header>

      <.form for={@form} id="contact-form" phx-change="validate" phx-submit="save">
        <.input type="text" id="contact-first-name" field={@form[:first_name]} label="First name" />
        <.input type="text" id="contact-last-name" field={@form[:last_name]} label="Last name" />
        <.input type="email" id="contact-email" field={@form[:email]} label="Email" />
        <.input type="tel" id="contact-phone" field={@form[:phone]} label="Phone" />
        <.input
          type="select"
          id="contact-company"
          field={@form[:company_id]}
          label="Company"
          prompt="Select a company"
          options={@company_options}
        />
        <.button id="save-contact" type="button" variant="primary" phx-click="save">Save</.button>
      </.form>
    </Layouts.app>
    """
  end
end
