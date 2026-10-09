# CRM

## Scenario: Contact list shows every contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Accounts opens Contact list
Then Accounts sees "Ada Lovelace" in "Contacts"
And Accounts sees "Grace Hopper" in "Contacts"
Narrate: The contact table lists Ada Lovelace and Grace Hopper.

## Scenario: Searching contacts by name

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Accounts opens Contact list
And Accounts enters Grace into "Search"
Then Accounts sees "Grace Hopper" in "Contacts"
And Accounts no longer sees "Ada Lovelace" in "Contacts"
Narrate: The contact table narrows to Grace Hopper.

## Scenario: Filtering contacts by company

Given a Company "Acme"
Given a Company "Globex"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Globex
When Accounts opens Contact list
And Accounts selects Acme in "Company filter"
Then Accounts sees "Ada Lovelace" in "Contacts"
And Accounts no longer sees "Grace Hopper" in "Contacts"
Narrate: The contact table narrows to the contacts of Acme.

## Scenario: Creating a contact

Given a Company "Acme"
When Accounts opens Contact list
And Accounts clicks "New contact"
Then Accounts is on Contact editor
When Accounts enters Ada into "First name"
And Accounts enters Lovelace into "Last name"
And Accounts enters ada@acme.test into "Email"
And Accounts enters 555-0100 into "Phone"
And Accounts selects Acme in "Company"
And Accounts clicks "Save"
Then Accounts sees "Ada Lovelace" in "Contact name"
Narrate: The saved contact shows the name Ada Lovelace.

## Scenario: Editing a contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Accounts opens Contact editor for Ada Lovelace
And Accounts enters Ada-Byron into "First name"
And Accounts clicks "Save"
Then Accounts sees "Ada-Byron Lovelace" in "Contact name"
Narrate: The contact name changes to Ada-Byron Lovelace.
