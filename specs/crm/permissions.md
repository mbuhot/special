# CRM

## Scenario: Who may edit contacts

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Then Sales rep may update Ada Lovelace
Narrate: A sales rep can edit the contact Ada Lovelace.
And Accounts may not update Ada Lovelace
Narrate: Accounts can read the contact and cannot edit it.
And Sales rep may update Acme
Narrate: A sales rep can edit the company Acme.
And Accounts may update Acme
Narrate: Accounts can also edit the company Acme. Both roles can edit companies.
