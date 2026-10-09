# Invoicing

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
