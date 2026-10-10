# Design sync proposal 2026-10-10

Canvas: https://claude.ai/artifact/Vwe4b8Fhj1R3tkNCcE4ygS. Designs pulled in commit `Pull designs from the canvas`; controls declared in commit `Declare controls the canvas added`. Everything below changes `specs/` or `dialects/` and waits for approval. Strike a section to drop it; `/design-sync approved` applies the rest.

## Summary

| #   | Group                | Change                                                                        |
| --- | -------------------- | ----------------------------------------------------------------------------- |
| M1  | Model and rules      | Actors carry person names                                                     |
| M2  | Model and rules      | User gains `name`                                                             |
| M3  | Model and rules      | Derived: Task due this week, User assignable                                  |
| M4  | Model and rules      | Task policies: `reassign`, `see all`                                          |
| M5  | Model and rules      | Business, GST fields and tax codes                                            |
| M6  | Model and rules      | GST invariants                                                                |
| M7  | Model and rules      | Derived: Invoice is tax invoice                                               |
| M8  | Model and rules      | Control "Invoice title" on the Invoice editor                                 |
| R1  | Removed or replaced  | Pipeline board buttons Qualify, Propose, Win, Lose (replaced by Stage select) |
| R2  | Removed or replaced  | Deal page region "Overdue tasks" (replaced by Overdue badge)                  |
| N1  | Scenarios new        | Task list (15 scenarios)                                                      |
| N2  | Scenarios new        | Tasks reachable from sidebar and dashboard card                               |
| N3  | Scenarios new        | Cancel on contact, company and deal editors                                   |
| N4  | Scenarios new        | Stage menu offers only permitted stages                                       |
| N5  | Scenarios new        | Invoice GST (7 scenarios)                                                     |
| C1  | Scenarios changed    | Board stage scenarios and their composite steps                               |
| C2  | Scenarios changed    | "Who may move a deal" loses its Win button check                              |
| C3  | Scenarios changed    | "A task becomes overdue as time advances" uses the Overdue badge              |
| C4  | Scenarios changed    | Person names in sidebar and timeline scenarios                                |
| Q   | Questions for design | Artboard edits the proposal depends on                                        |

## Model and rules

### M1. Actors carry person names

File: `specs/actors.md`. Design source: every artboard shows `{{ user.name }}` in "Signed in as"; Task list shows Sam Rivera, Morgan Lee, Alex Chen, Jordan Patel.

```markdown
# Shared

## Actors

- Sales rep: role sales, named Sam Rivera
- Sales manager: role manager, named Morgan Lee
- Accounts: role accountant, named Alex Chen
- Admin: role admin, named Jordan Patel
```

### M2. User gains `name`

File: `specs/user.md`, Model section. The actor name becomes the display name of the actor's User record.

```markdown
- User: name (text, required), email (email, required), role (one of sales, manager, accountant, admin, required).
```

### M3. Derived: Task due this week, User assignable

File: `specs/pipeline/derived.md`. Design source: Task filter option `dueThisWeek`; Reassign pickers list users flagged `assignable`. The design sample marks Jordan Patel (admin) assignable; the agreed scope (docs/plans/ui.md) is role sales or manager, which this text follows.

```markdown
- Task is overdue when status is open and due date is before today
- Task is due this week when status is open and due date is within 7 days of today
- User is assignable when role is sales or role is manager
- Deal is open when stage is lead or stage is qualified or stage is proposal
- Overdue tasks counts Task that are overdue
- Open deals counts Deal that are open
```

### M4. Task policies: `reassign` and `see all`

File: `specs/pipeline/model.md`, Policies section. Design source: `task.canReassign` gates the row menu; `canSeeAllTasks` gates the Assignee column and the assignee pickers. Sales reps keep read, create, update, complete and see their own tasks.

