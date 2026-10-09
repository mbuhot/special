# Dashboard

## Scenario: Dashboard counts open deals per stage

Given a Company "Acme"
Given a Deal "Lead one" with stage lead, company Acme
Given a Deal "Lead two" with stage lead, company Acme
Given a Deal "Proposal one" with stage proposal, company Acme
Given a Deal "Won one" with stage won, company Acme
When Sales rep opens Dashboard
Then Sales rep sees "lead 2" in "Open deals by stage"
And Sales rep sees "proposal 1" in "Open deals by stage"
Narrate: The dashboard lists two deals in lead and one in proposal. The won deal is closed and does not appear.

## Scenario: Dashboard counts overdue tasks

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Late task" with title Late-task, due date 2026-01-10, deal Big deal, status open
Given a Task "Future task" with title Future-task, due date 2026-02-01, deal Big deal, status open
When Sales rep opens Dashboard
Then Sales rep sees "1" in "Overdue tasks"
Narrate: The dashboard shows one overdue task.

## Scenario: Dashboard counts unpaid invoices

Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme
Given an Invoice "INV-002" with status paid, company Acme
Given an Invoice "INV-003" with status draft, company Acme
When Accounts opens Dashboard
Then Accounts sees "2" in "Unpaid invoices"
Narrate: The dashboard shows two unpaid invoices. The paid invoice is not counted.
