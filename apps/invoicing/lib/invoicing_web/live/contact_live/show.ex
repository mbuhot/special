defmodule InvoicingWeb.ContactLive.Show do
  @moduledoc "Shows a contact with its activity timeline and a form to log a new activity."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.CRM
  alias Invoicing.CRM.Activity
  alias Invoicing.Pipeline

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user
    contact = CRM.get_contact!(id, actor: actor, load: [:full_name, :company])

    socket =
      socket
      |> assign(:contact, contact)
      |> assign(:can_update_contact, CRM.can_update_contact?(actor, contact))
      |> assign(:can_log_activity, CRM.can_create_activity?(actor))
      |> assign(:kind_options, kind_options())
      |> assign(:deals, Pipeline.list_contact_deals!(contact.id, actor: actor))
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
      CRM.list_activities!(socket.assigns.contact.id,
        actor: socket.assigns.current_user,
        load: [:author]
      )

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
    Enum.map(CRM.activity_kinds(), &{Format.label(&1), &1})
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

      <div class="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <.card id="contact-properties" title="Properties">
          <.property label="Email">{@contact.email}</.property>
          <.property label="Phone">{@contact.phone}</.property>
          <.property label="Company">
            <.link
              :if={@contact.company}
              id="contact-company-link"
              navigate={~p"/companies/#{@contact.company.id}"}
              class="text-primary"
            >
              {@contact.company.name}
            </.link>
          </.property>
          <.property label="Created">{Format.date(@contact.inserted_at)}</.property>
        </.card>

        <div class="flex min-w-0 flex-col gap-5">
          <.card title="Deals">
            <table id="contact-deals" class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  <th class="py-2 pr-3">Name</th>
                  <th class="py-2 pr-3">Stage</th>
                  <th class="py-2 pr-3 text-right">Amount</th>
                  <th class="py-2 pl-3">Close date</th>
                </tr>
              </thead>
              <tbody>
                <.empty_row :if={@deals == []} colspan={4}>No deals yet</.empty_row>
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

          <.card id="timeline" title="Timeline">
            <.form
              :if={@can_log_activity}
              for={@form}
              id="activity-form"
              phx-change="validate"
              phx-submit="log"
              class="flex items-end gap-3 pb-3"
            >
              <.input
                type="select"
                id="activity-kind"
                field={@form[:kind]}
                label="Kind"
                options={@kind_options}
              />
              <div class="flex-1">
                <.input type="text" id="activity-body" field={@form[:body]} label="Activity" />
              </div>
              <div class="mb-2">
                <.button id="log-activity" type="button" variant="primary" phx-click="log">
                  Log activity
                </.button>
              </div>
            </.form>

            <ul>
              <li
                :for={activity <- @activities}
                id={"activity-#{activity.id}"}
                class="grid grid-cols-[72px_1fr] items-start gap-4 border-t border-base-300 py-3 text-sm"
              >
                <.badge value={activity.kind} />
                <div class="flex flex-col gap-0.5">
                  <span>{activity.body}</span>
                  <div class="flex gap-3 text-[13px] text-base-content/60">
                    <span>by {activity.author.name}</span>
                    <time datetime={DateTime.to_iso8601(activity.occurred_at)}>
                      {Format.datetime(activity.occurred_at)}
                    </time>
                  </div>
                </div>
              </li>
            </ul>
          </.card>
        </div>
      </div>
    </Layouts.app>
    """
  end
end
