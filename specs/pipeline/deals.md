# Pipeline

## Scenario: Pipeline board shows a deal in its stage column

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Pipeline board
Narrate: This is the pipeline board. Each column is a stage.
Then Sales rep sees "Big deal" in "Lead column"
Narrate: Big deal is in the Lead column. Each deal is listed in the column of its stage.

## Scenario: Qualifying a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Pipeline board
Narrate: This is the pipeline board. Big deal is in the Lead column. It has a Qualify button.
And Sales rep clicks "Qualify"
Then Sales rep sees "Big deal" in "Qualified column"
Narrate: Qualify moves Big deal forward. Big deal is now in the Qualified column.
And Sales rep no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage qualified

## Scenario: Proposing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales rep opens Pipeline board
Narrate: This is the pipeline board. Big deal is in the Qualified column. It has a Propose button.
And Sales rep clicks "Propose"
Then Sales rep sees "Big deal" in "Proposal column"
Narrate: Propose moves Big deal forward. Big deal is now in the Proposal column.
And Sales rep no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage proposal

## Scenario: Winning a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
Narrate: This is the pipeline board for a sales manager. Big deal is in the Proposal column. It has a Win button.
And Sales manager clicks "Win"
Then Sales manager sees "Big deal" in "Won column"
Narrate: Win closes the deal. Big deal is now in the Won column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage won

## Scenario: Losing a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales manager opens Pipeline board
Narrate: This is the pipeline board for a sales manager. Big deal is in the Lead column. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Lead column"
Narrate: The Lead column is empty.
And Big deal has stage lost

## Scenario: Losing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales manager opens Pipeline board
Narrate: This is the pipeline board for a sales manager. Big deal is in the Qualified column. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Qualified column"
Narrate: The Qualified column is empty.
And Big deal has stage lost

## Scenario: Losing a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
Narrate: This is the pipeline board for a sales manager. Big deal is in the Proposal column. It has a Lose button.
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
Narrate: Lose closes the deal. Big deal is now in the Lost column.
And Sales manager no longer sees "Big deal" in "Proposal column"
Narrate: The Proposal column is empty.
And Big deal has stage lost

## Scenario: Creating a deal

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Pipeline board
Narrate: This is the pipeline board. A New deal button sits above the columns.
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
