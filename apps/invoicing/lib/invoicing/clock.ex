defmodule Invoicing.Clock do
  @moduledoc "The current time, optionally frozen per process or globally at a fixed instant."

  @frozen_key {__MODULE__, :frozen_at}

  @doc "Returns the instant frozen for this process or its callers, then the global one, then the current UTC time."
  def now do
    case process_frozen_at() || :persistent_term.get(@frozen_key, nil) do
      nil -> DateTime.utc_now()
      frozen_at -> frozen_at
    end
  end

  @doc "Freezes the clock at the given instant for the calling process and the processes it spawns."
  def freeze(%DateTime{} = frozen_at) do
    Process.put(@frozen_key, frozen_at)
    :ok
  end

  @doc "Resumes the real clock for the calling process."
  def unfreeze do
    Process.delete(@frozen_key)
    :ok
  end

  @doc "Freezes the clock at the given instant for every process."
  def freeze_globally(%DateTime{} = frozen_at), do: :persistent_term.put(@frozen_key, frozen_at)

  @doc "Resumes the real clock for every process."
  def unfreeze_globally do
    :persistent_term.erase(@frozen_key)
    :ok
  end

  defp process_frozen_at do
    [self() | Process.get(:"$callers", [])]
    |> Enum.find_value(&frozen_at_in/1)
  end

  defp frozen_at_in(pid) when pid == self(), do: Process.get(@frozen_key)

  defp frozen_at_in(pid) do
    case Process.info(pid, :dictionary) do
      {:dictionary, dictionary} ->
        dictionary |> List.keyfind(@frozen_key, 0, {nil, nil}) |> elem(1)

      nil ->
        nil
    end
  end
end
