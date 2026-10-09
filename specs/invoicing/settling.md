# Invoicing

## Scenario: Marking a sent invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
When Admin opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001. The status is sent. A Mark paid button is available.
And Admin clicks "Mark paid"
Then Admin sees "paid" in "Status"
Narrate: Mark paid changes the status to paid.
And INV-001 has status paid

## Scenario: Voiding a draft invoice

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Admin opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001. The status is draft. A Void button is available.
And Admin clicks "Void"
Then Admin sees "void" in "Status"
Narrate: Void changes the status to void.
And INV-001 has status void

## Scenario: Only an admin can void or mark an invoice paid

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Then Accounts may send INV-001
Narrate: Accounts can send the draft invoice INV-001.
And Accounts may not void INV-001
Narrate: Accounts cannot void the invoice.
And Admin may void INV-001
Narrate: An admin can void the invoice.
When Accounts opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001, opened by Accounts.
Then Accounts does not see "Void"
Narrate: The editor has no Void button.
And Accounts does not see "Mark paid"
Narrate: The editor has no Mark paid button. Accounts has the Send button.

## Scenario: Marking an invoice paid logs a note on the company's contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Invoice "INV-001" with status sent, company Acme
When Admin opens Invoice editor for INV-001
Narrate: This is the invoice editor for INV-001. The status is sent. The company Acme has a contact, Ada Lovelace.
And Admin clicks "Mark paid"
Then Admin sees "paid" in "Status"
Narrate: Mark paid changes the status to paid.
When Admin opens Contact page for Ada Lovelace
Narrate: This is the contact page for Ada Lovelace.
Then Admin sees "Invoice INV-001 paid" in "Timeline"
Narrate: The timeline holds a new note. The note reads Invoice INV-001 paid.
