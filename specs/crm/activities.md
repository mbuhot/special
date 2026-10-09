# CRM

## Scenario: Timeline shows a contact's activities

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Activity "Intro call" with kind call, body Intro-call, occurred at 2026-01-10T10:00:00Z, contact Ada Lovelace
Given an Activity "Follow up" with kind email, body Follow-up, occurred at 2026-01-12T10:00:00Z, contact Ada Lovelace
When Sales rep opens Contact page for Ada Lovelace
Then Sales rep sees "Ada Lovelace" in "Contact name"
And Sales rep sees "Follow-up" in "Timeline"
And Sales rep sees "Follow-up" before "Intro-call" in "Timeline"
And Sales rep sees "Intro-call" in "Timeline"
Narrate: The contact page shows the name Ada Lovelace and a timeline listing the newest activity first: the follow-up email, then the intro call.

## Scenario: Logging a note on a contact

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact page for Ada Lovelace
And Sales rep selects note in "Activity kind"
And Sales rep enters Called-about-renewal into "Activity body"
And Sales rep clicks "Log activity"
Then Sales rep sees "Called-about-renewal" in "Timeline"
And Sales rep sees "2026-01-15" in "Timeline"
Narrate: The note appears in the timeline with today's date.

## Scenario: Activity timeline advances with the clock

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact page for Ada Lovelace
And time advances 2 days
And Sales rep selects meeting in "Activity kind"
And Sales rep enters Kickoff into "Activity body"
And Sales rep clicks "Log activity"
Then Sales rep sees "2026-01-17" in "Timeline"
Narrate: The meeting appears in the timeline dated two days later.
