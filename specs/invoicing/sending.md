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

## Scenario: Invoice details are shown and saved

Story: As accounts, I need to set the company, dates and notes on INV-001, so that the customer receives a complete invoice.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows the company, issue date, due date and notes.
And Accounts selects Acme in "Company"
Narrate: The company is Acme.
And Accounts enters 2026-01-15 into "Issue date"
Narrate: The issue date is the fifteenth of January 2026.
And Accounts enters 2026-02-14 into "Due date"
Narrate: The due date is the fourteenth of February 2026.
And Accounts enters Thanks-for-your-business into "Notes"
Narrate: The notes read Thanks-for-your-business.
Then Accounts sees "Acme" in "Company link"
Narrate: The company link shows Acme.
And INV-001 has issue date 2026-01-15
And INV-001 has due date 2026-02-14
