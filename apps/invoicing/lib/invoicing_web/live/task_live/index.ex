defmodule InvoicingWeb.TaskLive.Index do
  @moduledoc "Lists open tasks with a window filter, row and bulk completion, reassignment for managers and a form to add a task."

  use InvoicingWeb, :live_view

  alias AshPhoenix.Form
  alias Invoicing.{Accounts, Clock, Pipeline}
  alias Invoicing.Pipeline.Task

  @windows %{"all" => :all, "overdue" => :overdue, "due_this_week" => :due_this_week}
  @window_options [
    {"All open", "all"},
    {"Overdue", "overdue"},
    {"Due this week", "due_this_week"}
  ]

  @impl true
  def mount(_params, _session, socket) do
    actor = socket.assigns.current_user
    assignees = Accounts.list_assignable_users!(actor: actor)
    deals = Pipeline.list_deals!(actor: actor, query: [sort: [name: :asc]])

    socket =
      socket
      |> assign(:window, :all)
      |> assign(:selected, MapSet.new())
      |> assign(:menu_task_id, nil)
      |> assign(:reassign_task_id, nil)
      |> assign(:reassign_assignee_id, nil)
      |> assign(:can_create_task, Pipeline.can_create_task?(actor))
      |> assign(:can_see_all, Pipeline.can_see_all_tasks?(actor))
      |> assign(:assignee_options, Enum.map(assignees, &{&1.name, &1.id}))
      |> assign(:bulk_assignee_id, assignees |> List.first() |> then(&(&1 && &1.id)))
      |> assign(:deal_options, Enum.map(deals, &{&1.name, &1.id}))
      |> assign(:window_options, @window_options)
      |> assign_tasks()
      |> assign_blank_form()

    {:ok, socket}
  end

  @impl true
  def handle_event("filter", %{"filter" => %{"show" => show}}, socket) do
    {:noreply, socket |> assign(:window, Map.fetch!(@windows, show)) |> assign_tasks()}
  end

  def handle_event("validate", %{"task" => task_params}, socket) do
    {:noreply, assign(socket, :form, Form.validate(socket.assigns.form, task_params))}
  end

  def handle_event("add", _params, socket) do
    case Form.submit(socket.assigns.form, params: add_params(socket.assigns.form)) do
      {:ok, _task} -> {:noreply, socket |> assign_tasks() |> assign_blank_form()}
      {:error, form} -> {:noreply, assign(socket, :form, form)}
    end
  end

  def handle_event("complete", %{"id" => id}, socket) do
    {:noreply, socket |> complete_tasks([id]) |> assign_tasks()}
  end

  def handle_event("toggle_select", %{"id" => id}, socket) do
    {:noreply, assign(socket, :selected, toggle(socket.assigns.selected, id))}
  end

  def handle_event("toggle_all", _params, socket) do
    visible_ids = MapSet.new(socket.assigns.tasks, & &1.id)

    selected =
      if MapSet.equal?(socket.assigns.selected, visible_ids), do: MapSet.new(), else: visible_ids

    {:noreply, assign(socket, :selected, selected)}
  end

  def handle_event("clear_selection", _params, socket) do
    {:noreply, assign(socket, :selected, MapSet.new())}
  end

  def handle_event("bulk_assignee", %{"bulk" => %{"assignee_id" => assignee_id}}, socket) do
    {:noreply, assign(socket, :bulk_assignee_id, assignee_id)}
  end

  def handle_event("bulk_complete", _params, socket) do
    {:noreply,
     socket |> complete_tasks(socket.assigns.selected) |> assign_tasks() |> clear_selection()}
  end

  def handle_event("bulk_reassign", _params, socket) do
    socket =
      socket
      |> reassign_tasks(socket.assigns.selected, socket.assigns.bulk_assignee_id)
      |> assign_tasks()
      |> clear_selection()

    {:noreply, socket}
  end

  def handle_event("toggle_menu", %{"id" => id}, socket) do
    menu_task_id = if socket.assigns.menu_task_id == id, do: nil, else: id
    {:noreply, assign(socket, :menu_task_id, menu_task_id)}
  end

  def handle_event("open_reassign", %{"id" => id}, socket) do
    task = Enum.find(socket.assigns.tasks, &(&1.id == id))

    {:noreply,
     socket
     |> assign(:menu_task_id, nil)
     |> assign(:reassign_task_id, id)
     |> assign(:reassign_assignee_id, task.assignee_id)}
  end

  def handle_event("cancel_reassign", _params, socket) do
    {:noreply, assign(socket, :reassign_task_id, nil)}
  end

  def handle_event("reassign_assignee", %{"task" => %{"assignee_id" => assignee_id}}, socket) do
    {:noreply, assign(socket, :reassign_assignee_id, assignee_id)}
  end

  def handle_event("reassign", %{"id" => id}, socket) do
    socket =
      socket
      |> reassign_tasks([id], socket.assigns.reassign_assignee_id)
      |> assign(:reassign_task_id, nil)
      |> assign_tasks()

    {:noreply, socket}
  end

  defp toggle(selected, id) do
    if MapSet.member?(selected, id),
      do: MapSet.delete(selected, id),
      else: MapSet.put(selected, id)
  end

  defp clear_selection(socket), do: assign(socket, :selected, MapSet.new())

  defp complete_tasks(socket, ids) do
    actor = socket.assigns.current_user

    results =
      Enum.map(ids, fn id ->
        id |> Pipeline.get_task!(actor: actor) |> Pipeline.complete_task(actor: actor)
      end)

    flash_failure(socket, results, "Task could not be completed")
  end

  defp reassign_tasks(socket, ids, assignee_id) do
    actor = socket.assigns.current_user

    results =
      Enum.map(ids, fn id ->
        id
        |> Pipeline.get_task!(actor: actor)
        |> Pipeline.reassign_task(assignee_id, actor: actor)
      end)

    flash_failure(socket, results, "Task could not be reassigned")
  end

  defp flash_failure(socket, results, message) do
    if Enum.all?(results, &match?({:ok, _task}, &1)),
      do: socket,
      else: put_flash(socket, :error, message)
  end

  defp assign_tasks(socket) do
    actor = socket.assigns.current_user
    today = today()
    tasks = Pipeline.list_open_tasks(socket.assigns.window, today, actor)
    visible_ids = MapSet.new(tasks, & &1.id)

    socket
    |> assign(:tasks, tasks)
    |> assign(:today, today)
    |> assign(:selected, MapSet.intersection(socket.assigns.selected, visible_ids))
    |> assign(
      :filter_form,
      to_form(%{"show" => window_value(socket.assigns.window)}, as: :filter)
    )
    |> assign(
      :can_reassign,
      Map.new(tasks, &{&1.id, Pipeline.can_reassign_task?(actor, &1, &1.assignee_id)})
    )
  end

  defp window_value(window), do: window |> Atom.to_string()

  defp today, do: DateTime.to_date(Clock.now())

  defp overdue?(task, today), do: Date.compare(task.due_date, today) == :lt

  defp add_params(form) do
    form |> Form.params() |> Map.reject(fn {_field, value} -> value == "" end)
  end

  defp assign_blank_form(socket) do
    form = Form.for_create(Task, :create, as: "task", actor: socket.assigns.current_user)
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
      <.header>My tasks</.header>

      <.form
        :if={@can_create_task}
        for={@form}
        id="task-list-new-form"
        phx-change="validate"
        phx-submit="add"
        class="flex items-end gap-3 rounded-lg border border-base-300 p-5"
      >
        <div class="flex-1">
          <.input type="text" id="task-list-new-title" field={@form[:title]} label="Title" />
        </div>
        <.input type="date" id="task-list-new-due-date" field={@form[:due_date]} label="Due date" />
        <.input
          type="select"
          id="task-list-new-deal"
          field={@form[:deal_id]}
          label="Deal"
          prompt="Select a deal"
          options={@deal_options}
        />
        <.input
          :if={@can_see_all}
          type="select"
          id="task-list-new-assignee"
          field={@form[:assignee_id]}
          label="Assignee"
          prompt="Myself"
          options={@assignee_options}
        />
        <div class="mb-2">
          <.button id="task-list-add" type="button" variant="primary" phx-click="add">
            Add task
          </.button>
        </div>
      </.form>

      <.form for={@filter_form} id="task-list-filter-form" phx-change="filter" class="w-60">
        <.input
          type="select"
          id="task-list-filter"
          field={@filter_form[:show]}
          label="Show"
          options={@window_options}
        />
      </.form>

      <section class="flex flex-col rounded-lg border border-base-300 p-5">
        <div
          :if={MapSet.size(@selected) > 0}
          id="task-list-bulk"
          class="mb-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2"
        >
          <span class="text-sm font-semibold">{MapSet.size(@selected)} selected</span>
          <.form
            :let={bulk_form}
            :if={@can_see_all}
            for={to_form(%{"assignee_id" => @bulk_assignee_id}, as: :bulk)}
            id="task-list-bulk-form"
            phx-change="bulk_assignee"
            class="flex items-center gap-2"
          >
            <select
              id="task-list-bulk-assignee"
              name={bulk_form[:assignee_id].name}
              class="select select-sm"
              aria-label="Reassign to"
            >
              {Phoenix.HTML.Form.options_for_select(@assignee_options, @bulk_assignee_id)}
            </select>
          </.form>
          <button
            :if={@can_see_all}
            id="task-list-bulk-reassign"
            type="button"
            class="btn btn-sm"
            phx-click="bulk_reassign"
          >
            Reassign
          </button>
          <button
            id="task-list-bulk-complete"
            type="button"
            class="btn btn-sm btn-primary"
            phx-click="bulk_complete"
          >
            Complete
          </button>
          <button
            id="task-list-clear-selection"
            type="button"
            class="btn btn-sm btn-ghost ml-auto text-primary"
            phx-click="clear_selection"
          >
            Clear selection
          </button>
        </div>

        <table id="task-list-table" class="w-full border-collapse text-sm">
          <thead>
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <th class="w-8 py-2 pr-2">
                <input
                  type="checkbox"
                  id="task-list-select-all"
                  class="checkbox checkbox-sm"
                  aria-label="Select all tasks"
                  checked={@tasks != [] and MapSet.size(@selected) == length(@tasks)}
                  phx-click="toggle_all"
                />
              </th>
              <th class="py-2 pr-3">Title</th>
              <th class="py-2 pr-3">Due</th>
              <th class="py-2 pr-3">Deal</th>
              <th :if={@can_see_all} class="py-2 pr-3">Assignee</th>
              <th class="py-2 pl-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <.empty_row :if={@tasks == []} colspan={6}>No open tasks</.empty_row>
            <tr :for={task <- @tasks} id={"task-#{task.id}"} class="border-t border-base-300">
              <td class="py-3 pr-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  data-select-task
                  aria-label={"Select #{task.title}"}
                  checked={MapSet.member?(@selected, task.id)}
                  phx-click="toggle_select"
                  phx-value-id={task.id}
                />
              </td>
              <td class="py-3 pr-3">{task.title}</td>
              <td class="py-3 pr-3">
                <time datetime={Date.to_iso8601(task.due_date)}>{Format.date(task.due_date)}</time>
                <span
                  :if={overdue?(task, @today)}
                  data-overdue-badge
                  class="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700"
                >
                  Overdue
                </span>
              </td>
              <td class="py-3 pr-3">
                <.link navigate={~p"/deals/#{task.deal_id}"} data-task-deal class="text-primary">
                  {task.deal.name}
                </.link>
              </td>
              <td :if={@can_see_all} class="py-3 pr-3">{task.assignee.name}</td>
              <td class="py-3 pl-3">
                <div class="relative flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="btn btn-xs"
                    data-complete-task
                    phx-click="complete"
                    phx-value-id={task.id}
                  >
                    Complete
                  </button>
                  <button
                    :if={Map.fetch!(@can_reassign, task.id)}
                    type="button"
                    class="btn btn-xs"
                    data-task-actions
                    aria-label="More actions"
                    phx-click="toggle_menu"
                    phx-value-id={task.id}
                  >
                    &#8943;
                  </button>
                  <div
                    :if={@menu_task_id == task.id}
                    role="menu"
                    aria-label="Task actions"
                    class="absolute right-0 top-8 z-10 flex min-w-44 flex-col rounded-lg border border-base-300 bg-base-100 py-1 text-left shadow"
                  >
                    <.link
                      role="menuitem"
                      navigate={~p"/deals/#{task.deal_id}"}
                      data-task-open-deal
                      class="px-3.5 py-2 hover:bg-base-200"
                    >
                      Open deal
                    </.link>
                    <button
                      type="button"
                      role="menuitem"
                      data-task-reassign-open
                      class="px-3.5 py-2 text-left hover:bg-base-200"
                      phx-click="open_reassign"
                      phx-value-id={task.id}
                    >
                      Reassign&hellip;
                    </button>
                  </div>
                  <form
                    :if={@reassign_task_id == task.id}
                    id={"reassign-form-#{task.id}"}
                    data-task-reassign
                    role="dialog"
                    aria-label="Reassign task"
                    phx-change="reassign_assignee"
                    class="absolute right-0 top-8 z-10 flex w-60 flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-3 text-left shadow"
                  >
                    <label class="text-xs font-semibold text-base-content/60">
                      Reassign {task.title} to
                    </label>
                    <select name="task[assignee_id]" data-task-assignee class="select select-sm">
                      {Phoenix.HTML.Form.options_for_select(@assignee_options, @reassign_assignee_id)}
                    </select>
                    <div class="flex justify-end gap-2">
                      <button
                        type="button"
                        class="btn btn-sm"
                        data-task-reassign-cancel
                        phx-click="cancel_reassign"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        data-task-reassign
                        phx-click="reassign"
                        phx-value-id={task.id}
                      >
                        Reassign
                      </button>
                    </div>
                  </form>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </Layouts.app>
    """
  end
end
