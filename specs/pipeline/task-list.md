# Pipeline

## Scenario: A sales rep sees only their own open tasks

Story: As the sales rep, I need to see my open tasks in one list, so that I know what to do next.
Given a User "Sales rep"
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
Given a Task "Draft contract" with title Draft-contract, due date 2026-01-21, deal Big deal, status open, assignee Sales manager
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-18, deal Big deal, status done, assignee Sales rep
When Sales rep opens Task list
Narrate: This is the task list. It shows the open tasks assigned to Sam Rivera.
Then Sales rep sees "Call-Ada" in "My tasks"
Narrate: The task Call-Ada is listed.
And Sales rep sees "20 Jan 2026" in "My tasks"
Narrate: The row shows the due date, the twentieth of January.
And Sales rep no longer sees "Draft-contract" in "My tasks"
Narrate: Draft-contract belongs to Morgan Lee. It is not listed.
And Sales rep no longer sees "Send-proposal" in "My tasks"
Narrate: Send-proposal is done. It is not listed.

## Scenario: A sales manager sees every open task with its assignee

Story: As the sales manager, I need to see every open task and who holds it, so that I can spot work that is stuck.
Given a User "Sales rep"
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
Given a Task "Draft contract" with title Draft-contract, due date 2026-01-21, deal Big deal, status open, assignee Sales manager
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-18, deal Big deal, status done, assignee Sales rep
When Sales manager opens Task list
Narrate: This is the task list for a sales manager. It shows the open tasks of everyone, with an Assignee column.
Then Sales manager sees "Call-Ada" in "My tasks"
And Sales manager sees "Sam Rivera" in "My tasks"
Narrate: Call-Ada is assigned to Sam Rivera.
And Sales manager sees "Draft-contract" in "My tasks"
And Sales manager sees "Morgan Lee" in "My tasks"
Narrate: Draft-contract is assigned to Morgan Lee.
And Sales manager no longer sees "Send-proposal" in "My tasks"
Narrate: The done task Send-proposal is not listed.

## Scenario: Filtering the task list to overdue tasks

Story: As the sales rep, I need to filter my tasks to those that are late, so that I deal with them first.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-10, deal Big deal, status open, assignee Sales rep
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
Given a Task "Plan review" with title Plan-review, due date 2026-02-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows three open tasks. A filter above the table is set to All open.
Then Sales rep sees "Plan-review" in "My tasks"
And Sales rep sees "Overdue" in "My tasks"
Narrate: An Overdue badge follows the due date of Call-Ada.
When Sales rep selects Overdue in "Task filter"
Narrate: The filter is set to Overdue.
Then Sales rep sees "Call-Ada" in "My tasks"
Narrate: Call-Ada was due on the tenth of January. It stays in the list.
And Sales rep no longer sees "Send-proposal" in "My tasks"
Narrate: Send-proposal is not late. It leaves the list.
And Sales rep no longer sees "Plan-review" in "My tasks"
Narrate: Plan-review leaves the list.

## Scenario: Filtering the task list to tasks due this week

Story: As the sales rep, I need to filter my tasks to those due in the next seven days, so that I plan my week.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-10, deal Big deal, status open, assignee Sales rep
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
Given a Task "Plan review" with title Plan-review, due date 2026-02-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows three open tasks.
And Sales rep selects Due this week in "Task filter"
Narrate: The filter is set to Due this week.
Then Sales rep sees "Send-proposal" in "My tasks"
Narrate: Send-proposal is due on the twentieth of January. It stays in the list.
And Sales rep no longer sees "Call-Ada" in "My tasks"
Narrate: Call-Ada is already late. It leaves the list.
And Sales rep no longer sees "Plan-review" in "My tasks"
Narrate: Plan-review is due in February. It leaves the list.

## Scenario: Completing a task from the task list

Story: As the sales rep, I need to complete a task from my list, so that the list holds only work still to do.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows the task Send-proposal. Its row has a Complete button.
Then Sales rep sees "Send-proposal" in "My tasks"
When Sales rep clicks "Complete task"
Then Sales rep no longer sees "Send-proposal" in "My tasks"
Narrate: The row leaves the list.
And Send proposal has status done

## Scenario: Opening a task's deal from its deal link

Story: As the sales rep, I need to jump from a task to its deal, so that I see the context of the work.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows the task Send-proposal with the name of its deal.
And Sales rep clicks "Deal link"
Then Sales rep is on Deal page
Narrate: The deal page opens.
And Sales rep sees "Big deal" in "Deal name"
Narrate: It is the page of Big deal.

## Scenario: Opening a task's deal from the row menu

Story: As the sales manager, I need to open a task's deal from the row menu, so that I reach the deal without leaving the row.
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales manager
When Sales manager opens Task list
Narrate: Each row of the task list for a sales manager ends with a menu button.
And Sales manager clicks "Task actions"
Narrate: The menu lists Open deal and Reassign.
And Sales manager clicks "Open deal"
Then Sales manager is on Deal page
Narrate: The deal page opens.
And Sales manager sees "Big deal" in "Deal name"
Narrate: It is the page of Big deal.

## Scenario: Adding a task from the task list

Story: As the sales rep, I need to add a task from my list, so that I can record work without opening the deal.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Task list
Narrate: The task list has a form above the table for adding a task. It has a title, a due date and a deal.
And Sales rep enters Send-proposal into "New task title"
Narrate: The title is Send-proposal.
And Sales rep enters 2026-01-20 into "New task due date"
Narrate: The due date is the twentieth of January.
And Sales rep selects Big deal in "New task deal"
Narrate: The deal is Big deal.
And Sales rep clicks "Add task"
Then Sales rep sees "Send-proposal" in "My tasks"
Narrate: The new task appears in the table. It is assigned to Sam Rivera.
And Sales rep sees "20 Jan 2026" in "My tasks"

