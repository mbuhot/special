defmodule Invoicing.Billing.InvoiceTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.Billing

  setup do
    customer = Billing.create_customer!(%{name: "Acme"})
    invoice = Billing.create_invoice!(%{number: "INV-001", customer_id: customer.id})
    %{invoice: invoice}
  end

  test "invoice total equals the sum of its line totals", %{invoice: invoice} do
    Billing.create_line_item!(%{
      invoice_id: invoice.id,
      description: "Widgets",
      quantity: 2,
      unit_price: "10.50"
    })

    Billing.create_line_item!(%{
      invoice_id: invoice.id,
      description: "Gadgets",
      quantity: 3,
      unit_price: "100"
    })

    reloaded_invoice = Billing.get_invoice!(invoice.id, load: [:total])

    assert Decimal.equal?(reloaded_invoice.total, Decimal.new("321.00")) == true
  end

  test "invoice without line items has a zero total", %{invoice: invoice} do
    reloaded_invoice = Billing.get_invoice!(invoice.id, load: [:total])

    assert Decimal.equal?(reloaded_invoice.total, Decimal.new(0)) == true
  end

  test "sending a draft invoice moves it to sent", %{invoice: invoice} do
    assert {:ok, sent_invoice} = Billing.send_invoice(invoice)

    assert sent_invoice.status == :sent
  end

  test "sending a sent invoice returns an error", %{invoice: invoice} do
    {:ok, sent_invoice} = Billing.send_invoice(invoice)

    assert {:error, %Ash.Error.Invalid{}} = Billing.send_invoice(sent_invoice)
  end

  test "a sent invoice can be marked paid", %{invoice: invoice} do
    {:ok, sent_invoice} = Billing.send_invoice(invoice)

    assert {:ok, paid_invoice} = Billing.mark_invoice_paid(sent_invoice)

    assert paid_invoice.status == :paid
  end

  test "a draft invoice cannot be marked paid", %{invoice: invoice} do
    assert {:error, %Ash.Error.Invalid{}} = Billing.mark_invoice_paid(invoice)
  end

  test "a draft invoice can be voided", %{invoice: invoice} do
    assert {:ok, voided_invoice} = Billing.void_invoice(invoice)

    assert voided_invoice.status == :void
  end

  test "a sent invoice cannot be voided", %{invoice: invoice} do
    {:ok, sent_invoice} = Billing.send_invoice(invoice)

    assert {:error, %Ash.Error.Invalid{}} = Billing.void_invoice(sent_invoice)
  end
end
