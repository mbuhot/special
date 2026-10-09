# CRM

## Scenario: Who may edit contacts

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Then Sales rep may update Ada Lovelace
And Accounts may not update Ada Lovelace
And Sales rep may update Acme
And Accounts may update Acme
Narrate: A sales rep may edit the contact Ada Lovelace. Accounts may only read her. Both roles may edit the company Acme.
