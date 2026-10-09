# Invoicing

## Scenario: Sending a draft invoice marks it sent

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001. The status is draft. A Send button is available.
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Narrate: Send changes the status to sent.
And INV-001 has status sent

## Scenario: A manager sees an invoice once it is sent

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001. The status is draft. A Send button is available.
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Narrate: Send changes the status to sent.
Caption: The admin now reviews the same invoice.
When Admin opens Invoice editor for INV-001
Narrate: The admin opens the invoice editor for INV-001.
Then Admin sees "sent" in "Status"
Narrate: The status region shows sent. The admin sees the invoice that Accounts sent.
