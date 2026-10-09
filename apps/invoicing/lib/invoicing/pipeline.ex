defmodule Invoicing.Pipeline do
  @moduledoc "Deals moving through the sales pipeline."

  use Ash.Domain

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
