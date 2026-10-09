# CRM

## Scenario: Timeline shows a contact's activities

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Activity "Intro call" with kind call, body Intro-call, occurred at 2026-01-10T10:00:00Z, contact Ada Lovelace
Given an Activity "Follow up" with kind email, body Follow-up, occurred at 2026-01-12T10:00:00Z, contact Ada Lovelace
When Accounts opens Contact page for Ada Lovelace
Then Accounts sees "Ada Lovelace" in "Contact name"
And Accounts sees "Follow-up" in "Timeline"
And Accounts sees "Intro-call" in "Timeline"
Narrate: The contact page shows the name Ada Lovelace and a timeline listing the follow-up email and the intro call.

## Scenario: Logging a note on a contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Accounts opens Contact page for Ada Lovelace
And Accounts selects note in "Activity kind"
And Accounts enters Called-about-renewal into "Activity body"
And Accounts clicks "Log activity"
Then Accounts sees "Called-about-renewal" in "Timeline"
And Accounts sees "2026-01-15" in "Timeline"
Narrate: The note appears in the timeline with today's date.

## Scenario: Activity timeline advances with the clock

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Accounts opens Contact page for Ada Lovelace
And time advances 2 days
And Accounts selects meeting in "Activity kind"
And Accounts enters Kickoff into "Activity body"
And Accounts clicks "Log activity"
Then Accounts sees "2026-01-17" in "Timeline"
Narrate: The meeting appears in the timeline dated two days later.
