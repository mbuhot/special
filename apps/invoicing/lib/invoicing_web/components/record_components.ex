defmodule InvoicingWeb.RecordComponents do
  @moduledoc "Cards, property rows and status badges used by record pages."

  use Phoenix.Component

  alias InvoicingWeb.Format

  @doc "A bordered card with a title."
  attr :id, :string, default: nil
  attr :title, :string, required: true
  slot :inner_block, required: true

  def card(assigns) do
    ~H"""
    <section id={@id} class="flex min-w-0 flex-col rounded-lg border border-base-300 p-5">
      <h2 class="mb-3 text-base font-semibold">{@title}</h2>
      {render_slot(@inner_block)}
    </section>
    """
  end

  @doc "A label and value row inside a properties card."
  attr :label, :string, required: true
  slot :inner_block, required: true

  def property(assigns) do
    ~H"""
    <div class="flex items-center justify-between gap-4 border-t border-base-300 py-3">
      <span class="text-[13px] text-base-content/60">{@label}</span>
      <span class="text-sm">{render_slot(@inner_block)}</span>
    </div>
    """
  end

  @doc "A pill showing a stage, status or kind; the label defaults to the capitalised value."
  attr :value, :atom, required: true
  attr :rest, :global
  slot :inner_block

  def badge(assigns) do
    ~H"""
    <span
      class={[
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tint(@value)
      ]}
      {@rest}
    >
      {if @inner_block == [], do: Format.label(@value), else: render_slot(@inner_block)}
    </span>
    """
  end

  defp tint(value) when value in [:lead, :draft, :open], do: "bg-slate-100 text-slate-600"
  defp tint(value) when value in [:qualified, :sent], do: "bg-blue-50 text-blue-700"
  defp tint(:proposal), do: "bg-amber-100 text-amber-700"
  defp tint(value) when value in [:won, :paid, :done], do: "bg-green-100 text-green-700"
  defp tint(value) when value in [:lost, :void], do: "bg-red-100 text-red-700"
  defp tint(_kind), do: "bg-blue-50 text-blue-700"
end