```markdown
- Task: sales may read, create, update, complete
- Task: manager may read, create, update, complete, reassign, see all
- Task: accountant may read
- Task: admin may read, create, update, complete, reassign, see all
```

The artboard prop is `canSeeAllTasks`; the permission-flag convention yields `canSeeAll` from the action `see all`. Pass 2 either renames the prop on the canvas or the design runtime maps it (see Q4).

### M5. Business, GST fields and tax codes

File: `specs/invoicing/model.md`. Design source: Supplier block (business name, ABN), GST rate, Prices select (Exclude GST, Include GST), per-line Tax code (GST, GST-free, Exempt), Subtotal and GST in the totals.

```markdown
- Business: name (text, required), abn (text, required). Has many Invoice as supplied invoices.
- Invoice: number (text, required), status, issue date (date, required), due date (date), gst rate (decimal), prices (one of exclude gst, include gst), notes (text), subtotal (money), gst (money), total (money). Belongs to Company. Belongs to Business as supplier. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description (text, required), quantity (integer, required), unit price (money, required), tax code (one of gst, gst-free, exempt), total (money). Belongs to Invoice.
- Company has many Invoice
```

`gst rate` is a percentage (10 shows as 10%). `prices` is an enumeration because it names two states; the artboard's `pricesIncludeGst` data-field becomes `prices` (Q2).

File: `specs/invoicing/policies.md`, appended.

```markdown
- Business: sales may read
- Business: manager may read
- Business: accountant may read
- Business: admin may read, update
```

### M6. GST invariants

File: `specs/invoicing/invariants.md`. GST is computed from GST-coded lines only; exempt and GST-free lines add to the subtotal. An invoice with no GST rate has GST of 0.

```markdown
- LineItem.total = quantity \* unit price
- Invoice.gst is computed from the LineItem.total of lines with tax code gst at gst rate: added to the lines when prices are exclude gst, contained in the lines when prices are include gst, rounded to the nearest cent
- Invoice.subtotal = sum of LineItem.total when prices are exclude gst, sum of LineItem.total less gst when prices are include gst
- Invoice.total = subtotal + gst
- Invoice.number is unique
- Invoice.number is assigned on creation as "INV-" followed by a 3 digit sequence
- Invoice.status only changes through send, mark paid, void
```

This replaces `Invoice.total = sum of LineItem.total`. The `Invariants` section has no shape for a filtered sum or a conditional formula; the three new lines need a language extension (a `where` filter on `sum of`, and `<Field> = <Field> + <Field>`) before they bind. The existing totals scenarios stay valid as written: their invoices set no GST rate, so GST is 0 and every total equals the sum of the lines.

### M7. Derived: Invoice is tax invoice

File: `specs/invoicing/derived.md`. Design source: the heading reads "Tax invoice INV-001" or "Invoice INV-001" through two flags. A tax invoice is an invoice that charges GST.

```markdown
- Invoice is unpaid when status is draft or status is sent
- Invoice is tax invoice when gst is above 0
- Unpaid invoices counts Invoice that are unpaid
```

The condition grammar compares date fields only; `<Field> is above <Number>` for money and decimal fields is a language extension. The predicate name `tax invoice` yields the props `taxInvoice` and `notTaxInvoice`. The artboard uses `isTaxInvoice` and `notIsTaxInvoice`, which read as machine-state flags (Q1).

### M8. Control "Invoice title" on the Invoice editor

Files: `specs/invoicing/surfaces.md`, `dialects/invoicing.ts`. The heading text "Tax invoice" sits outside every `data-control`; the "Invoice number" control wraps only the number. Needs the artboard to mark the h1 (Q3).

```markdown
- Invoice editor: design invoicing/invoice-editor, region "Invoice title", region "Invoice number", ...
```

```typescript
"Invoice title": region({ css: "#invoice-title", lv: "#invoice-title" }),
```

## Surfaces removed or replaced

### R1. Pipeline board: Qualify, Propose, Win, Lose

