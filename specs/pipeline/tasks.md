# Pipeline

## Scenario: Adding a task to a deal

Story: As the sales rep, I need to add a task to Big deal, so that the next step is not forgotten.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Deal page for Big deal
Narrate: The deal page for Big deal shows the deal name, the stage, and a task table with a form for adding tasks.
Then Sales rep sees "Big deal" in "Deal name"
And Sales rep sees "lead" in "Stage"
Narrate: Big deal is in the lead stage.
When Sales rep enters Send-proposal into "Task title"
Narrate: The task title is Send-proposal.
And Sales rep enters 2026-01-20 into "Task due date"
Narrate: The due date is the twentieth of January.
And Sales rep clicks "Add task"
Then Sales rep sees "Send-proposal" in "Tasks"
Narrate: The task Send-proposal appears in the task table.
And Sales rep sees "2026-01-20" in "Tasks"
Narrate: The task row shows its due date.

## Scenario: Completing a task

Story: As the sales rep, I need to complete the task Send proposal, so that it is recorded as done.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open
When Sales rep opens Deal page for Big deal
Narrate: The deal page for Big deal lists the open task Send proposal. It has a Complete task button.
And Sales rep clicks "Complete task"
Then Sales rep sees "done" in "Tasks"
Narrate: The task status changes to done.
And Send proposal has status done

## Scenario: A task becomes overdue as time advances

Story: As the sales rep, I need to see Send proposal listed as overdue once its due date has passed, so that I notice work that is late.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-16, deal Big deal, status open
When Sales rep opens Deal page for Big deal
Narrate: The deal page for Big deal lists the task Send proposal, due on the sixteenth of January.
Then Sales rep does not see "Overdue tasks"
Narrate: The page has no overdue tasks region.
When time advances 2 days
Narrate: Two days pass. The due date is now behind.
And Sales rep opens Deal page for Big deal
Narrate: The deal page is opened again.
Then Sales rep sees "Send-proposal" in "Overdue tasks"
Narrate: An overdue tasks region appears. It lists the task Send-proposal.
