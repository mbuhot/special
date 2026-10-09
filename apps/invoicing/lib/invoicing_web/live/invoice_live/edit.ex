defmodule InvoicingWeb.InvoiceLive.Edit do
  @moduledoc "Edits an invoice's line items, live totals and status."

  use InvoicingWeb, :live_view

  alias Invoicing.Billing
  alias InvoicingWeb.AmountFormat

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    invoice = Billing.get_invoice!(id, load: [:total, line_items: [:line_total]])
    {:ok, socket |> assign(form: to_form(%{}, as: :invoice)) |> assign_invoice(invoice)}
  end

  @impl true
  def handle_event("validate", %{"invoice" => %{"lines" => lines_params}}, socket) do
    rows = rows_from_params(lines_params)
    total = total_of(rows)
    persist_rows(rows)
    {:noreply, assign(socket, rows: rows, total: total)}
  end

  def handle_event("validate", _params, socket), do: {:noreply, socket}

  def handle_event("add_line", _params, socket) do
    Billing.create_line_item!(%{invoice_id: socket.assigns.invoice.id})
    {:noreply, reload_invoice(socket)}
  end

  def handle_event("send", _params, socket) do
    case Billing.send_invoice(socket.assigns.invoice) do
      {:ok, _invoice} ->
        {:noreply, socket |> reload_invoice() |> put_flash(:info, "Invoice sent")}

      {:error, _error} ->
        {:noreply, put_flash(socket, :error, "Only a draft invoice can be sent")}
    end
  end

  defp reload_invoice(socket) do
    invoice =
      Billing.get_invoice!(socket.assigns.invoice.id,
        load: [:total, line_items: [:line_total]]
      )

    assign_invoice(socket, invoice)
  end

  defp assign_invoice(socket, invoice) do
    assign(socket,
      invoice: invoice,
      rows: Enum.map(invoice.line_items, &row_from_line_item/1),
      total: invoice.total
    )
  end

  defp row_from_line_item(line_item) do
    %{
      id: line_item.id,
      description: line_item.description,
      quantity: Integer.to_string(line_item.quantity),
      unit_price: Decimal.to_string(line_item.unit_price, :normal)
    }
  end

  defp rows_from_params(lines_params) do
    lines_params
    |> Enum.sort_by(fn {index, _line} -> String.to_integer(index) end)
    |> Enum.map(fn {_index, line} ->
      %{
        id: line["id"],
        description: line["description"],
        quantity: line["quantity"],
        unit_price: line["unit_price"]
      }
    end)
  end

  defp total_of(rows) do
    rows
    |> Enum.map(fn row ->
      Decimal.mult(parse_quantity(row.quantity), parse_price(row.unit_price))
    end)
    |> Enum.reduce(Decimal.new(0), &Decimal.add/2)
  end

  defp parse_quantity(text) do
    case Integer.parse(text) do
      {quantity, ""} -> Decimal.new(quantity)
      _unparsable -> Decimal.new(0)
    end
  end

  defp parse_price(text) do
    case Decimal.parse(text) do
      {price, ""} -> price
      _unparsable -> Decimal.new(0)
    end
  end

  defp persist_rows(rows) do
    Enum.each(rows, fn row ->
      line_item = Billing.get_line_item!(row.id)

      Billing.update_line_item(line_item, %{
        description: row.description,
        quantity: row.quantity,
        unit_price: row.unit_price
      })
    end)
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <.header>
        Invoice {@invoice.number}
        <:subtitle>
          <span id="invoice-status" class="badge badge-outline">{@invoice.status}</span>
        </:subtitle>
        <:actions>
          <.button id="send-invoice" variant="primary" phx-click="send">Send</.button>
        </:actions>
      </.header>

      <.form for={@form} id="invoice-form" phx-change="validate">
        <div
          :for={{row, index} <- Enum.with_index(@rows)}
          id={"line-#{index}"}
          class="grid grid-cols-6 gap-2"
        >
          <input type="hidden" name={"invoice[lines][#{index}][id]"} value={row.id} />
          <div class="col-span-3">
            <.input
              type="text"
              id={"line-#{index}-description"}
              name={"invoice[lines][#{index}][description]"}
              value={row.description}
              label="Description"
            />
          </div>
          <div class="col-span-1">
            <.input
              type="number"
              id={"line-#{index}-quantity"}
              name={"invoice[lines][#{index}][quantity]"}
              value={row.quantity}
              label="Quantity"
              min="0"
              step="1"
            />
          </div>
          <div class="col-span-2">
            <.input
              type="number"
              id={"line-#{index}-unit-price"}
              name={"invoice[lines][#{index}][unit_price]"}
              value={row.unit_price}
              label="Unit price"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </.form>

      <.button id="add-line" phx-click="add_line">Add line</.button>

      <div id="totals" class="text-lg font-semibold">
        Total <span id="invoice-total">{AmountFormat.format(@total)}</span>
      </div>
    </Layouts.app>
    """
  end
end
