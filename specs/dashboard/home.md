# Dashboard

## Scenario: Dashboard counts open deals per stage

Given a Company "Acme"
Given a Deal "Lead one" with stage lead, company Acme
Given a Deal "Lead two" with stage lead, company Acme
Given a Deal "Proposal one" with stage proposal, company Acme
Given a Deal "Won one" with stage won, company Acme
When Sales rep opens Dashboard
Narrate: This is the dashboard. It has counters for open deals, overdue tasks and unpaid invoices.
Then Sales rep sees "lead 2" in "Open deals by stage"
Narrate: The open deals counter shows two deals in the lead stage.
And Sales rep sees "proposal 1" in "Open deals by stage"
Narrate: It shows one deal in the proposal stage. The won deal is closed. Only open deals are counted.

## Scenario: Dashboard counts overdue tasks

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Late task" with title Late-task, due date 2026-01-10, deal Big deal, status open
Given a Task "Future task" with title Future-task, due date 2026-02-01, deal Big deal, status open
When Sales rep opens Dashboard
Narrate: This is the dashboard. Two tasks are open. One is due in the past and one is due in the future.
Then Sales rep sees "1" in "Overdue tasks"
Narrate: The overdue tasks counter shows one. The future task is not counted.

## Scenario: Dashboard counts unpaid invoices

Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
Given an Invoice "INV-002" with status paid, company Acme
Given an Invoice "INV-003" with status draft, company Acme
When Accounts opens Dashboard
Narrate: This is the dashboard. Three invoices exist. One is sent, one is paid and one is a draft.
Then Accounts sees "2" in "Unpaid invoices"
Narrate: The unpaid invoices counter shows two. The paid invoice is not counted.
