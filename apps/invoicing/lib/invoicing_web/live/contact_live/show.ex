defmodule InvoicingWeb.ContactLive.Show do
  @moduledoc "Shows a contact with its activity timeline and a form to log a new activity."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.CRM
  alias Invoicing.CRM.Activity

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user
    contact = CRM.get_contact!(id, actor: actor, load: [:full_name])

    socket =
      socket
      |> assign(:contact, contact)
      |> assign(:can_update_contact, Ash.can?({contact, :update}, actor))
      |> assign(:can_log_activity, Ash.can?({Activity, :create}, actor))
      |> assign(:kind_options, kind_options())
      |> assign_activities()
      |> assign_blank_form()

    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"activity" => activity_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, activity_params))}
  end

  def handle_event("log", _params, socket) do
    case Form.submit(socket.assigns.form, params: log_params(socket)) do
      {:ok, _activity} ->
        {:noreply, socket |> assign_activities() |> assign_blank_form()}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  defp log_params(%{assigns: %{form: form, contact: contact}}),
    do: form |> Form.params() |> Map.put("contact_id", contact.id)

  defp assign_activities(socket) do
    activities =
      CRM.list_activities!(socket.assigns.contact.id, actor: socket.assigns.current_user)

    assign(socket, :activities, activities)
  end

  defp assign_blank_form(socket) do
    form =
      Form.for_create(Activity, :create,
        as: "activity",
        actor: socket.assigns.current_user,
        params: %{"kind" => "note"}
      )

    assign(socket, :form, to_form(form))
  end

  defp kind_options do
    Activity
    |> Ash.Resource.Info.attribute(:kind)
    |> Map.fetch!(:constraints)
    |> Keyword.fetch!(:one_of)
    |> Enum.map(&{Atom.to_string(&1), &1})
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        <span id="contact-name">{@contact.full_name}</span>
        <:actions>
          <.button
            :if={@can_update_contact}
            id="edit-contact"
            variant="primary"
            navigate={~p"/contacts/#{@contact.id}/edit"}
          >
            Edit contact
          </.button>
        </:actions>
      </.header>

      <.form
        :if={@can_log_activity}
        for={@form}
        id="activity-form"
        phx-change="validate"
        phx-submit="log"
      >
        <.input
          type="select"
          id="activity-kind"
          field={@form[:kind]}
          label="Kind"
          options={@kind_options}
        />
        <.input type="text" id="activity-body" field={@form[:body]} label="Body" />
        <.button id="log-activity" type="button" variant="primary" phx-click="log">
          Log activity
        </.button>
      </.form>

      <ul id="timeline" class="list">
        <li :for={activity <- @activities} id={"activity-#{activity.id}"} class="list-row">
          <span class="font-semibold">{activity.kind}</span>
          <span>{activity.body}</span>
          <time datetime={DateTime.to_iso8601(activity.occurred_at)}>
            {DateTime.to_date(activity.occurred_at)}
          </time>
        </li>
      </ul>
    </Layouts.app>
    """
  end
end
