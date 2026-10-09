# Invoicing

## Scenario: Marking a sent invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
When Admin opens Invoice editor for INV-001
And Admin clicks "Mark paid"
Then Admin sees "paid" in "Status"
And INV-001 has status paid
Narrate: The invoice status changes to paid.

## Scenario: Voiding a draft invoice

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Admin opens Invoice editor for INV-001
And Admin clicks "Void"
Then Admin sees "void" in "Status"
And INV-001 has status void
Narrate: The invoice status changes to void.

## Scenario: Only an admin can void or mark an invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Then Accounts may send INV-001
And Accounts may not void INV-001
And Admin may void INV-001
When Accounts opens Invoice editor for INV-001
Then Accounts does not see "Void"
And Accounts does not see "Mark paid"
Narrate: The accountant's editor shows Send and no Void or Mark paid.

## Scenario: Marking an invoice paid logs a note on the company's contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Invoice "INV-001" with status sent, company Acme
When Admin opens Invoice editor for INV-001
And Admin clicks "Mark paid"
Then Admin sees "paid" in "Status"
When Admin opens Contact page for Ada Lovelace
Then Admin sees "Invoice INV-001 paid" in "Timeline"
Narrate: The invoice status changes to paid. On Ada Lovelace's page, the timeline shows the note Invoice INV-001 paid.
