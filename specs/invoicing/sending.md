# Invoicing

## Scenario: Sending a draft invoice marks it sent

Story: As accounts, I need to send the draft invoice INV-001, so that the customer is billed.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor shows INV-001 with status draft. A Send button is available.
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Narrate: Send changes the status to sent.
And INV-001 has status sent

## Scenario: A manager sees an invoice once it is sent

Story: As accounts, I need to send the invoice INV-001, so that the admin can review it.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor shows INV-001 with status draft. A Send button is available.
And Accounts clicks "Send"
Then Accounts sees "sent" in "Status"
Narrate: Send changes the status to sent.
Caption: The admin now reviews the same invoice.
When Admin opens Invoice editor for INV-001
Narrate: The admin opens the invoice editor for INV-001.
Then Admin sees "sent" in "Status"
Narrate: The status region shows sent. The admin sees the invoice that Accounts sent.
