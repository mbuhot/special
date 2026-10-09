# Invoicing

## Scenario: Invoice list shows every invoice

Story: As accounts, I need to see every invoice in one list, so that I know what has been billed.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Given an Invoice "INV-002" with status sent, company Acme
When Accounts opens Invoice list
Narrate: The invoice list has a New invoice button above the invoice table.
Then Accounts sees "INV-001" in "Invoices"
Narrate: The invoice table lists INV-001.
And Accounts sees "INV-002" in "Invoices"
Narrate: The invoice table also lists INV-002. Every invoice has a row.

## Scenario: Creating an invoice from the list

Story: As accounts, I need to start a new invoice from the invoice list, so that a customer can be billed.
Given a Company "Acme"
When Accounts opens Invoice list
Narrate: The invoice list has a New invoice button above the invoice table.
And Accounts clicks "New invoice"
Then Accounts is on Invoice editor
Narrate: The invoice editor opens.
And Accounts sees "draft" in "Status"
Narrate: The status region shows draft. A new invoice starts as a draft.
