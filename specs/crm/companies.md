# CRM

## Scenario: Company list shows every company

Given a Company "Acme"
Given a Company "Globex"
When Accounts opens Company list
Then Accounts sees "Acme" in "Companies"
And Accounts sees "Globex" in "Companies"
Narrate: The company table lists Acme and Globex.

## Scenario: Searching companies by name

Given a Company "Acme"
Given a Company "Globex"
When Accounts opens Company list
And Accounts enters Glo into "Search"
Then Accounts sees "Globex" in "Companies"
And Accounts no longer sees "Acme" in "Companies"
Narrate: The company table narrows to Globex.

## Scenario: Creating a company

When Accounts opens Company list
And Accounts clicks "New company"
Then Accounts is on Company editor
When Accounts enters Initech into "Name"
And Accounts enters initech.test into "Domain"
And Accounts enters Software into "Industry"
And Accounts clicks "Save"
Then Accounts sees "Initech" in "Company name"
Narrate: The saved company shows the name Initech.

## Scenario: Editing a company

Given a Company "Acme"
When Accounts opens Company editor for Acme
And Accounts enters Acme-Corp into "Name"
And Accounts clicks "Save"
Then Accounts sees "Acme-Corp" in "Company name"
Narrate: The company name changes to Acme-Corp.

## Scenario: Company page lists its contacts

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Accounts opens Company page for Acme
Then Accounts sees "Acme" in "Company name"
And Accounts sees "Ada Lovelace" in "Company contacts"
When Accounts clicks "Edit company"
Then Accounts is on Company editor
Narrate: The company page shows the name Acme, lists Ada Lovelace and offers an edit button.
