defmodule InvoicingWeb.InvoiceLive.Edit do
  @moduledoc "Edits a draft invoice's details and lines with live totals, and moves it through its statuses."

  use InvoicingWeb, :live_view

  alias Invoicing.{Billing, CRM}

  @invoice_fields ~w(company_id issue_date due_date notes)
  @line_fields ~w(description quantity unit_price)

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    actor = socket.assigns.current_user

    companies = CRM.list_companies!(nil, actor: actor, query: [sort: [name: :asc]])

    socket =
      socket
      |> assign(:company_options, Enum.map(companies, &{&1.name, &1.id}))
      |> assign(:errors, [])
      |> assign(:form, to_form(%{}, as: :invoice))
      |> assign_invoice(load_invoice(id, actor))

    {:ok, socket}
  end

  @impl true
  def handle_event("validate", %{"invoice" => params}, %{assigns: %{can_edit: true}} = socket) do
    errors = save_invoice_changes(socket, params) ++ save_line_changes(socket, params)
    {:noreply, socket |> reload_invoice() |> assign(:errors, errors)}
  end

  def handle_event("validate", _params, socket), do: {:noreply, socket}

  def handle_event("add_line", _params, %{assigns: %{can_edit: true}} = socket) do
    result =
      Billing.create_line_item(%{invoice_id: socket.assigns.invoice.id},
        actor: socket.assigns.current_user
      )

    {:noreply, finish_change(socket, result)}
  end

  def handle_event("remove_line", %{"id" => line_id}, %{assigns: %{can_edit: true}} = socket) do
    result =
      case find_line(socket.assigns.invoice, line_id) do
        nil -> {:error, :unknown_line}
        line_item -> Billing.remove_line_item(line_item, actor: socket.assigns.current_user)
      end

    {:noreply, finish_change(socket, result)}
  end

  def handle_event("add_line", _params, socket), do: {:noreply, socket}
  def handle_event("remove_line", _params, socket), do: {:noreply, socket}

  def handle_event("send", _params, socket) do
    transition(socket, &Billing.send_invoice/2, "Only a draft invoice can be sent")
  end

  def handle_event("mark_paid", _params, socket) do
    transition(socket, &Billing.mark_invoice_paid/2, "Only a sent invoice can be marked paid")
  end

  def handle_event("void", _params, socket) do
    transition(socket, &Billing.void_invoice/2, "Only a draft invoice can be voided")
  end

  defp transition(socket, action, failure_message) do
    case action.(socket.assigns.invoice, actor: socket.assigns.current_user) do
      {:ok, _invoice} ->
        {:noreply, socket |> reload_invoice() |> assign(:errors, [])}

      {:error, _error} ->
        {:noreply, socket |> reload_invoice() |> assign(:errors, [failure_message])}
    end
  end

  defp finish_change(socket, result) do
    errors = result_errors(result)
    socket |> reload_invoice() |> assign(:errors, errors)
  end

  defp result_errors({:error, :unknown_line}), do: ["That line is not on this invoice"]
  defp result_errors({:error, error}), do: Billing.error_messages(error)
  defp result_errors(_success), do: []

  defp save_invoice_changes(socket, params) do
    invoice = socket.assigns.invoice
    changes = changed_values(params, @invoice_fields, &stored_invoice_text(invoice, &1))

    if changes == %{} do
      []
    else
      invoice
      |> Billing.update_invoice(changes, actor: socket.assigns.current_user)
      |> result_errors()
    end
  end

  defp save_line_changes(socket, params) do
    params
    |> Map.get("lines", %{})
    |> Map.values()
    |> Enum.flat_map(&save_line_change(socket, &1))
  end

  defp save_line_change(socket, line_params) do
    case find_line(socket.assigns.invoice, line_params["id"]) do
      nil ->
        ["That line is not on this invoice"]

      line_item ->
        changes = changed_values(line_params, @line_fields, &stored_line_text(line_item, &1))
        save_line_item(socket, line_item, changes)
    end
  end

  defp save_line_item(_socket, _line_item, changes) when changes == %{}, do: []

  defp save_line_item(socket, line_item, changes) do
    line_item
    |> Billing.update_line_item(changes, actor: socket.assigns.current_user)
    |> result_errors()
  end

  defp changed_values(params, fields, stored_text) do
    params
    |> Map.take(fields)
    |> Enum.reject(fn {field, submitted} ->
      same_value?(field, submitted, stored_text.(field))
    end)
    |> Map.new()
  end

  defp same_value?("unit_price", submitted, stored_text) do
    case {Decimal.parse(submitted), Decimal.parse(stored_text)} do
      {{submitted_price, ""}, {stored_price, ""}} -> Decimal.equal?(submitted_price, stored_price)
      _unparsable -> submitted == stored_text
    end
  end

  defp same_value?(_field, submitted, stored_text), do: submitted == stored_text

  defp stored_invoice_text(invoice, "company_id"), do: to_string(invoice.company_id)
  defp stored_invoice_text(invoice, "issue_date"), do: date_text(invoice.issue_date)
  defp stored_invoice_text(invoice, "due_date"), do: date_text(invoice.due_date)
  defp stored_invoice_text(invoice, "notes"), do: to_string(invoice.notes)

  defp stored_line_text(line_item, "description"), do: line_item.description
  defp stored_line_text(line_item, "quantity"), do: Integer.to_string(line_item.quantity)
  defp stored_line_text(line_item, "unit_price"), do: price_text(line_item.unit_price)

  defp find_line(invoice, line_id), do: Enum.find(invoice.line_items, &(&1.id == line_id))

  defp date_text(nil), do: ""
  defp date_text(date), do: Date.to_iso8601(date)

  defp price_text(price), do: price |> Decimal.round(2) |> Decimal.to_string(:normal)

  defp load_invoice(id, actor) do
    Billing.get_invoice!(id,
      actor: actor,
      load: [:total, :company, line_items: [:total]]
    )
  end

  defp reload_invoice(socket) do
    assign_invoice(socket, load_invoice(socket.assigns.invoice.id, socket.assigns.current_user))
  end

  defp assign_invoice(socket, invoice) do
    current_user = socket.assigns.current_user

    assign(socket,
      invoice: invoice,
      can_edit: invoice.status == :draft and Billing.can_update_invoice?(current_user, invoice),
      can_send: Billing.can_send_invoice?(current_user, invoice),
      can_mark_paid: Billing.can_mark_invoice_paid?(current_user, invoice),
      can_void: Billing.can_void_invoice?(current_user, invoice)
    )
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app
      flash={@flash}
      current_user={@current_user}
      current_path={@current_path}
      width={:wide}
    >
      <.header>
        <span id="invoice-number">{@invoice.number}</span>
        <:subtitle>
          <span id="invoice-status" class="capitalize">
            <.badge value={@invoice.status}>{@invoice.status}</.badge>
          </span>
        </:subtitle>
        <:actions>
          <div class="flex items-center gap-2">
            <.button :if={@can_send} id="send-invoice" variant="primary" phx-click="send">
              Send
            </.button>
            <.button
              :if={@can_mark_paid}
              id="mark-paid-invoice"
              variant="primary"
              phx-click="mark_paid"
            >
              Mark paid
            </.button>
            <.button :if={@can_void} id="void-invoice" phx-click="void">Void</.button>
          </div>
        </:actions>
      </.header>

      <div :if={@errors != []} id="invoice-errors" role="alert" class="alert alert-error mb-4">
        <ul>
          <li :for={message <- @errors}>{message}</li>
        </ul>
      </div>

      <.form
        for={@form}
        id="invoice-form"
        phx-change="validate"
        class="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"
      >
        <.details_card :if={@can_edit} invoice={@invoice} company_options={@company_options} />
        <.details_summary :if={!@can_edit} invoice={@invoice} />
        <.lines_card invoice={@invoice} can_edit={@can_edit} />
      </.form>
    </Layouts.app>
    """
  end

  attr :invoice, :map, required: true
  attr :company_options, :list, required: true

  defp details_card(assigns) do
    ~H"""
    <.card title="Details">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <label for="invoice-company" class="text-xs text-base-content/60">Company</label>
            <.company_link invoice={@invoice} />
          </div>
          <select
            id="invoice-company"
            name="invoice[company_id]"
            class="w-full select"
          >
            {Phoenix.HTML.Form.options_for_select(@company_options, @invoice.company_id)}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="invoice-issue-date" class="text-xs text-base-content/60">Issue date</label>
          <input
            id="invoice-issue-date"
            type="date"
            name="invoice[issue_date]"
            value={date_value(@invoice.issue_date)}
            class="w-full input"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="invoice-due-date" class="text-xs text-base-content/60">Due date</label>
          <input
            id="invoice-due-date"
            type="date"
            name="invoice[due_date]"
            value={date_value(@invoice.due_date)}
            class="w-full input"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="invoice-notes" class="text-xs text-base-content/60">Notes</label>
          <textarea id="invoice-notes" name="invoice[notes]" rows="4" class="w-full textarea">{@invoice.notes}</textarea>
        </div>
      </div>
    </.card>
    """
  end

  attr :invoice, :map, required: true

  defp details_summary(assigns) do
    ~H"""
    <.card title="Details">
      <.property label="Company">
        <span class="flex items-center gap-3">
          <span id="invoice-company">{@invoice.company.name}</span>
          <.company_link invoice={@invoice} />
        </span>
      </.property>
      <.property label="Issue date">
        <span id="invoice-issue-date">{Format.date(@invoice.issue_date)}</span>
      </.property>
      <.property label="Due date">
        <span id="invoice-due-date">{Format.date(@invoice.due_date)}</span>
      </.property>
      <.property label="Notes">
        <span id="invoice-notes">{@invoice.notes}</span>
      </.property>
    </.card>
    """
  end

  attr :invoice, :map, required: true

  defp company_link(assigns) do
    ~H"""
    <.link
      id="invoice-company-link"
      navigate={~p"/companies/#{@invoice.company_id}"}
      class="text-xs font-semibold text-primary"
    >
      Open {@invoice.company.name}
    </.link>
    """
  end

  attr :invoice, :map, required: true
  attr :can_edit, :boolean, required: true

  defp lines_card(assigns) do
    ~H"""
    <.card title="Lines">
      <table id="lines" class="w-full border-collapse text-sm">
        <thead>
          <tr class="text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
            <th class="py-2 pr-3">Description</th>
            <th class="w-20 py-2 pr-3">Qty</th>
            <th class="w-28 py-2 pr-3">Unit price</th>
            <th class="w-24 py-2 pl-3 text-right">Line total</th>
            <th :if={@can_edit} class="w-12 py-2"><span class="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          <.empty_row :if={@invoice.line_items == []} colspan={5}>No lines yet</.empty_row>
          <tr
            :for={{line_item, index} <- Enum.with_index(@invoice.line_items)}
            id={"line-#{index}"}
            class="border-t border-base-300"
          >
            <td :if={@can_edit} class="py-2 pr-3">
              <input type="hidden" name={"invoice[lines][#{index}][id]"} value={line_item.id} />
              <textarea
                id={"line-#{index}-description"}
                name={"invoice[lines][#{index}][description]"}
                rows="1"
                aria-label="Description"
                class="w-full textarea textarea-sm resize-none"
              >{line_item.description}</textarea>
            </td>
            <td :if={@can_edit} class="py-2 pr-3">
              <input
                type="number"
                id={"line-#{index}-quantity"}
                name={"invoice[lines][#{index}][quantity]"}
                value={line_item.quantity}
                min="0"
                step="1"
                aria-label="Quantity"
                class="w-full input input-sm"
              />
            </td>
            <td :if={@can_edit} class="py-2 pr-3">
              <input
                type="text"
                inputmode="decimal"
                id={"line-#{index}-unit-price"}
                name={"invoice[lines][#{index}][unit_price]"}
                value={price_text(line_item.unit_price)}
                aria-label="Unit price"
                class="w-full input input-sm"
              />
            </td>
            <td :if={!@can_edit} class="py-3 pr-3">{line_item.description}</td>
            <td :if={!@can_edit} class="py-3 pr-3">{line_item.quantity}</td>
            <td :if={!@can_edit} class="py-3 pr-3">{Format.money(line_item.unit_price)}</td>
            <td id={"line-#{index}-total"} class="py-2 pl-3 text-right">
              {Format.money(line_item.total)}
            </td>
            <td :if={@can_edit} class="py-2 pl-3 text-right">
              <button
                type="button"
                id={"line-#{index}-remove"}
                phx-click="remove_line"
                phx-value-id={line_item.id}
                aria-label="Remove line"
                class="btn btn-sm btn-square btn-outline"
              >
                <.icon name="hero-x-mark" class="size-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div :if={@can_edit} class="border-t border-base-300 py-4">
        <.button id="add-line" type="button" phx-click="add_line">Add line</.button>
      </div>

      <div
        id="totals"
        class="flex w-60 flex-col gap-2 self-end border-t border-base-300 pt-3 text-sm"
      >
        <div class="flex justify-between">
          <span>Subtotal</span><span>{Format.money(@invoice.total)}</span>
        </div>
        <div class="flex justify-between font-bold">
          <span>Total</span><span>{Format.money(@invoice.total)}</span>
        </div>
      </div>
    </.card>
    """
  end

  defp date_value(nil), do: ""
  defp date_value(date), do: Date.to_iso8601(date)
end
