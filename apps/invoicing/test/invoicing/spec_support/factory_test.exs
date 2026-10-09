defmodule Invoicing.SpecSupport.FactoryTest do
  use Invoicing.DataCase, async: true

  alias Invoicing.SpecSupport.Factory

  test "creates an invoice for a customer from spec-spelled attributes" do
    customer = Factory.create("Customer", %{"name" => "Acme"})

    invoice =
      Factory.create("Invoice", %{
        "number" => "INV-001",
        "status" => "draft",
        "customer" => customer.id
      })

    reloaded = Factory.reload("Invoice", invoice.id)

    assert reloaded["status"] == "draft"
    assert reloaded["number"] == "INV-001"
    assert reloaded["customer"] == customer.id
  end

  test "creates an invoice in a non-draft status" do
    invoice = Factory.create("Invoice", %{"number" => "INV-002", "status" => "sent"})

    assert Factory.reload("Invoice", invoice.id)["status"] == "sent"
  end

  test "creates a customer for an invoice that names none" do
    invoice = Factory.create("Invoice", %{"number" => "INV-003"})

    assert Factory.reload("Invoice", invoice.id)["customer"] == invoice.customer_id
  end

  test "names an invoice after its ref" do
    invoice = Factory.create("Invoice", %{"status" => "draft"}, "INV-009")

    assert Factory.reload("Invoice", invoice.id)["number"] == "INV-009"
  end

  test "an explicit number overrides the ref" do
    invoice = Factory.create("Invoice", %{"number" => "INV-010"}, "INV-009")

    assert Factory.reload("Invoice", invoice.id)["number"] == "INV-010"
  end

  test "names a customer after its ref" do
    customer = Factory.create("Customer", %{}, "Acme")

    assert Factory.reload("Customer", customer.id)["name"] == "Acme"
  end

  test "reloads a line item with its line total" do
    invoice = Factory.create("Invoice", %{"number" => "INV-004"})

    line_item =
      Factory.create("LineItem", %{
        "invoice" => invoice.id,
        "quantity" => 3,
        "unit price" => "100"
      })

    reloaded = Factory.reload("LineItem", line_item.id)

    assert Decimal.equal?(reloaded["line_total"], Decimal.new(300)) == true
    assert Decimal.equal?(reloaded["unit price"], Decimal.new(100)) == true
  end

  test "creates a user with a role" do
    user = Factory.create("User", %{"email" => "admin@example.com", "role" => "admin"})

    assert Factory.reload("User", user.id)["role"] == "admin"
  end
end
