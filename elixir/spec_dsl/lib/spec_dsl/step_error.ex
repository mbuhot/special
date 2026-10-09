defmodule SpecDSL.StepError do
  @moduledoc "A step failure carrying the step id, Markdown line, text and the underlying exception."

  defexception [:step_id, :line, :text, :file, :exception, :stacktrace]

  @type t :: %__MODULE__{
          step_id: String.t(),
          line: non_neg_integer() | nil,
          text: String.t() | nil,
          file: String.t() | nil,
          exception: Exception.t(),
          stacktrace: Exception.stacktrace()
        }

  @impl true
  def message(%__MODULE__{} = error) do
    location = [error.file, error.line] |> Enum.reject(&is_nil/1) |> Enum.join(":")
    text = if error.text, do: " (#{error.text})", else: ""

    "step #{inspect(error.step_id)} at #{location}#{text} failed: " <>
      Exception.format_banner(:error, error.exception)
  end
end