## Scenario: A sales manager adds a task for a sales rep

Story: As the sales manager, I need to add a task and choose who does it, so that work is assigned when it is created.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales manager opens Task list
Narrate: The form for adding a task has an assignee menu for a sales manager.
And Sales manager enters Send-proposal into "New task title"
Narrate: The title is Send-proposal.
And Sales manager enters 2026-01-20 into "New task due date"
Narrate: The due date is the twentieth of January.
And Sales manager selects Big deal in "New task deal"
And Sales manager selects Sam Rivera in "New task assignee"
Narrate: The assignee is Sam Rivera.
And Sales manager clicks "Add task"
Then Sales manager sees "Send-proposal" in "My tasks"
And Sales manager sees "Sam Rivera" in "My tasks"
Narrate: The new task appears in the table with Sam Rivera as its assignee.

## Scenario: A sales manager reassigns a task from the row menu

Story: As the sales manager, I need to hand a task to another sales rep, so that the work goes to whoever has capacity.
Given a User "Sales rep"
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales manager
When Sales manager opens Task list
Narrate: The task list shows Send-proposal assigned to Morgan Lee.
And Sales manager clicks "Task actions"
Narrate: The row menu opens.
And Sales manager clicks "Reassign task"
Narrate: A reassign dialog opens beside the row. It has an assignee menu, Cancel and Reassign.
And Sales manager selects Sam Rivera in "Assignee"
Narrate: The assignee is set to Sam Rivera.
And Sales manager clicks "Reassign"
Then Sales manager sees "Sam Rivera" in "My tasks"
Narrate: The row now shows Sam Rivera as the assignee.
When Sales rep opens Task list
Narrate: Sam Rivera opens the task list.
Then Sales rep sees "Send-proposal" in "My tasks"
Narrate: The task Send-proposal is in the list of Sam Rivera.

## Scenario: Cancelling a reassignment keeps the assignee

Story: As the sales manager, I need to back out of a reassignment, so that a task stays with its holder when I change my mind.
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales manager
When Sales manager opens Task list
Narrate: The task list shows Send-proposal assigned to Morgan Lee.
And Sales manager clicks "Task actions"
And Sales manager clicks "Reassign task"
Narrate: The reassign dialog is open.
And Sales manager clicks "Cancel reassign"
Then Sales manager does not see "Assignee"
Narrate: The dialog closes.
And Sales manager sees "Morgan Lee" in "My tasks"
Narrate: The row still shows Morgan Lee.

## Scenario: A sales rep has no reassign menu

Story: As the sales manager, I need reassignment limited to managers and admins, so that work is not moved around by accident.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows the task Send-proposal with a Complete button.
Then Sales rep does not see "Task actions"
Narrate: The row has no menu button for a sales rep.
And Sales rep may not reassign Send proposal
Narrate: A sales rep cannot reassign the task Send proposal.
And Sales manager may reassign Send proposal
Narrate: A sales manager can reassign it.

## Scenario: Completing several tasks at once

Story: As the sales rep, I need to complete several tasks in one step, so that clearing a finished morning takes one click.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-21, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows two open tasks. Each row starts with a checkbox.
And Sales rep clicks "Select all tasks"
Then Sales rep sees "2 selected" in "Bulk actions"
Narrate: A bar above the table reads two selected. It offers Complete and Clear selection.
When Sales rep clicks "Complete selected"
Then Sales rep no longer sees "Call-Ada" in "My tasks"
And Sales rep no longer sees "Send-proposal" in "My tasks"
Narrate: Both rows leave the list.
And Call Ada has status done
And Send proposal has status done

## Scenario: Reassigning several tasks at once

Story: As the sales manager, I need to hand several tasks to one sales rep, so that a colleague's workload moves in one step.
Given a User "Sales rep"
Given a User "Sales manager"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-20, deal Big deal, status open, assignee Sales manager
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-21, deal Big deal, status open, assignee Sales manager
When Sales manager opens Task list
Narrate: The task list for a sales manager shows two tasks assigned to Morgan Lee.
And Sales manager clicks "Select all tasks"
Then Sales manager sees "2 selected" in "Bulk actions"
Narrate: The bar above the table reads two selected. It has an assignee menu and a Reassign button.
When Sales manager selects Sam Rivera in "Bulk assignee"
Narrate: The assignee is Sam Rivera.
And Sales manager clicks "Reassign selected"
Then Sales manager sees "Sam Rivera" in "My tasks"
Narrate: Both rows now show Sam Rivera.
And Sales manager does not see "Bulk actions"
Narrate: The selection clears and the bar closes.

## Scenario: Clearing a selection of tasks

Story: As the sales rep, I need to drop a selection I started by mistake, so that no bulk action touches the wrong tasks.
Given a User "Sales rep"
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Call Ada" with title Call-Ada, due date 2026-01-20, deal Big deal, status open, assignee Sales rep
When Sales rep opens Task list
Narrate: The task list shows the task Call-Ada with a checkbox.
And Sales rep clicks "Select task"
Then Sales rep sees "1 selected" in "Bulk actions"
Narrate: The bar above the table reads one selected.
When Sales rep clicks "Clear selection"
Then Sales rep does not see "Bulk actions"
Narrate: The bar closes. Call-Ada stays in the list.
And Sales rep sees "Call-Ada" in "My tasks"
