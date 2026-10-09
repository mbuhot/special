# Invoicing

## Scenario: Sending a draft invoice marks it sent

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
And INV-001 has status sent
Narrate: The invoice status changes to sent.

## Scenario: A manager sees an invoice once it is sent

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Caption: The admin now reviews the same invoice.
When Admin opens Invoice editor for INV-001
Then Admin sees "sent" in "Status"
Narrate: The admin sees the invoice with status sent.
