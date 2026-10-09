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
