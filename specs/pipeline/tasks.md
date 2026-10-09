# Pipeline

## Scenario: Adding a task to a deal

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Deal page for Big deal
Then Sales rep sees "Big deal" in "Deal name"
And Sales rep sees "lead" in "Stage"
When Sales rep enters Send-proposal into "Task title"
And Sales rep enters 2026-01-20 into "Task due date"
And Sales rep clicks "Add task"
Then Sales rep sees "Send-proposal" in "Tasks"
And Sales rep sees "2026-01-20" in "Tasks"
Narrate: The deal page shows the new task Send-proposal in the task table with its due date.

## Scenario: Completing a task

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open
When Sales rep opens Deal page for Big deal
And Sales rep clicks "Complete task"
Then Sales rep sees "done" in "Tasks"
And Send proposal has status done
Narrate: The task status changes to done.

## Scenario: A task becomes overdue as time advances

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-16, deal Big deal, status open
When Sales rep opens Deal page for Big deal
Then Sales rep does not see "Overdue tasks"
When time advances 2 days
And Sales rep opens Deal page for Big deal
Then Sales rep sees "Send-proposal" in "Overdue tasks"
Narrate: Two days later the task appears in the overdue tasks region.
