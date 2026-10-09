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
When Sales rep opens Pipeline board
Narrate: Big deal is in the Lead column of the pipeline board. It has a Qualify button.
And Sales rep clicks "Qualify"
Then Sales rep sees "Big deal" in "Qualified column"
Narrate: Qualify moves Big deal forward. Big deal is now in the Qualified column.
And Sales rep no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage qualified

## Scenario: Proposing a qualified deal

Story: As the sales rep, I need to move Big deal to proposal, so that the pipeline shows a proposal has gone out.
Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales rep opens Pipeline board
Narrate: Big deal is in the Qualified column of the pipeline board. It has a Propose button.
And Sales rep clicks "Propose"
Then Sales rep sees "Big deal" in "Proposal column"
Narrate: Propose moves Big deal forward. Big deal is now in the Proposal column.
And Sales rep no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage proposal

## Scenario: Winning a proposal

Story: As the sales manager, I need to mark Big deal won, so that the pipeline records the sale.
Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
Narrate: Big deal is in the Proposal column of the pipeline board. It has a Win button.
And Sales manager clicks "Win"
Then Sales manager sees "Big deal" in "Won column"
Narrate: Win closes the deal. Big deal is now in the Won column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage won

## Scenario: Losing a lead

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales manager opens Pipeline board
Narrate: Big deal is in the Lead column of the pipeline board. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage lost

## Scenario: Losing a qualified deal

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales manager opens Pipeline board
Narrate: Big deal is in the Qualified column of the pipeline board. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage lost

## Scenario: Losing a proposal

Story: As the sales manager, I need to mark Big deal lost, so that the pipeline holds only deals still worth chasing.
Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
Narrate: Big deal is in the Proposal column of the pipeline board. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage lost

## Scenario: Creating a deal

Story: As the sales rep, I need to add Big-deal for Acme with Ada Lovelace as the contact, so that it is tracked through the pipeline.
Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Pipeline board
Narrate: The pipeline board has a New deal button above the columns.
And Sales rep clicks "New deal"
Then Sales rep is on Deal editor
Narrate: The deal editor opens with an empty form.
When Sales rep enters Big-deal into "Name"
Narrate: The deal name is Big-deal.
And Sales rep enters 12000 into "Amount"
Narrate: The amount is twelve thousand.
And Sales rep enters 2026-03-31 into "Close date"
Narrate: The close date is the thirty-first of March.
And Sales rep selects Acme in "Company"
Narrate: The company is Acme.
And Sales rep selects Ada Lovelace in "Contact"
Narrate: The contact is Ada Lovelace.
And Sales rep clicks "Save"
Then Sales rep sees "Big-deal" in "Deal name"
Narrate: The saved deal page shows the name Big-deal.
And Sales rep sees "lead" in "Stage"
Narrate: A new deal starts in the lead stage.
