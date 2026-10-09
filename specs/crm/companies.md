# CRM

## Scenario: Company list shows every company

Given a Company "Acme"
Given a Company "Globex"
When Sales rep opens Company list
Then Sales rep sees "Acme" in "Companies"
And Sales rep sees "Globex" in "Companies"
Narrate: The company table lists Acme and Globex.

## Scenario: Searching companies by name

Given a Company "Acme"
Given a Company "Globex"
When Sales rep opens Company list
And Sales rep enters Glo into "Search"
Then Sales rep sees "Globex" in "Companies"
And Sales rep no longer sees "Acme" in "Companies"
Narrate: The company table narrows to Globex.

## Scenario: Creating a company

When Sales rep opens Company list
And Sales rep clicks "New company"
Then Sales rep is on Company editor
When Sales rep enters Initech into "Name"
And Sales rep enters initech.test into "Domain"
And Sales rep enters Software into "Industry"
And Sales rep clicks "Save"
Then Sales rep sees "Initech" in "Company name"
Narrate: The saved company shows the name Initech.

## Scenario: Editing a company

Given a Company "Acme"
When Sales rep opens Company editor for Acme
And Sales rep enters Acme-Corp into "Name"
And Sales rep clicks "Save"
Then Sales rep sees "Acme-Corp" in "Company name"
Narrate: The company name changes to Acme-Corp.

## Scenario: Company page lists its contacts and invoices

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Invoice "INV-001" with status sent, company Acme
When Sales rep opens Company page for Acme
Then Sales rep sees "Acme" in "Company name"
And Sales rep sees "Ada Lovelace" in "Company contacts"
And Sales rep sees "INV-001" in "Company invoices"
When Sales rep clicks "Edit company"
Then Sales rep is on Company editor
Narrate: The company page shows the name Acme, lists Ada Lovelace and the invoice INV-001, and offers an edit button.