The board cards now hold one Stage select (options limited to permitted next stages) and the four transition buttons are gone from every artboard state. The Stage field is already declared. Decision: drop or restore. Recommended: drop; C1 and C2 rewrite the scenarios that click them.

If dropped:

File `specs/pipeline/surfaces.md`:

```markdown
- Pipeline board: design pipeline/pipeline-board, region "Lead column", region "Qualified column", region "Proposal column", region "Won column", region "Lost column", field "Stage", button "New deal"
```

File `dialects/pipeline.ts`: delete the `transitionButton` helper and the entries `Qualify`, `Propose`, `Win`, `Lose` of "Pipeline board". The Deal page keeps its own Qualify, Propose, Win, Lose buttons.

### R2. Deal page: region "Overdue tasks"

The separate Overdue section is removed; each overdue row in the Tasks table carries an Overdue badge (declared as region "Overdue badge"). The Dashboard keeps its own "Overdue tasks" count. Decision: drop or restore. Recommended: drop; C3 rewrites the scenario that reads it.

If dropped:

File `specs/pipeline/surfaces.md`:

```markdown
- Deal page: design pipeline/deal-page, region "Deal name", region "Properties", region "Stage", button "Qualify", button "Propose", button "Win", button "Lose", link "Company link", link "Contact link", table "Tasks", field "Task title", field "Task due date", button "Add task", button "Complete task", region "Overdue badge", link "View all my tasks"
```

File `dialects/pipeline.ts`: delete the `"Overdue tasks"` entry of "Deal page".

## Scenarios new

### N1. Task list

File: new `specs/pipeline/task-list.md`. Controls: every control of the Task list surface. Uses the pipeline Clock 2026-01-15.

```markdown
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
```

### N2. Tasks reachable from the sidebar, the dashboard card and the deal page

File: `specs/dashboard/navigation.md`, appended after "Dashboard cards open their sections". Controls: Sidebar "My tasks", Dashboard "View tasks", Deal page "View all my tasks".

```markdown
## Scenario: Tasks are one click from the sidebar and the dashboard card

Story: As the sales rep, I need to open my tasks from the dashboard, so that I act on the overdue count I see.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-10, deal Big deal, status open
When Sales rep opens Dashboard
Narrate: The sidebar has a My tasks link. The overdue tasks card has a View tasks link.
And Sales rep clicks "My tasks"
Then Sales rep is on Task list
Narrate: The sidebar link opens the task list.
When Sales rep opens Dashboard
Narrate: The dashboard is shown again.
And Sales rep clicks "View tasks"
Then Sales rep is on Task list
Narrate: The link on the overdue tasks card opens the task list.

## Scenario: Reaching the task list from the deal page

Story: As the sales rep, I need to reach my tasks from a deal, so that I do not search for them.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Deal page for Big deal
Narrate: The tasks table on the deal page ends with a View all my tasks link.
And Sales rep clicks "View all my tasks"
Then Sales rep is on Task list
Narrate: The link opens the task list.
```

### N3. Cancel on the contact, company and deal editors

Controls: Contact editor "Cancel", Company editor "Cancel", Deal editor "Cancel". Cancel leaves the form without saving.

File: `specs/crm/contacts.md`, appended.

```markdown
## Scenario: Cancelling a contact edit discards it

Story: As the sales rep, I need to leave the contact editor without saving, so that a change I started by mistake is not kept.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Contact editor for Ada Lovelace
Narrate: This is the contact editor for Ada Lovelace. Save and Cancel sit below the form.
And Sales rep enters Grace into "First name"
Narrate: The first name is Grace.
And Sales rep clicks "Cancel"
Then Sales rep is on Contact list
Narrate: The contact list opens.
And Ada Lovelace has first name Ada
```

File: `specs/crm/companies.md`, appended.

