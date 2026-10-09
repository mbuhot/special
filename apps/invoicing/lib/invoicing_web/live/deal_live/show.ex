defmodule InvoicingWeb.DealLive.Show do
  @moduledoc "Shows a deal with its tasks, highlights overdue tasks and offers a form to add a task."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.{Clock, Pipeline}
  alias Invoicing.Pipeline.Task

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user
    deal = Pipeline.get_deal!(id, actor: actor)

    socket =
      socket
      |> assign(:deal, deal)
      |> assign(:can_update_deal, Ash.can?({deal, :update}, actor))
      |> assign(:can_change_tasks, Ash.can?({Task, :create}, actor))
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

  def handle_event("complete", %{"id" => id}, socket) do
    actor = socket.assigns.current_user
    task = Pipeline.get_task!(id, actor: actor)

    case Pipeline.complete_task(task, actor: actor) do
      {:ok, _task} -> {:noreply, assign_tasks(socket)}
      {:error, _error} -> {:noreply, put_flash(socket, :error, "Task could not be completed")}
    end
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
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        <span id="deal-name">{@deal.name}</span>
        <:subtitle>
          <span id="deal-stage">{@deal.stage}</span>
        </:subtitle>
        <:actions>
          <.button
            :if={@can_update_deal}
            id="edit-deal"
            variant="primary"
            navigate={~p"/deals/#{@deal.id}/edit"}
          >
            Edit deal
          </.button>
        </:actions>
      </.header>

      <section :if={@overdue_tasks != []} id="overdue-tasks" class="alert alert-warning">
        <h2 class="font-semibold">Overdue tasks</h2>
        <ul>
          <li :for={task <- @overdue_tasks}>{task.title}</li>
        </ul>
      </section>

      <.form
        :if={@can_change_tasks}
        for={@form}
        id="task-form"
        phx-change="validate"
        phx-submit="add"
      >
        <.input type="text" id="task-title" field={@form[:title]} label="Title" />
        <.input type="date" id="task-due-date" field={@form[:due_date]} label="Due date" />
        <.button id="add-task" type="button" variant="primary" phx-click="add">
          Add task
        </.button>
      </.form>

      <table id="tasks" class="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Due date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr :for={task <- @tasks} id={"task-#{task.id}"}>
            <td>{task.title}</td>
            <td>
              <time datetime={Date.to_iso8601(task.due_date)}>{Date.to_iso8601(task.due_date)}</time>
            </td>
            <td>{task.status}</td>
            <td>
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
    </Layouts.app>
    """
  end
end
