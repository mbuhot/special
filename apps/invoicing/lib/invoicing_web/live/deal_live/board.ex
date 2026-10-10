defmodule InvoicingWeb.DealLive.Board do
  @moduledoc "Shows deals in a column per stage with a stage menu listing the stages the viewer may move each deal to."

  use InvoicingWeb, :live_view

  alias Invoicing.Pipeline

  @stages [:lead, :qualified, :proposal, :won, :lost]

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:stages, @stages)
      |> assign(:can_change_deals, Pipeline.can_create_deal?(socket.assigns.current_user))
      |> assign_deals()

    {:ok, socket}
  end

  @impl true
  def handle_event("move", %{"deal" => %{"id" => id, "stage" => stage}}, socket) do
    actor = socket.assigns.current_user
    deal = Pipeline.get_deal!(id, actor: actor)
    transition = Pipeline.deal_transition_to(deal, String.to_existing_atom(stage))
    {:noreply, move_deal(socket, deal, transition)}
  end

  defp move_deal(socket, _deal, nil), do: assign_deals(socket)

  defp move_deal(socket, deal, transition) do
    case Pipeline.transition_deal(deal, transition, actor: socket.assigns.current_user) do
      {:ok, _moved_deal} -> assign_deals(socket)
      {:error, _error} -> put_flash(socket, :error, "Deal could not be moved")
    end
  end

  defp assign_deals(socket) do
    deals =
      Pipeline.list_deals!(
        actor: socket.assigns.current_user,
        load: [:company],
        query: [sort: [inserted_at: :asc, id: :asc]]
      )

    socket
    |> assign(:deals_by_stage, Enum.group_by(deals, & &1.stage))
    |> assign(
      :stage_options,
      Map.new(deals, &{&1.id, stage_options(&1, socket.assigns.current_user)})
    )
  end

  defp stage_options(deal, actor) do
    next_stages =
      actor
      |> Pipeline.permitted_deal_transitions(deal)
      |> Enum.map(&Pipeline.deal_transition_target/1)

    Enum.map([deal.stage | next_stages], &{Format.label(&1), &1})
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
        Pipeline
        <:actions>
          <.button
            :if={@can_change_deals}
            id="new-deal"
            variant="primary"
            navigate={~p"/deals/new/edit"}
          >
            New deal
          </.button>
        </:actions>
      </.header>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
        <section :for={stage <- @stages} id={"column-#{stage}"} class="space-y-2">
          <h2 class="font-semibold">{Format.label(stage)}</h2>
          <article
            :for={deal <- Map.get(@deals_by_stage, stage, [])}
            id={"deal-#{deal.id}"}
            class="card bg-base-200 p-3 space-y-1"
          >
            <.link navigate={~p"/deals/#{deal.id}"} class="font-medium">{deal.name}</.link>
            <p :if={deal.amount}>{Format.money(deal.amount)}</p>
            <p class="text-sm">{deal.company.name}</p>
            <form id={"deal-stage-form-#{deal.id}"} data-deal-stage phx-change="move">
              <input type="hidden" name="deal[id]" value={deal.id} />
              <select
                name="deal[stage]"
                data-deal-stage
                aria-label={"Stage of #{deal.name}"}
                class="select select-xs w-full"
              >
                {Phoenix.HTML.Form.options_for_select(
                  Map.fetch!(@stage_options, deal.id),
                  deal.stage
                )}
              </select>
            </form>
          </article>
        </section>
      </div>
    </Layouts.app>
    """
  end
end
