# CRM

## Scenario: Company list shows every company

Given a Company "Acme"
Given a Company "Globex"
When Sales rep opens Company list
Narrate: This is the company list. A search box sits above the company table.
Then Sales rep sees "Acme" in "Companies"
Narrate: The company table lists Acme.
And Sales rep sees "Globex" in "Companies"
Narrate: The company table also lists Globex. Every company has a row.

## Scenario: Searching companies by name

Given a Company "Acme"
Given a Company "Globex"
When Sales rep opens Company list
Narrate: This is the company list. It shows Acme and Globex.
And Sales rep enters Glo into "Search"
Narrate: Glo is typed into the search box.
Then Sales rep sees "Globex" in "Companies"
And Sales rep no longer sees "Acme" in "Companies"
Narrate: The company table narrows to Globex. Acme leaves the table.

## Scenario: Creating a company

When Sales rep opens Company list
Narrate: This is the company list. A New company button sits above the table.
And Sales rep clicks "New company"
Then Sales rep is on Company editor
Narrate: The company editor opens with an empty form.
When Sales rep enters Initech into "Name"
Narrate: The company name is Initech.
And Sales rep enters initech.test into "Domain"
Narrate: The domain is filled in.
And Sales rep enters Software into "Industry"
Narrate: The industry is Software.
And Sales rep clicks "Save"
Then Sales rep sees "Initech" in "Company name"
Narrate: The saved company page shows the name Initech. A new company has been created.

## Scenario: Editing a company

Given a Company "Acme"
When Sales rep opens Company editor for Acme
Narrate: This is the company editor for Acme. The form holds the current details.
And Sales rep enters Acme-Corp into "Name"
Narrate: The company name changes to Acme-Corp.
And Sales rep clicks "Save"
Then Sales rep sees "Acme-Corp" in "Company name"
Narrate: The company page shows the new name Acme-Corp.

## Scenario: Company page lists its contacts and invoices

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Invoice "INV-001" with status sent, company Acme
When Sales rep opens Company page for Acme
Narrate: This is the company page for Acme. The company name is at the top.
Then Sales rep sees "Acme" in "Company name"
And Sales rep sees "Ada Lovelace" in "Company contacts"
Narrate: The contacts region lists Ada Lovelace.
And Sales rep sees "INV-001" in "Company invoices"
Narrate: The invoices region lists the invoice INV-001.
When Sales rep clicks "Edit company"
Then Sales rep is on Company editor
Narrate: The Edit company button opens the company editor for Acme.
