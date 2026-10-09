# CRM

## Scenario: Timeline shows a contact's activities

Story: As the sales rep, I need to see the activities logged for Ada Lovelace, so that I know what was last said to her.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Activity "Intro call" with kind call, body Intro-call, occurred at 2026-01-10T10:00:00Z, contact Ada Lovelace
Given an Activity "Follow up" with kind email, body Follow-up, occurred at 2026-01-12T10:00:00Z, contact Ada Lovelace
When Sales rep opens Contact page for Ada Lovelace
Narrate: The contact page for Ada Lovelace shows her name at the top. Below it is the timeline of activities.
Then Sales rep sees "Ada Lovelace" in "Contact name"
And Sales rep sees "Follow-up" in "Timeline"
Narrate: The follow-up email is the newest activity. It is listed first in the timeline.
And Sales rep sees "Follow-up" before "Intro-call" in "Timeline"
And Sales rep sees "Intro-call" in "Timeline"
Narrate: The intro call is the older activity. It is listed below the follow-up. The timeline lists the newest activity first.

## Scenario: Logging a note on a contact

Story: As the sales rep, I need to log a note on Ada Lovelace, so that the team can see what was discussed.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact page for Ada Lovelace
Narrate: The contact page for Ada Lovelace has a timeline and a form for logging an activity.
And Sales rep selects note in "Activity kind"
Narrate: The activity kind is set to note.
And Sales rep enters Called-about-renewal into "Activity body"
Narrate: The note text is typed into the activity body.
And Sales rep clicks "Log activity"
Then Sales rep sees "Called-about-renewal" in "Timeline"
Narrate: The note appears in the timeline.
And Sales rep sees "2026-01-15" in "Timeline"
Narrate: The note carries today's date. The timeline now shows the logged note.

## Scenario: Activity timeline advances with the clock

Story: As the sales rep, I need to log a Kickoff meeting for Ada Lovelace, so that her timeline shows the date it took place.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact page for Ada Lovelace
Narrate: The contact page for Ada Lovelace has an empty timeline.
And time advances 2 days
Narrate: Two days pass.
And Sales rep selects meeting in "Activity kind"
Narrate: The activity kind is set to meeting.
And Sales rep enters Kickoff into "Activity body"
Narrate: The meeting text Kickoff is typed into the activity body.
And Sales rep clicks "Log activity"
Then Sales rep sees "2026-01-17" in "Timeline"
Narrate: The meeting appears in the timeline. It is dated two days after the contact page was opened.
