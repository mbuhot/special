# Invoicing

## Scenario: Marking a sent invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
When Manager opens Invoice editor for INV-001
And Manager clicks "Mark paid"
Then Manager sees "paid" in "Status"
And INV-001 has status paid
Narrate: The invoice status changes to paid.

## Scenario: Voiding a draft invoice

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Manager opens Invoice editor for INV-001
And Manager clicks "Void"
Then Manager sees "void" in "Status"
And INV-001 has status void
Narrate: The invoice status changes to void.

## Scenario: Only a manager can void or mark an invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Then Accounts may send INV-001
And Accounts may not void INV-001
And Manager may void INV-001
When Accounts opens Invoice editor for INV-001
Then Accounts does not see "Void"
And Accounts does not see "Mark paid"
Narrate: The accountant's editor shows Send and no Void or Mark paid.
