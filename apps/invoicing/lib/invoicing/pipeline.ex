defmodule Invoicing.Pipeline do
  @moduledoc "Deals moving through the sales pipeline."

  use Ash.Domain

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
    end

    resource Invoicing.Pipeline.Task do
      define :create_task, action: :create
      define :list_tasks, action: :read, args: [:deal_id]
      define :complete_task, action: :complete
      define :get_task, action: :read, get_by: [:id]
    end
  end
end
