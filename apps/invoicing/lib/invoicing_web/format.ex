defmodule InvoicingWeb.Format do
  @moduledoc "Display formats for amounts, dates, enum labels and user roles."

  @currency_symbol "$"

  @doc "Formats a Decimal with the currency symbol, thousands separators and two decimals."
  def money(nil), do: ""

  def money(%Decimal{} = amount) do
    [whole, fraction] = amount |> Decimal.round(2) |> Decimal.to_string(:normal) |> split_amount()
    {sign, digits} = sign_and_digits(whole)
    "#{sign}#{@currency_symbol}#{group_thousands(digits)}.#{fraction}"
  end

  @doc "Formats a date as day, short month and year."
  def date(nil), do: ""
  def date(value), do: Calendar.strftime(value, "%-d %b %Y")

  @doc "Formats a datetime as date and hour:minute."
  def datetime(nil), do: ""
  def datetime(value), do: Calendar.strftime(value, "%-d %b %Y %H:%M")

  @doc "Returns an atom as a capitalised word."
  def label(value), do: value |> to_string() |> String.capitalize()

  @doc "Returns the label shown for a user's role."
  def role_label(:sales), do: "Sales rep"
  def role_label(:manager), do: "Sales manager"
  def role_label(:accountant), do: "Accounts"
  def role_label(:admin), do: "Admin"

  defp sign_and_digits("-" <> digits), do: {"-", digits}
  defp sign_and_digits(digits), do: {"", digits}

  defp split_amount(text) do
    case String.split(text, ".") do
      [whole] -> [whole, "00"]
      [whole, fraction] -> [whole, String.pad_trailing(fraction, 2, "0")]
    end
  end

  defp group_thousands(digits) do
    digits
    |> String.reverse()
    |> String.replace(~r/(\d{3})(?=\d)/, "\\1,")
    |> String.reverse()
  end
end
