defmodule Invoicing.Pipeline do
  @moduledoc "Deals moving through the sales pipeline."

  use Ash.Domain, extensions: [AshBoundary]

  boundary do
    deps([Invoicing])
  end

  require Ash.Query

  @open_stages [:lead, :qualified, :proposal]

  resources do
    resource Invoicing.Pipeline.Deal do
      define :create_deal, action: :create
      define :update_deal, action: :update
      define :get_deal, action: :read, get_by: [:id]
      define :list_deals, action: :read
      define :qualify_deal, action: :qualify
      define :propose_deal, action: :propose
      define :win_deal, action: :win
      define :lose_deal, action: :lose
      define :reassign_deal, action: :reassign, args: [:owner_id]
    end

    resource Invoicing.Pipeline.Task do
      define :create_task, action: :create
      define :list_tasks, action: :read, args: [:deal_id]
      define :complete_task, action: :complete
      define :get_task, action: :read, get_by: [:id]
    end
  end

  @doc "Lists the contact's deals by close date."
  def list_contact_deals!(contact_id, opts \\ []) do
    list_deals!(with_deal_query(opts, contact_id: contact_id))
  end

  @doc "Lists the company's deals by close date."
  def list_company_deals!(company_id, opts \\ []) do
    list_deals!(with_deal_query(opts, company_id: company_id))
  end

  defp with_deal_query(opts, filter) do
    Keyword.put(opts, :query, filter: filter, sort: [close_date: :asc_nils_last, name: :asc])
  end

  @doc "Moves the deal through the named transition."
  def transition_deal(deal, :qualify, opts), do: qualify_deal(deal, %{}, opts)
  def transition_deal(deal, :propose, opts), do: propose_deal(deal, %{}, opts)
  def transition_deal(deal, :win, opts), do: win_deal(deal, %{}, opts)
  def transition_deal(deal, :lose, opts), do: lose_deal(deal, %{}, opts)

  @doc "Returns whether the actor may move the deal through the named transition."
  def can_transition_deal?(actor, deal, :qualify), do: can_qualify_deal?(actor, deal)
  def can_transition_deal?(actor, deal, :propose), do: can_propose_deal?(actor, deal)
  def can_transition_deal?(actor, deal, :win), do: can_win_deal?(actor, deal)
  def can_transition_deal?(actor, deal, :lose), do: can_lose_deal?(actor, deal)

  @doc "Returns the transitions available from a stage."
  def deal_transitions_from(stage) do
    Invoicing.Pipeline.Deal
    |> AshStateMachine.Info.state_machine_transitions()
    |> Enum.filter(&(stage in List.wrap(&1.from)))
    |> Enum.map(& &1.action)
  end

  @doc "Returns the transition whose name is the given string."
  def parse_deal_transition(name) do
    Invoicing.Pipeline.Deal
    |> AshStateMachine.Info.state_machine_transitions()
    |> Enum.map(& &1.action)
    |> Enum.find(&(Atom.to_string(&1) == name)) ||
      raise ArgumentError, "unknown transition #{inspect(name)}"
  end

  @doc "Returns {stage, count} for each open stage in pipeline order."
  def count_open_deals_by_stage(actor) do
    Enum.map(@open_stages, fn stage ->
      {stage,
       Invoicing.Pipeline.Deal |> Ash.Query.filter(stage == ^stage) |> Ash.count!(actor: actor)}
    end)
  end

  @doc "Returns the number of open tasks due before the given date."
  def count_overdue_tasks(today, actor) do
    Invoicing.Pipeline.Task
    |> Ash.Query.filter(status == :open and due_date < ^today)
    |> Ash.count!(actor: actor)
  end
end
