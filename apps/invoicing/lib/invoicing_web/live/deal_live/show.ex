defmodule InvoicingWeb.DealLive.Show do
  @moduledoc "Shows a deal with its tasks, highlights overdue tasks and offers a form to add a task."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.{Clock, Pipeline}
  alias Invoicing.Pipeline.Task

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user

    socket =
      socket
      |> assign_deal(id)
      |> assign(:can_change_tasks, Pipeline.can_create_task?(actor))
      |> assign_tasks()
      |> assign_blank_form()

    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"task" => task_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, task_params))}
  end

  def handle_event("add", _params, socket) do
    case Form.submit(socket.assigns.form, params: add_params(socket)) do
      {:ok, _task} ->
        {:noreply, socket |> assign_tasks() |> assign_blank_form()}

      {:error, form} ->
        {:noreply, assign(socket, :form, form)}
    end
  end

  def handle_event("transition", %{"transition" => name}, socket) do
    actor = socket.assigns.current_user
    transition = Pipeline.parse_deal_transition(name)

    case Pipeline.transition_deal(socket.assigns.deal, transition, actor: actor) do
      {:ok, deal} -> {:noreply, assign_deal(socket, deal.id)}
      {:error, _error} -> {:noreply, put_flash(socket, :error, "Deal could not be moved")}
    end
  end

  def handle_event("complete", %{"id" => id}, socket) do
    actor = socket.assigns.current_user
    task = Pipeline.get_task!(id, actor: actor)

    case Pipeline.complete_task(task, actor: actor) do
      {:ok, _task} -> {:noreply, assign_tasks(socket)}
      {:error, _error} -> {:noreply, put_flash(socket, :error, "Task could not be completed")}
    end
  end

  defp assign_deal(socket, id) do
    actor = socket.assigns.current_user

    deal =
      Pipeline.get_deal!(id, actor: actor, load: [:company, :owner, contact: [:full_name]])

    socket
    |> assign(:deal, deal)
    |> assign(:can_update_deal, Pipeline.can_update_deal?(actor, deal))
    |> assign(:transitions, permitted_transitions(deal, actor))
  end

  defp permitted_transitions(deal, actor) do
    deal.stage
    |> Pipeline.deal_transitions_from()
    |> Enum.filter(&Pipeline.can_transition_deal?(actor, deal, &1))
  end

  defp add_params(%{assigns: %{form: form, deal: deal}}),
    do: form |> Form.params() |> Map.put("deal_id", deal.id)

  defp assign_tasks(socket) do
    tasks = Pipeline.list_tasks!(socket.assigns.deal.id, actor: socket.assigns.current_user)
    today = DateTime.to_date(Clock.now())

    socket
    |> assign(:tasks, tasks)
    |> assign(:overdue_tasks, Enum.filter(tasks, &overdue?(&1, today)))
  end

  defp overdue?(%Task{status: :open, due_date: due_date}, today),
    do: Date.compare(due_date, today) == :lt

  defp overdue?(%Task{}, _today), do: false

  defp assign_blank_form(socket) do
    form =
      Form.for_create(Task, :create,
        as: "task",
        actor: socket.assigns.current_user
      )

    assign(socket, :form, to_form(form))
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
        <span id="deal-name">{@deal.name}</span>
        <:subtitle>
          <span id="deal-stage"><.badge value={@deal.stage} /></span>
        </:subtitle>
        <:actions>
          <div class="flex items-center gap-2">
            <.button
              :for={transition <- @transitions}
              id={"deal-#{transition}"}
              variant={if transition != :lose, do: "primary"}
              phx-click="transition"
              phx-value-transition={transition}
            >
              {Format.label(transition)}
            </.button>
            <.button
              :if={@can_update_deal}
              id="edit-deal"
              navigate={~p"/deals/#{@deal.id}/edit"}
            >
              Edit deal
            </.button>
          </div>
        </:actions>
      </.header>

      <div class="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <.card id="deal-properties" title="Properties">
          <.property label="Amount">{Format.money(@deal.amount)}</.property>
          <.property label="Close date">{Format.date(@deal.close_date)}</.property>
          <.property label="Company">
            <.link
              id="deal-company-link"
              navigate={~p"/companies/#{@deal.company.id}"}
              class="text-primary"
            >
              {@deal.company.name}
            </.link>
          </.property>
          <.property label="Contact">
            <.link
              :if={@deal.contact}
              id="deal-contact-link"
              navigate={~p"/contacts/#{@deal.contact.id}"}
              class="text-primary"
            >
              {@deal.contact.full_name}
            </.link>
          </.property>
          <.property label="Owner">{Format.role_label(@deal.owner.role)}</.property>
        </.card>

        <div class="flex min-w-0 flex-col gap-5">
          <section
            :if={@overdue_tasks != []}
            id="overdue-tasks"
            class="rounded-lg border border-warning/40 bg-warning/10 p-5"
          >
            <h2 class="mb-2 text-base font-semibold">Overdue tasks</h2>
            <ul class="text-sm">
              <li :for={task <- @overdue_tasks}>{task.title}</li>
            </ul>
          </section>

          <.card title="Tasks">
            <.form
              :if={@can_change_tasks}
              for={@form}
              id="task-form"
              phx-change="validate"
              phx-submit="add"
              class="flex items-end gap-3 pb-3"
            >
              <div class="flex-1">
                <.input type="text" id="task-title" field={@form[:title]} label="Title" />
              </div>
              <.input type="date" id="task-due-date" field={@form[:due_date]} label="Due date" />
              <div class="mb-2">
                <.button id="add-task" type="button" variant="primary" phx-click="add">
                  Add task
                </.button>
              </div>
            </.form>

            <table id="tasks" class="w-full border-collapse text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  <th class="py-2 pr-3">Title</th>
                  <th class="py-2 pr-3">Due date</th>
                  <th class="py-2 pr-3">Status</th>
                  <th class="py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr :for={task <- @tasks} id={"task-#{task.id}"} class="border-t border-base-300">
                  <td class="py-3 pr-3">{task.title}</td>
                  <td class="py-3 pr-3">
                    <time datetime={Date.to_iso8601(task.due_date)}>
                      {Date.to_iso8601(task.due_date)}
                    </time>
                  </td>
                  <td class="py-3 pr-3">
                    <.badge value={task.status}>{task.status}</.badge>
                  </td>
                  <td class="py-3 text-right">
                    <button
                      :if={@can_change_tasks and task.status == :open}
                      type="button"
                      class="btn btn-xs"
                      data-complete-task
                      phx-click="complete"
                      phx-value-id={task.id}
                    >
                      Complete
                    </button>
                  </td>
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
