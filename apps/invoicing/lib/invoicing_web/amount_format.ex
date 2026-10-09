defmodule InvoicingWeb.AmountFormat do
  @moduledoc "Formats monetary amounts with two decimal places."

  @doc "Formats a Decimal as a plain string with two decimal places."
  def format(%Decimal{} = amount), do: amount |> Decimal.round(2) |> Decimal.to_string(:normal)
end
