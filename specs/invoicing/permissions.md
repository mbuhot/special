# Invoicing

## Scenario: Who may send and settle invoices

Story: As the admin, I need accounts to send invoices and only an admin to void them, so that invoices go out routinely and are cancelled deliberately.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Then Accounts may send INV-001
Narrate: Accounts can send the draft invoice INV-001.
And Sales rep may not send INV-001
Narrate: A sales rep cannot send the invoice.
And Admin may void INV-001
Narrate: An admin can void the invoice.
And Accounts may not void INV-001
Narrate: Accounts cannot void the invoice.
When Sales rep opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001, opened by a sales rep.
Then Sales rep does not see "Send"
Narrate: The editor has no Send button for a sales rep.

## Scenario: A sales rep sees an invoice but cannot edit it

Story: As the sales rep, I need to see INV-001 without changing it, so that I know what the company was billed.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Sales rep opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001, opened by a sales rep.
Then Sales rep does not see "Add line"
Narrate: The editor has no Add line button for a sales rep.
And Sales rep does not see "Send"
Narrate: The editor has no Send button for a sales rep.
And Sales rep may not update INV-001
Narrate: A sales rep cannot change the invoice.
