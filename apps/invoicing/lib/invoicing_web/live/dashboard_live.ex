defmodule InvoicingWeb.DashboardLive do
  @moduledoc "Home page summarising open deals per stage, overdue tasks and unpaid invoices."

  use InvoicingWeb, :live_view

  alias Invoicing.{Billing, Clock, Pipeline}

  @impl true
  def mount(_params, _session, socket) do
    actor = socket.assigns.current_user
    today = DateTime.to_date(Clock.now())

    socket =
      socket
      |> assign(:open_deals_by_stage, Pipeline.count_open_deals_by_stage(actor))
      |> assign(:overdue_tasks_count, Pipeline.count_overdue_tasks(today, actor))
      |> assign(:unpaid_invoices_count, Billing.count_unpaid_invoices(actor))

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>Dashboard</.header>

      <section id="open-deals-by-stage">
        <h2 class="font-semibold">Open deals by stage</h2>
        <ul>
          <li :for={{stage, count} <- @open_deals_by_stage}>{stage} {count}</li>
        </ul>
      </section>

      <section>
        <h2 class="font-semibold">Overdue tasks</h2>
        <p id="overdue-tasks-count" class="text-3xl">{@overdue_tasks_count}</p>
      </section>

      <section>
        <h2 class="font-semibold">Unpaid invoices</h2>
        <p id="unpaid-invoices-count" class="text-3xl">{@unpaid_invoices_count}</p>
      </section>
    </Layouts.app>
    """
  end
end
