# Invoicing

## Model
- Customer: name, email
- Invoice: number, status, total. Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description, quantity, unit price. Belongs to Invoice.

## Surfaces
- Invoice list: table "Invoices", button "New invoice"
- Invoice editor: field "Quantity", field "Unit price", region "Totals", region "Status", button "Send"

## Actors
- Accounts: role accountant

## Scenario: Line total updates as quantity changes
Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
Then Accounts sees "100.00" in "Totals"
When Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
Narrate: The line total updates as the quantity changes.

## Scenario: Sending a draft invoice marks it sent
Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
And INV-001 has status sent
Narrate: The invoice status changes to sent.
