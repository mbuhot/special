# CRM

## Scenario: Contact list shows every contact

Story: As the sales rep, I need to see every contact in one list, so that I can find who to call.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
Narrate: The contact list has a search box and a company filter above the contact table.
Then Sales rep sees "Ada Lovelace" in "Contacts"
Narrate: The contact table lists Ada Lovelace.
And Sales rep sees "Grace Hopper" in "Contacts"
Narrate: The contact table also lists Grace Hopper. Every contact has a row.

## Scenario: Searching contacts by name

Story: As the sales rep, I need to find Grace Hopper by searching for her first name, so that I can reach her without scrolling the whole list.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Acme
When Sales rep opens Contact list
Narrate: The contact list shows Ada Lovelace and Grace Hopper.
And Sales rep enters Grace into "Search"
Narrate: Grace is typed into the search box.
Then Sales rep sees "Grace Hopper" in "Contacts"
And Sales rep no longer sees "Ada Lovelace" in "Contacts"
Narrate: The contact table narrows to Grace Hopper. Ada Lovelace leaves the table.

## Scenario: Filtering contacts by company

Story: As the sales rep, I need to see only the contacts at Acme, so that I can follow up with one customer at a time.
Given a Company "Acme"
Given a Company "Globex"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Contact "Grace Hopper" with first name Grace, last name Hopper, company Globex
When Sales rep opens Contact list
Narrate: The contact list shows Ada Lovelace, who works at Acme, and Grace Hopper, who works at Globex.
And Sales rep selects Acme in "Company filter"
Narrate: The company filter is set to Acme.
Then Sales rep sees "Ada Lovelace" in "Contacts"
And Sales rep no longer sees "Grace Hopper" in "Contacts"
Narrate: The contact table narrows to the contacts of Acme. Grace Hopper leaves the table.

## Scenario: Creating a contact

Story: As the sales rep, I need to add Ada Lovelace as a new contact at Acme, so that her details are on record.
Given a Company "Acme"
When Sales rep opens Contact list
Narrate: The contact list has a New contact button above the table.
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

Story: As the sales rep, I need to change Ada Lovelace's first name to Ada-Byron, so that her record carries the correct name.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact editor for Ada Lovelace
Narrate: This is the contact editor for Ada Lovelace. The form holds her current details.
And Sales rep enters Ada-Byron into "First name"
Narrate: The first name changes to Ada-Byron.
And Sales rep clicks "Save"
Then Sales rep sees "Ada-Byron Lovelace" in "Contact name"
Narrate: The contact page shows the new name Ada-Byron Lovelace.

## Scenario: Contact page shows the contact's details

Story: As the sales rep, I need to see Ada Lovelace's email, phone and company on her page, so that I can reach her without opening another screen.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, email ada@acme.example, phone 555-0100, company Acme
When Sales rep opens Contact page for Ada Lovelace
Narrate: This is the contact page for Ada Lovelace. A properties panel sits below her name.
Then Sales rep sees "ada@acme.example" in "Properties"
Narrate: The properties panel shows the email address.
And Sales rep sees "555-0100" in "Properties"
Narrate: It also shows the phone number.
And Sales rep sees "Acme" in "Company link"
Narrate: The company link reads Acme.
When Sales rep clicks "Company link"
Then Sales rep is on Company page
Narrate: The company link opens the company page for Acme.
When Sales rep opens Contact page for Ada Lovelace
And Sales rep clicks "Edit contact"
Then Sales rep is on Contact editor
Narrate: The Edit contact button opens the contact editor for Ada Lovelace.

## Scenario: Cancelling a contact edit discards it

Story: As the sales rep, I need to leave the contact editor without saving, so that a change I started by mistake is not kept.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact editor for Ada Lovelace
Narrate: This is the contact editor for Ada Lovelace. Save and Cancel sit below the form.
And Sales rep enters Grace into "First name"
Narrate: The first name is Grace.
And Sales rep clicks "Cancel"
Then Sales rep is on Contact list
Narrate: The contact list opens.
And Ada Lovelace has first name Ada
