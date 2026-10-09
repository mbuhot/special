# CRM

## Scenario: Contact list shows every contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
Narrate: This is the contact list. A search box and a company filter sit above the contact table.
Then Sales rep sees "Ada Lovelace" in "Contacts"
Narrate: The contact table lists Ada Lovelace.
And Sales rep sees "Grace Hopper" in "Contacts"
Narrate: The contact table also lists Grace Hopper. Every contact has a row.

## Scenario: Searching contacts by name

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
Narrate: This is the contact list. It shows Ada Lovelace and Grace Hopper.
And Sales rep enters Grace into "Search"
Narrate: Grace is typed into the search box.
Then Sales rep sees "Grace Hopper" in "Contacts"
And Sales rep no longer sees "Ada Lovelace" in "Contacts"
Narrate: The contact table narrows to Grace Hopper. Ada Lovelace leaves the table.

## Scenario: Filtering contacts by company

Given a Company "Acme"
Given a Company "Globex"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Globex
When Sales rep opens Contact list
Narrate: This is the contact list. Ada Lovelace works at Acme. Grace Hopper works at Globex.
And Sales rep selects Acme in "Company filter"
Narrate: The company filter is set to Acme.
Then Sales rep sees "Ada Lovelace" in "Contacts"
And Sales rep no longer sees "Grace Hopper" in "Contacts"
Narrate: The contact table narrows to the contacts of Acme. Grace Hopper leaves the table.

## Scenario: Creating a contact

Given a Company "Acme"
When Sales rep opens Contact list
Narrate: This is the contact list. A New contact button sits above the table.
And Sales rep clicks "New contact"
Then Sales rep is on Contact editor
Narrate: The contact editor opens with an empty form.
When Sales rep enters Ada into "First name"
Narrate: The first name is Ada.
And Sales rep enters Lovelace into "Last name"
Narrate: The last name is Lovelace.
And Sales rep enters ada@acme.test into "Email"
Narrate: The email address is filled in.
And Sales rep enters 555-0100 into "Phone"
Narrate: The phone number is filled in.
And Sales rep selects Acme in "Company"
Narrate: The company is Acme.
And Sales rep clicks "Save"
Then Sales rep sees "Ada Lovelace" in "Contact name"
Narrate: The saved contact page shows the name Ada Lovelace. A new contact has been created.

## Scenario: Editing a contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact editor for Ada Lovelace
Narrate: This is the contact editor for Ada Lovelace. The form holds the current details.
And Sales rep enters Ada-Byron into "First name"
Narrate: The first name changes to Ada-Byron.
And Sales rep clicks "Save"
Then Sales rep sees "Ada-Byron Lovelace" in "Contact name"
Narrate: The contact page shows the new name Ada-Byron Lovelace.