```markdown
## Scenario: Cancelling a company edit discards it

Story: As the sales rep, I need to leave the company editor without saving, so that a change I started by mistake is not kept.
Given a Company "Acme" with name Acme, domain acme.example, industry Software
When Sales rep opens Company editor for Acme
Narrate: This is the company editor for Acme. Save and Cancel sit below the form.
And Sales rep enters Software-and-services into "Industry"
Narrate: The industry is Software-and-services.
And Sales rep clicks "Cancel"
Then Sales rep is on Company list
Narrate: The company list opens.
And Acme has industry Software
```

File: `specs/pipeline/deals.md`, appended.

```markdown
## Scenario: Cancelling a deal edit discards it

Story: As the sales rep, I need to leave the deal editor without saving, so that a change I started by mistake is not kept.
Given a Company "Acme"
Given a Deal "Big deal" with name Big-deal, stage lead, company Acme
When Sales rep opens Deal editor for Big deal
Narrate: This is the deal editor for Big-deal. Save and Cancel sit below the form.
And Sales rep enters Renamed-deal into "Name"
Narrate: The name is Renamed-deal.
And Sales rep clicks "Cancel"
Then Sales rep is on Pipeline board
Narrate: The pipeline board opens.
And Big deal has name Big-deal
```

### N4. Stage menu offers only permitted stages

File: `specs/pipeline/permissions.md`, appended (companion of C2). Control: Pipeline board "Stage".

```markdown
## Scenario: The stage menu offers only the stages a role may choose

Story: As the sales manager, I need Won offered only to managers, so that sales are confirmed deliberately.
Given a Company "Acme"
Given a Deal "Proposal deal" with stage proposal, company Acme
When Sales rep opens Pipeline board
Narrate: This is the pipeline board for a sales rep. Proposal deal sits in the Proposal column with a Stage menu.
Then Sales rep sees "Proposal" in "Stage"
Narrate: The Stage menu shows Proposal.
And Sales rep no longer sees "Won" in "Stage"
Narrate: Won is absent from the menu of a sales rep.
When Sales manager opens Pipeline board
Narrate: This is the pipeline board for a sales manager.
Then Sales manager sees "Won" in "Stage"
Narrate: The Stage menu offers Won to a sales manager.
```

### N5. Invoice GST

File: new `specs/invoicing/gst.md`. Controls: Invoice editor "Supplier", "GST rate", "Prices", "Tax code", "Subtotal", "GST", "Totals", "Invoice title". Depends on M5 to M8.

