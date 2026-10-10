# Pipeline

## Scenario: Pipeline board shows a deal in its stage column

Story: As the sales rep, I need to see Big deal in its stage column, so that I know where each deal stands.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Pipeline board
Narrate: The pipeline board has a column for each stage.
Then Sales rep sees "Big deal" in "Lead column"
Narrate: Big deal is in the Lead column. Each deal is listed in the column of its stage.

## Scenario: Qualifying a lead

Story: As the sales rep, I need to move Big deal to qualified, so that the pipeline shows the lead is worth pursuing.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep qualifies Big deal on the board
Then Sales rep sees "Big deal" in "Qualified column"
Narrate: Qualify moves Big deal forward. Big deal is now in the Qualified column.
And Sales rep no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage qualified

## Scenario: Proposing a qualified deal

Story: As the sales rep, I need to move Big deal to proposal, so that the pipeline shows a proposal has gone out.
Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales rep proposes Big deal on the board
Then Sales rep sees "Big deal" in "Proposal column"
Narrate: Propose moves Big deal forward. Big deal is now in the Proposal column.
And Sales rep no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage proposal

## Scenario: Winning a proposal

Story: As the sales manager, I need to mark Big deal won, so that the pipeline records the sale.
Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager wins Big deal on the board
Then Sales manager sees "Big deal" in "Won column"
Narrate: Win closes the deal. Big deal is now in the Won column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage won

## Scenario: Losing a lead

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales manager loses Big deal on the board
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage lost

## Scenario: Losing a qualified deal

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales manager loses Big deal on the board
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage lost

## Scenario: Losing a proposal

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager loses Big deal on the board
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage lost

## Scenario: Creating a deal

Story: As the sales rep, I need to add Big-deal for Acme with Ada Lovelace as the contact, so that it is tracked through the pipeline.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep creates a deal Big-deal for Acme with amount 12000 closing 2026-03-31 with contact Ada Lovelace
Then Sales rep sees "Big-deal" in "Deal name"
Narrate: The saved deal page shows the name Big-deal.
And Sales rep sees "Lead" in "Stage"
Narrate: A new deal starts in the Lead stage.

## Scenario: Contact page lists the contact's deals

Story: As the sales rep, I need to see Ada Lovelace's deals on her page, so that I know what is open with her.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage proposal, amount 12000, company Acme, contact Ada Lovelace
When Sales rep opens Contact page for Ada Lovelace
Narrate: This is the contact page for Ada Lovelace. A deals table sits below her properties.
Then Sales rep sees "Big deal" in "Contact deals"
Narrate: The deals table lists Big deal.
And Sales rep sees "Proposal" in "Contact deals"
Narrate: The row shows the stage Proposal.

## Scenario: Deal page shows the deal's details

Story: As the sales manager, I need to see the amount, close date, company and contact of Big deal on its page, so that I have the whole deal in one place.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage qualified, amount 12000, close date 2026-03-31, company Acme, contact Ada Lovelace
When Sales manager opens Deal page for Big deal
Narrate: This is the deal page for Big deal. A properties panel sits below the deal name.
Then Sales manager sees "$12,000.00" in "Properties"
Narrate: The properties panel shows the amount, twelve thousand.
And Sales manager sees "31 Mar 2026" in "Properties"
Narrate: It shows the close date, the thirty-first of March 2026.
And Sales manager sees "Acme" in "Company link"
Narrate: The company link reads Acme.
And Sales manager sees "Ada Lovelace" in "Contact link"
Narrate: The contact link reads Ada Lovelace.
And Sales manager sees "Qualified" in "Stage"
Narrate: The stage reads Qualified.

## Scenario: Moving a deal forward from its page

Story: As the sales manager, I need to move Big deal to proposal from its page, so that I can advance it without leaving the deal.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage qualified, amount 12000, close date 2026-03-31, company Acme, contact Ada Lovelace
When Sales manager opens Deal page for Big deal
Narrate: The deal page for Big deal shows the stage Qualified. A Propose button sits beside it.
And Sales manager clicks "Propose"
Then Sales manager sees "Proposal" in "Stage"
Narrate: The stage changes to Proposal.
And Big deal has stage proposal

## Scenario: Winning a deal from its page

Story: As the sales manager, I need to mark Big deal won from its page, so that the sale is recorded where I am working.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage proposal, amount 12000, close date 2026-03-31, company Acme, contact Ada Lovelace
When Sales manager opens Deal page for Big deal
Narrate: The deal page for Big deal shows the stage Proposal. A Win button and a Lose button sit beside it.
And Sales manager clicks "Win"
Then Sales manager sees "Won" in "Stage"
Narrate: The stage changes to Won.
And Sales manager does not see "Win"
Narrate: The stage buttons disappear. A won deal has no further moves.
And Big deal has stage won

## Scenario: Company page lists the company's deals

Story: As the sales rep, I need to see Acme's deals and contacts on its page, so that I know what is in flight with the account.
Given a Company "Acme" with name Acme, domain acme.example, industry Software
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage lead, amount 12000, company Acme
When Sales rep opens Company page for Acme
Narrate: This is the company page for Acme. A deals table sits below the properties panel.
Then Sales rep sees "Big deal" in "Company deals"
Narrate: The deals table lists Big deal.
And Sales rep sees "Ada Lovelace" in "Company contacts"
Narrate: The contacts table lists Ada Lovelace.

## Scenario: Qualifying a deal from its page

Story: As the sales rep, I need to qualify Big deal from its page, so that I can advance it without leaving the deal.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage lead, amount 12000, close date 2026-03-31, company Acme, contact Ada Lovelace
When Sales rep opens Deal page for Big deal
Narrate: The deal page for Big deal shows the stage Lead. A Qualify button sits beside it.
And Sales rep clicks "Qualify"
Then Sales rep sees "Qualified" in "Stage"
Narrate: The stage changes to Qualified.
And Big deal has stage qualified

## Scenario: Losing a deal from its page

Story: As the sales manager, I need to mark Big deal lost from its page, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
Given a Deal "Big deal" with stage qualified, amount 12000, close date 2026-03-31, company Acme, contact Ada Lovelace
When Sales manager opens Deal page for Big deal
Narrate: The deal page for Big deal shows the stage Qualified. A Lose button sits beside it.
And Sales manager clicks "Lose"
Then Sales manager sees "Lost" in "Stage"
Narrate: The stage changes to Lost.
And Big deal has stage lost
