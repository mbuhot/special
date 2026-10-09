defmodule Invoicing.Clock do
  @moduledoc "The current time, optionally frozen at a fixed instant."

  @frozen_key {__MODULE__, :frozen_at}

  @doc "Returns the frozen instant when set, otherwise the current UTC time."
  def now do
    case :persistent_term.get(@frozen_key, nil) do
      nil -> DateTime.utc_now()
      frozen_at -> frozen_at
    end
  end

  @doc "Freezes the clock at the given instant."
  def freeze(%DateTime{} = frozen_at), do: :persistent_term.put(@frozen_key, frozen_at)

  @doc "Resumes the real clock."
  def unfreeze do
    :persistent_term.erase(@frozen_key)
    :ok
  end
end