```markdown
# Invoicing

## Scenario: The invoice shows its supplier

Story: As accounts, I need the supplier's business name and ABN on the invoice, so that the customer knows who to pay.
Given a Business "Ledger Studio" with name Ledger-Studio, abn 51824753556
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, supplier Ledger Studio
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 has a supplier block at the top of the details.
Then Accounts sees "Ledger-Studio" in "Supplier"
Narrate: The supplier block shows the business name Ledger-Studio.
And Accounts sees "51824753556" in "Supplier"
Narrate: It shows the ABN.

## Scenario: GST is added to the lines coded GST

Story: As accounts, I need GST charged only on GST lines, so that GST-free lines are billed at their price.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
Given a LineItem "Training materials" with invoice INV-001, quantity 1, unit price 120, tax code gst-free
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 lists two lines. Consulting is coded GST. Training materials is coded GST-free. Prices exclude GST at ten percent.
Then Accounts sees "$320.00" in "Subtotal"
Narrate: The subtotal is three hundred and twenty dollars.
And Accounts sees "$20.00" in "GST"
Narrate: GST is twenty dollars, ten percent of the two hundred dollars on the GST line.
And Accounts sees "$340.00" in "Totals"
Narrate: The total is three hundred and forty dollars.

## Scenario: Prices that include GST

Story: As accounts, I need to enter GST-inclusive prices, so that the customer sees the price they pay.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices include gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 110, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 lists one line of one hundred and ten dollars. Prices include GST.
Then Accounts sees "$100.00" in "Subtotal"
Narrate: The subtotal is one hundred dollars.
And Accounts sees "$10.00" in "GST"
Narrate: GST is ten dollars.
And Accounts sees "$110.00" in "Totals"
Narrate: The total stays one hundred and ten dollars.

## Scenario: Changing a line's tax code updates the GST

Story: As accounts, I need to recode a line, so that GST follows what was supplied.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows GST of twenty dollars.
And Accounts selects GST-free in "Tax code"
Narrate: The line is recoded GST-free.
Then Accounts sees "$0.00" in "GST"
Narrate: GST drops to zero.
And Accounts sees "$200.00" in "Totals"
Narrate: The total is two hundred dollars.

## Scenario: Changing the GST rate updates the GST

Story: As accounts, I need to set the GST rate, so that the invoice charges the right tax.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows a GST rate of ten percent.
And Accounts enters 5 into "GST rate"
Narrate: The GST rate is five percent.
Then Accounts sees "$10.00" in "GST"
Narrate: GST is ten dollars.
And Accounts sees "$210.00" in "Totals"
Narrate: The total is two hundred and ten dollars.

## Scenario: An invoice that charges GST is titled Tax invoice

Story: As accounts, I need an invoice that charges GST to say so, so that the customer can claim the credit.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100, tax code gst
Given an Invoice "INV-002" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Donation" with invoice INV-002, quantity 1, unit price 100, tax code exempt
Then INV-001 is tax invoice
And INV-002 is not tax invoice
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 charges GST.
Then Accounts sees "Tax invoice" in "Invoice title"
Narrate: The heading reads Tax invoice INV-001.
When Accounts opens Invoice editor for INV-002
Narrate: The invoice editor for INV-002 charges no GST.
Then Accounts sees "INV-002" in "Invoice title"
Narrate: The heading reads Invoice INV-002.

## Scenario: A sent invoice keeps its GST settings read only

Story: As accounts, I need a sent invoice to keep its GST settings, so that the customer is billed what was sent.
Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows the sent invoice.
Then Accounts sees "10%" in "GST rate"
Narrate: The GST rate reads ten percent.
And Accounts sees "Exclude GST" in "Prices"
Narrate: Prices read Exclude GST.
And Accounts sees "GST" in "Tax code"
Narrate: The line is coded GST.
```

## Scenarios changed

### C1. Board stage scenarios and their composite steps

Replaces the four board composites that click removed buttons. Needs R1 approved.

File: `specs/pipeline/steps.md`, the first four items become:

```markdown
- <Actor> qualifies <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Lead column of the pipeline board. Its Stage menu offers Qualified.
  - <Actor> selects Qualified in "Stage"
- <Actor> proposes <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Qualified column of the pipeline board. Its Stage menu offers Proposal.
  - <Actor> selects Proposal in "Stage"
- <Actor> wins <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Proposal column of the pipeline board. Its Stage menu offers Won.
  - <Actor> selects Won in "Stage"
- <Actor> loses <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in a column of the pipeline board. Its Stage menu offers Lost.
  - <Actor> selects Lost in "Stage"
```

File: `specs/pipeline/deals.md`, one Narrate line in each of six scenarios.

| Scenario                   | Old line                                                                            | New line                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Qualifying a lead          | `Narrate: Qualify moves Big deal forward. Big deal is now in the Qualified column.` | `Narrate: Choosing Qualified moves Big deal forward. Big deal is now in the Qualified column.` |
| Proposing a qualified deal | `Narrate: Propose moves Big deal forward. Big deal is now in the Proposal column.`  | `Narrate: Choosing Proposal moves Big deal forward. Big deal is now in the Proposal column.`   |
| Winning a proposal         | `Narrate: Win closes the deal. Big deal is now in the Won column.`                  | `Narrate: Choosing Won closes the deal. Big deal is now in the Won column.`                    |
| Losing a lead              | `Narrate: Lose closes the deal. Big deal is now in the Lost column.`                | `Narrate: Choosing Lost closes the deal. Big deal is now in the Lost column.`                  |
| Losing a qualified deal    | `Narrate: Lose closes the deal. Big deal is now in the Lost column.`                | `Narrate: Choosing Lost closes the deal. Big deal is now in the Lost column.`                  |
| Losing a proposal          | `Narrate: Lose closes the deal. Big deal is now in the Lost column.`                | `Narrate: Choosing Lost closes the deal. Big deal is now in the Lost column.`                  |

