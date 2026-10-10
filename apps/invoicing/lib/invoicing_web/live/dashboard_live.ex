defmodule InvoicingWeb.DashboardLive do
  @moduledoc "Home page summarising open deals per stage, overdue tasks, unpaid invoices and recent activity."

  use InvoicingWeb, :live_view

  alias Invoicing.{Billing, Clock, CRM, Pipeline}

  @impl true
  def mount(_params, _session, socket) do
    actor = socket.assigns.current_user
    today = DateTime.to_date(Clock.now())

    socket =
      socket
      |> assign(:open_deals_by_stage, Pipeline.count_open_deals_by_stage(actor))
      |> assign(:overdue_tasks_count, Pipeline.count_overdue_tasks(today, actor))
      |> assign(:unpaid_invoices_count, Billing.count_unpaid_invoices(actor))
      |> assign(:recent_activities, CRM.list_recent_activities!(5, actor: actor))

    {:ok, socket}
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
      <.header>Dashboard</.header>

      <div class="grid gap-5 md:grid-cols-3">
        <section class="flex flex-col gap-3 rounded-lg border border-base-300 p-5">
          <h2 class="text-sm font-semibold text-base-content/80">Open deals by stage</h2>
          <ul id="open-deals-by-stage" class="flex flex-col gap-2 text-sm">
            <li :for={{stage, count} <- @open_deals_by_stage} class="capitalize">{stage} {count}</li>
          </ul>
          <.link
            id="view-pipeline"
            navigate={~p"/pipeline"}
            class="text-sm font-semibold text-primary"
          >
            View pipeline
          </.link>
        </section>

        <section class="flex flex-col gap-3 rounded-lg border border-base-300 p-5">
          <h2 class="text-sm font-semibold text-base-content/80">Overdue tasks</h2>
          <p id="overdue-tasks-count" class="text-4xl font-semibold leading-tight">
            {@overdue_tasks_count}
          </p>
          <p class="text-sm text-base-content/60">tasks past their due date</p>
          <.link id="view-tasks" navigate={~p"/tasks"} class="text-sm font-semibold text-primary">
            View tasks
          </.link>
        </section>

        <section class="flex flex-col gap-3 rounded-lg border border-base-300 p-5">
          <h2 class="text-sm font-semibold text-base-content/80">Unpaid invoices</h2>
          <p id="unpaid-invoices-count" class="text-4xl font-semibold leading-tight">
            {@unpaid_invoices_count}
          </p>
          <p class="text-sm text-base-content/60">sent or draft</p>
          <.link
            id="view-invoices"
            navigate={~p"/invoices"}
            class="text-sm font-semibold text-primary"
          >
            View invoices
          </.link>
        </section>
      </div>

      <section id="recent-activity" class="rounded-lg border border-base-300 p-5">
        <h2 class="mb-2 text-base font-semibold">Recent activity</h2>
        <p :if={@recent_activities == []} class="py-3 text-sm text-base-content/60">
          No activity yet
        </p>
        <div
          :for={activity <- @recent_activities}
          class="grid grid-cols-[72px_1fr_160px_96px] items-center gap-4 border-t border-base-300 py-3 text-sm"
        >
          <span class="justify-self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {Format.label(activity.kind)}
          </span>
          <span>{activity.body}</span>
          <.link
            navigate={~p"/contacts/#{activity.contact_id}"}
            class="text-base-content/80 hover:text-primary"
          >
            {activity.contact.full_name}
          </.link>
          <span class="text-base-content/60">{Format.date(activity.occurred_at)}</span>
        </div>
      </section>
    </Layouts.app>
    """
  end
end
