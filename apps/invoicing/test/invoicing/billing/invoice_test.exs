defmodule Invoicing.Billing.InvoiceTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.{Accounts, Billing}

  setup do
    accountant = Accounts.create_user!(%{email: "accounts@example.com", role: :accountant})
    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin})
    customer = Billing.create_customer!(%{name: "Acme"}, actor: accountant)

    invoice =
      Billing.create_invoice!(%{number: "INV-001", customer_id: customer.id}, actor: accountant)

    %{invoice: invoice, accountant: accountant, admin: admin}
  end

  test "invoice total equals the sum of its line totals", %{
    invoice: invoice,
    accountant: accountant
  } do
    Billing.create_line_item!(
      %{invoice_id: invoice.id, description: "Widgets", quantity: 2, unit_price: "10.50"},
      actor: accountant
    )

    Billing.create_line_item!(
      %{invoice_id: invoice.id, description: "Gadgets", quantity: 3, unit_price: "100"},
      actor: accountant
    )

    reloaded_invoice = Billing.get_invoice!(invoice.id, load: [:total], actor: accountant)

    assert Decimal.equal?(reloaded_invoice.total, Decimal.new("321.00")) == true
  end

  test "invoice without line items has a zero total", %{invoice: invoice, accountant: accountant} do
    reloaded_invoice = Billing.get_invoice!(invoice.id, load: [:total], actor: accountant)

    assert Decimal.equal?(reloaded_invoice.total, Decimal.new(0)) == true
  end

  test "sending a draft invoice moves it to sent", %{invoice: invoice, accountant: accountant} do
    assert {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert sent_invoice.status == :sent
  end

  test "sending a sent invoice returns an error", %{invoice: invoice, accountant: accountant} do
    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert {:error, %Ash.Error.Invalid{}} = Billing.send_invoice(sent_invoice, actor: accountant)
  end

  test "a sent invoice can be marked paid", %{
    invoice: invoice,
    accountant: accountant,
    admin: admin
  } do
    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert {:ok, paid_invoice} = Billing.mark_invoice_paid(sent_invoice, actor: admin)

    assert paid_invoice.status == :paid
  end

  test "an accountant cannot mark an invoice paid", %{invoice: invoice, accountant: accountant} do
    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert {:error, %Ash.Error.Forbidden{}} =
             Billing.mark_invoice_paid(sent_invoice, actor: accountant)
  end

  test "a draft invoice cannot be marked paid", %{invoice: invoice, admin: admin} do
    assert {:error, %Ash.Error.Invalid{}} = Billing.mark_invoice_paid(invoice, actor: admin)
  end

  test "an admin can void a draft invoice", %{invoice: invoice, admin: admin} do
    assert {:ok, voided_invoice} = Billing.void_invoice(invoice, actor: admin)

    assert voided_invoice.status == :void
  end

  test "a sent invoice cannot be voided", %{
    invoice: invoice,
    accountant: accountant,
    admin: admin
  } do
    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert {:error, %Ash.Error.Invalid{}} = Billing.void_invoice(sent_invoice, actor: admin)
  end
end