The deal-page scenarios (Qualify, Propose, Win, Lose buttons on the Deal page) stay as written.

### C2. "Who may move a deal through the pipeline" loses its Win button check

File: `specs/pipeline/permissions.md`. The Win button is gone from the board. Delete these four lines from the end of the scenario; N4 holds the board check.

```markdown
When Sales rep opens Pipeline board
Narrate: This is the pipeline board for a sales rep.
Then Sales rep does not see "Win"
Narrate: The board has no Win button for a sales rep. Winning a deal is left to the sales manager.
```

### C3. "A task becomes overdue as time advances" uses the Overdue badge

File: `specs/pipeline/tasks.md`. Needs R2 approved. Replaces the last twelve lines of the scenario (from `Then Sales rep does not see "Overdue tasks"`).

```markdown
Then Sales rep does not see "Overdue badge"
Narrate: The task row shows no Overdue badge.
When time advances 2 days
Narrate: Two days pass. The due date is now behind.
And Send proposal is overdue
And Sales rep opens Deal page for Big deal
Narrate: The deal page is opened again.
Then Sales rep sees "Overdue" in "Tasks"
Narrate: An Overdue badge appears after the due date of Send-proposal.
```

### C4. Person names in sidebar and timeline scenarios

Needs M1 and M2. Narrate text and the sidebar link list follow the designs.

File: `specs/dashboard/navigation.md`:

```markdown
Narrate: A sidebar runs down the left side of the dashboard. It lists Dashboard, Contacts, Companies, Pipeline, My tasks and Invoices.
```

```markdown
Then Sales rep sees "Sam Rivera" in "Signed in as"
Narrate: The signed-in area shows Sam Rivera. This is the person using the application.
```

File: `specs/crm/activities.md`, "Timeline shows who logged each activity and when":

```markdown
And Sales rep sees "Sam Rivera" in "Timeline"
Narrate: The author reads Sam Rivera.
```

## Questions for design

Artboard edits that the sections above depend on. Each is answered on the canvas; the next sync reads the result.

- Q1. Invoice editor flags `isTaxInvoice` and `notIsTaxInvoice` become `taxInvoice` and `notTaxInvoice` (M7).
- Q2. Invoice editor Prices select: `data-field="pricesIncludeGst"` becomes `data-field="prices"` (M5).
- Q3. Invoice editor: `data-control="Invoice title"` on the h1, wrapping "Tax invoice" or "Invoice" and the number (M8, N5).
- Q4. Task list: `canSeeAllTasks` becomes `canSeeAll` (M4), or the design runtime maps the name.
- Q5. Invoice editor Supplier block reads `business.name` and `business.abn` at the top level; the model holds the supplier as a relation of the invoice, so the artboard reads `invoice.supplierRecord.name` and `invoice.supplierRecord.abn` (M5).
- Q6. Task list sample data marks Jordan Patel (admin) assignable; M3 follows the agreed scope of sales and manager.

## Design-mode props the Task list needs

Listed for pass 2; no spec text changes. `canSeeAllTasks`, `canCreateTask`, `hasNoOpenTasks`, `allDeals`, `allUsers` with `assignable`, row `isOpen`, `dueThisWeek`, `canComplete`, `canReassign`; a sales rep's list holds the tasks assigned to the actor's user.
