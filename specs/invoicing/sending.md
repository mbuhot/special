# Invoicing

## Scenario: Sending a draft invoice marks it sent

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
And INV-001 has status sent
Narrate: The invoice status changes to sent.

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
