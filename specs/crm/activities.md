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
And Sales rep selects Note in "Activity kind"
Narrate: The activity kind is set to Note.
And Sales rep enters Called-about-renewal into "Activity body"
Narrate: The note text is typed into the activity body.
And Sales rep clicks "Log activity"
Then Sales rep sees "Called-about-renewal" in "Timeline"
Narrate: The note appears in the timeline.
And Sales rep sees "15 Jan 2026" in "Timeline"
Narrate: The note carries today's date. The timeline now shows the logged note.

## Scenario: Activity timeline advances with the clock

Story: As the sales rep, I need to log a Kickoff meeting for Ada Lovelace, so that her timeline shows the date it took place.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact page for Ada Lovelace
Narrate: The contact page for Ada Lovelace has an empty timeline.
And time advances 2 days
Narrate: Two days pass.
And Sales rep selects Meeting in "Activity kind"
Narrate: The activity kind is set to Meeting.
And Sales rep enters Kickoff into "Activity body"
Narrate: The meeting text Kickoff is typed into the activity body.
And Sales rep clicks "Log activity"
Then Sales rep sees "17 Jan 2026" in "Timeline"
Narrate: The meeting appears in the timeline. It is dated two days after the contact page was opened.

## Scenario: Timeline shows who logged each activity and when

Story: As the sales rep, I need to see who logged each activity and on what date, so that I can judge how recent and how reliable it is.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Activity "Intro call" with kind call, body Intro-call, occurred at 2026-01-10T10:00:00Z, contact Ada Lovelace
When Sales rep opens Contact page for Ada Lovelace
Narrate: This is the contact page for Ada Lovelace. The timeline lists one activity.
Then Sales rep sees "Call" in "Timeline"
Narrate: The activity kind reads Call.
And Sales rep sees "10 Jan 2026" in "Timeline"
Narrate: The date reads the tenth of January 2026.
And Sales rep sees "Sam Rivera" in "Timeline"
Narrate: The author reads Sam Rivera.
