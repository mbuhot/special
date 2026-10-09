# CRM

## Scenario: Contact list shows every contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
Then Sales rep sees "Ada Lovelace" in "Contacts"
And Sales rep sees "Grace Hopper" in "Contacts"
Narrate: The contact table lists Ada Lovelace and Grace Hopper.

## Scenario: Searching contacts by name

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
And Sales rep enters Grace into "Search"
Then Sales rep sees "Grace Hopper" in "Contacts"
And Sales rep no longer sees "Ada Lovelace" in "Contacts"
Narrate: The contact table narrows to Grace Hopper.

## Scenario: Filtering contacts by company

Given a Company "Acme"
Given a Company "Globex"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Globex
When Sales rep opens Contact list
And Sales rep selects Acme in "Company filter"
Then Sales rep sees "Ada Lovelace" in "Contacts"
And Sales rep no longer sees "Grace Hopper" in "Contacts"
Narrate: The contact table narrows to the contacts of Acme.

## Scenario: Creating a contact

Given a Company "Acme"
When Sales rep opens Contact list
And Sales rep clicks "New contact"
Then Sales rep is on Contact editor
When Sales rep enters Ada into "First name"
And Sales rep enters Lovelace into "Last name"
And Sales rep enters ada@acme.test into "Email"
And Sales rep enters 555-0100 into "Phone"
And Sales rep selects Acme in "Company"
And Sales rep clicks "Save"
Then Sales rep sees "Ada Lovelace" in "Contact name"
Narrate: The saved contact shows the name Ada Lovelace.

## Scenario: Editing a contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact editor for Ada Lovelace
And Sales rep enters Ada-Byron into "First name"
And Sales rep clicks "Save"
Then Sales rep sees "Ada-Byron Lovelace" in "Contact name"
Narrate: The contact name changes to Ada-Byron Lovelace.
