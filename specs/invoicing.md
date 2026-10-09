# Invoicing

## Model

- Customer: name, email. Has many Invoice.
- Invoice: number, status, total. Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description, quantity, unit price. Belongs to Invoice.

## Surfaces

- Invoice list: table "Invoices", button "New invoice"
- Invoice editor: field "Quantity", field "Unit price", region "Totals", region "Status", button "Send", button "Mark paid", button "Void"

## Actors

- Accounts: role accountant
- Manager: role admin

## Policies

- Customer: accountant may read, create, update
- Customer: admin may read, create, update
- Invoice: accountant may read, create, update, send
- Invoice: admin may read, create, update, send, mark paid, void
- LineItem: accountant may read, create, update
- LineItem: admin may read, create, update

## Scenario: Line total updates as quantity changes

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
Then Accounts sees "100.00" in "Totals"
When Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
When Accounts enters 50 into "Unit price"
Then Accounts sees "150.00" in "Totals"
Narrate: The line total updates as the quantity and the unit price change.

## Scenario: Sending a draft invoice marks it sent

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
And INV-001 has status sent
Narrate: The invoice status changes to sent.

## Scenario: Marking a sent invoice paid

Given a Customer "Acme"
Given an Invoice "INV-001" with status sent, customer Acme
When Manager opens Invoice editor for INV-001
And Manager clicks "Mark paid"
Then Manager sees "paid" in "Status"
And INV-001 has status paid
Narrate: The invoice status changes to paid.

## Scenario: Voiding a draft invoice

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Manager opens Invoice editor for INV-001
And Manager clicks "Void"
Then Manager sees "void" in "Status"
And INV-001 has status void
Narrate: The invoice status changes to void.

## Scenario: Invoice list shows every invoice

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Given an Invoice "INV-002" with status sent, customer Acme
When Accounts opens Invoice list
Then Accounts sees "INV-001" in "Invoices"
And Accounts sees "INV-002" in "Invoices"
Narrate: The invoice table lists INV-001 and INV-002.

## Scenario: Creating an invoice from the list

Given a Customer "Acme"
When Accounts opens Invoice list
And Accounts clicks "New invoice"
Then Accounts is on Invoice editor
And Accounts sees "draft" in "Status"
Narrate: A new draft invoice opens in the editor.

## Scenario: A manager sees an invoice once it is sent

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Caption: The manager now reviews the same invoice.
When Manager opens Invoice editor for INV-001
Then Manager sees "sent" in "Status"
Narrate: The manager sees the invoice with status sent.

## Scenario: Only a manager can void or mark an invoice paid

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Then Accounts may send INV-001
And Accounts may not void INV-001
And Manager may void INV-001
When Accounts opens Invoice editor for INV-001
Then Accounts does not see "Void"
And Accounts does not see "Mark paid"
Narrate: The accountant's editor shows Send and no Void or Mark paid.
