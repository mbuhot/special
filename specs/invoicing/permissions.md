# Invoicing

## Scenario: Who may send and settle invoices

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Then Accounts may send INV-001
And Sales rep may not send INV-001
And Admin may void INV-001
And Accounts may not void INV-001
When Sales rep opens Invoice editor for INV-001
Then Sales rep does not see "Send"
Narrate: The sales rep's invoice editor shows no Send button. Accounts may send the draft. Only an admin may void it.
