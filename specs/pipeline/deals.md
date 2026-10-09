# Pipeline

## Scenario: Pipeline board shows a deal in its stage column

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Pipeline board
Then Sales rep sees "Big deal" in "Lead column"
Narrate: The pipeline board lists Big deal in the lead column.

## Scenario: Qualifying a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales rep opens Pipeline board
And Sales rep clicks "Qualify"
Then Sales rep sees "Big deal" in "Qualified column"
And Sales rep no longer sees "Big deal" in "Lead column"
And Big deal has stage qualified
Narrate: Big deal moves from the lead column to the qualified column.

## Scenario: Proposing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales rep opens Pipeline board
And Sales rep clicks "Propose"
Then Sales rep sees "Big deal" in "Proposal column"
And Sales rep no longer sees "Big deal" in "Qualified column"
And Big deal has stage proposal
Narrate: Big deal moves from the qualified column to the proposal column.

## Scenario: Winning a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
And Sales manager clicks "Win"
Then Sales manager sees "Big deal" in "Won column"
And Sales manager no longer sees "Big deal" in "Proposal column"
And Big deal has stage won
Narrate: Big deal moves from the proposal column to the won column.

## Scenario: Losing a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Sales manager opens Pipeline board
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
And Sales manager no longer sees "Big deal" in "Lead column"
And Big deal has stage lost
Narrate: Big deal moves from the lead column to the lost column.

## Scenario: Losing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Sales manager opens Pipeline board
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
And Sales manager no longer sees "Big deal" in "Qualified column"
And Big deal has stage lost
Narrate: Big deal moves from the qualified column to the lost column.

## Scenario: Losing a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Sales manager opens Pipeline board
And Sales manager clicks "Lose"
Then Sales manager sees "Big deal" in "Lost column"
And Sales manager no longer sees "Big deal" in "Proposal column"
And Big deal has stage lost
Narrate: Big deal moves from the proposal column to the lost column.

## Scenario: Creating a deal

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Sales rep opens Pipeline board
And Sales rep clicks "New deal"
Then Sales rep is on Deal editor
When Sales rep enters Big-deal into "Name"
And Sales rep enters 12000 into "Amount"
And Sales rep enters 2026-03-31 into "Close date"
And Sales rep selects Acme in "Company"
And Sales rep selects Ada Lovelace in "Contact"
And Sales rep clicks "Save"
Then Sales rep sees "Big-deal" in "Deal name"
And Sales rep sees "lead" in "Stage"
Narrate: The saved deal shows the name Big-deal in stage lead.
