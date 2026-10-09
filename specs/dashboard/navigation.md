# Dashboard navigation

## Scenario: Every section is one click from the sidebar

Story: As the sales rep, I need to reach every section from the sidebar, so that I get to my work in one click.
When Sales rep opens Dashboard
Narrate: A sidebar runs down the left side of the dashboard. It lists Dashboard, Contacts, Companies, Pipeline and Invoices.
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
Then Sales rep sees "Sales rep" in "Signed in as"
Narrate: The signed-in area shows Sales rep. This is the person using the application.

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
