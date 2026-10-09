defmodule Invoicing.Billing.InvoiceTest do
  use Invoicing.DataCase, async: false

  alias Invoicing.{Accounts, Billing, Clock, CRM}

  setup do
    accountant =
      Accounts.create_user!(%{email: "accounts@example.com", role: :accountant},
        authorize?: false
      )

    admin = Accounts.create_user!(%{email: "admin@example.com", role: :admin}, authorize?: false)
    company = CRM.create_company!(%{name: "Acme"}, actor: accountant)

    invoice =
      Billing.create_invoice!(%{number: "INV-001", company_id: company.id}, actor: accountant)

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

  test "marking an invoice paid logs a note on the company's primary contact", %{
    invoice: invoice,
    accountant: accountant,
    admin: admin
  } do
    Clock.freeze(~U[2026-01-15 09:00:00Z])
    on_exit(&Clock.unfreeze/0)
    company_id = invoice.company_id

    primary_contact =
      CRM.create_contact!(%{first_name: "Ada", last_name: "Lovelace", company_id: company_id},
        actor: admin
      )

    CRM.create_contact!(%{first_name: "Grace", last_name: "Hopper", company_id: company_id},
      actor: admin
    )

    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)
    {:ok, _paid_invoice} = Billing.mark_invoice_paid(sent_invoice, actor: admin)

    assert [note] = CRM.list_activities!(primary_contact.id, actor: admin)
    assert note.kind == :note
    assert note.body == "Invoice INV-001 paid"
    assert note.occurred_at == ~U[2026-01-15 09:00:00Z]
    assert note.user_id == admin.id
  end

  test "marking paid with no contact logs nothing", %{
    invoice: invoice,
    accountant: accountant,
    admin: admin
  } do
    {:ok, sent_invoice} = Billing.send_invoice(invoice, actor: accountant)

    assert {:ok, paid_invoice} = Billing.mark_invoice_paid(sent_invoice, actor: admin)
    assert paid_invoice.status == :paid
    assert Ash.count!(CRM.Activity, actor: admin) == 0
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
