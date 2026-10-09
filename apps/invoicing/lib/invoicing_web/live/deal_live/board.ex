defmodule InvoicingWeb.DealLive.Board do
  @moduledoc "Shows deals in a column per stage with a control per valid stage transition."

  use InvoicingWeb, :live_view

  alias Invoicing.Pipeline
  alias Invoicing.Pipeline.Deal

  @stages [:lead, :qualified, :proposal, :won, :lost]

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:stages, @stages)
      |> assign(:can_change_deals, Ash.can?({Deal, :create}, socket.assigns.current_user))
      |> assign_deals()

    {:ok, socket}
  end

  @impl true
  def handle_event("transition", %{"id" => id, "transition" => transition}, socket) do
    actor = socket.assigns.current_user
    deal = Pipeline.get_deal!(id, actor: actor)

    case Ash.update(deal, %{}, action: transition_action(transition), actor: actor) do
      {:ok, _moved_deal} -> {:noreply, assign_deals(socket)}
      {:error, _error} -> {:noreply, put_flash(socket, :error, "Deal could not be moved")}
    end
  end

  defp transition_action(transition) do
    Enum.find(transition_actions(), &(Atom.to_string(&1) == transition)) ||
      raise ArgumentError, "unknown transition #{inspect(transition)}"
  end

  defp transition_actions do
    Deal |> AshStateMachine.Info.state_machine_transitions() |> Enum.map(& &1.action)
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
    |> assign(:permitted_transitions, Map.new(deals, &{&1.id, permitted_transitions(&1, socket)}))
  end

  defp permitted_transitions(deal, socket) do
    deal.stage
    |> transitions_from()
    |> Enum.filter(&Ash.can?({deal, &1}, socket.assigns.current_user))
  end

  defp transitions_from(stage) do
    Deal
    |> AshStateMachine.Info.state_machine_transitions()
    |> Enum.filter(&(stage in List.wrap(&1.from)))
    |> Enum.map(& &1.action)
  end

  defp transition_label(transition), do: transition |> Atom.to_string() |> String.capitalize()

  defp stage_label(stage), do: stage |> Atom.to_string() |> String.capitalize()

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
          <h2 class="font-semibold">{stage_label(stage)}</h2>
          <article
            :for={deal <- Map.get(@deals_by_stage, stage, [])}
            id={"deal-#{deal.id}"}
            class="card bg-base-200 p-3 space-y-1"
          >
            <.link navigate={~p"/deals/#{deal.id}"} class="font-medium">{deal.name}</.link>
            <p :if={deal.amount}>{deal.amount}</p>
            <p class="text-sm">{deal.company.name}</p>
            <div class="flex flex-wrap gap-1">
              <button
                :for={transition <- Map.fetch!(@permitted_transitions, deal.id)}
                type="button"
                class="btn btn-xs"
                data-transition={transition}
                phx-click="transition"
                phx-value-id={deal.id}
                phx-value-transition={transition}
              >
                {transition_label(transition)}
              </button>
            </div>
          </article>
        </section>
      </div>
    </Layouts.app>
    """
  end
end
