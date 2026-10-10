# Dashboard navigation

## Scenario: Every section is one click from the sidebar

Story: As the sales rep, I need to reach every section from the sidebar, so that I get to my work in one click.
When Sales rep opens Dashboard
Narrate: A sidebar runs down the left side of the dashboard. It lists Dashboard, Contacts, Companies, Pipeline, My tasks and Invoices.
And Sales rep clicks "Contacts"
Then Sales rep is on Contact list
Narrate: The contact list opens. The sidebar stays on screen.
When Sales rep clicks "Companies"
Then Sales rep is on Company list
Narrate: The company list opens.
When Sales rep clicks "Pipeline"
Then Sales rep is on Pipeline board
Narrate: The pipeline board opens with a column for each stage.
When Sales rep clicks "Invoices"
Then Sales rep is on Invoice list
Narrate: The invoice list opens.
When Sales rep clicks "Dashboard"
Then Sales rep is on Dashboard
Narrate: The dashboard opens again. Every section was reached with one click on the sidebar.

## Scenario: The sidebar shows who is signed in

Story: As the sales rep, I need to see who is signed in, so that I know whose account I am using.
When Sales rep opens Dashboard
Narrate: The sidebar has a signed-in area at its foot.
Then Sales rep sees "Sam Rivera" in "Signed in as"
Narrate: The signed-in area shows Sam Rivera. This is the person using the application.

## Scenario: Dashboard cards open their sections

Story: As the sales rep, I need to open the pipeline and the invoices from the dashboard cards, so that I can act on a number I see.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given an Invoice "INV-001" with status sent, company Acme
When Sales rep opens Dashboard
Narrate: The open deals card and the unpaid invoices card on the dashboard each have a link.
And Sales rep clicks "View pipeline"
Then Sales rep is on Pipeline board
Narrate: The link on the open deals card opens the pipeline board.
When Sales rep opens Dashboard
Narrate: The dashboard is shown again.
And Sales rep clicks "View invoices"
Then Sales rep is on Invoice list
Narrate: The link on the unpaid invoices card opens the invoice list. Each card opens its section.

## Scenario: Signing out returns to the login page

Story: As the sales rep, I need to sign out, so that nobody else can use my account on this computer.
When Sales rep opens Dashboard
Narrate: The sidebar has a Sign out button at its foot.
And Sales rep clicks "Sign out"
Then Sales rep is on Login
Narrate: The login page opens. The sidebar is gone.
When Sales rep enters sales-rep@example.com into "Email"
Narrate: The email address is typed into the Email field.
Then Sales rep sees "Log in" in "Log in"
Narrate: The Log in button sits below the field.

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
