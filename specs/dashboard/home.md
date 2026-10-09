# Dashboard

## Scenario: Dashboard counts open deals per stage

Story: As the sales rep, I need to see how many deals are in each stage, so that I know where to spend my week.
Given a Company "Acme"
Given a Deal "Lead one" with stage lead, company Acme
Given a Deal "Lead two" with stage lead, company Acme
Given a Deal "Proposal one" with stage proposal, company Acme
Given a Deal "Won one" with stage won, company Acme
When Sales rep opens Dashboard
Narrate: The dashboard has three cards: open deals by stage, overdue tasks and unpaid invoices.
Then Sales rep sees "lead 2" in "Open deals by stage"
Narrate: The open deals counter shows two deals in the lead stage.
And Sales rep sees "proposal 1" in "Open deals by stage"
Narrate: It shows one deal in the proposal stage. The won deal is closed. Only open deals are counted.

## Scenario: Dashboard counts overdue tasks

Story: As the sales rep, I need to see how many tasks are overdue, so that I know which to chase first.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Late task" with title Late-task, due date 2026-01-10, deal Big deal, status open
Given a Task "Future task" with title Future-task, due date 2026-02-01, deal Big deal, status open
When Sales rep opens Dashboard
Narrate: The overdue tasks card sits beside two other cards. Two tasks are open. One is due in the past and one is due in the future.
Then Sales rep sees "1" in "Overdue tasks"
Narrate: The overdue tasks counter shows one. The future task is not counted.

## Scenario: Dashboard counts unpaid invoices

Story: As accounts, I need to see which invoices are still unpaid, so that I know who to chase for payment.
Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
Given an Invoice "INV-002" with status paid, company Acme
Given an Invoice "INV-003" with status draft, company Acme
When Accounts opens Dashboard
Narrate: The unpaid invoices card sits beside two other cards. Three invoices exist. One is sent, one is paid and one is a draft.
Then Accounts sees "2" in "Unpaid invoices"
Narrate: The unpaid invoices counter shows two. The paid invoice is not counted.

## Scenario: Dashboard shows the latest activity

Story: As the sales rep, I need to see the latest activity across every contact on the dashboard, so that I know what happened most recently.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given an Activity "Intro call" with kind call, body Intro-call, occurred at 2026-01-10T10:00:00Z, contact Ada Lovelace
Given an Activity "Follow up" with kind email, body Follow-up, occurred at 2026-01-12T10:00:00Z, contact Ada Lovelace
When Sales rep opens Dashboard
Narrate: The dashboard has a recent activity card. Ada Lovelace has two activities logged on different days.
Then Sales rep sees "Follow-up" before "Intro-call" in "Recent activity"
Narrate: The follow-up email is the newest activity. It is listed first. The intro call is listed below it.
And Sales rep sees "Ada Lovelace" in "Recent activity"
Narrate: Each activity shows the name of the contact it was logged against.
