# Pipeline

## Scenario: Pipeline board shows a deal in its stage column

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Accounts opens Pipeline board
Then Accounts sees "Big deal" in "Lead column"
Narrate: The pipeline board lists Big deal in the lead column.

## Scenario: Qualifying a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Qualify"
Then Accounts sees "Big deal" in "Qualified column"
And Accounts no longer sees "Big deal" in "Lead column"
And Big deal has stage qualified
Narrate: Big deal moves from the lead column to the qualified column.

## Scenario: Proposing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Propose"
Then Accounts sees "Big deal" in "Proposal column"
And Accounts no longer sees "Big deal" in "Qualified column"
And Big deal has stage proposal
Narrate: Big deal moves from the qualified column to the proposal column.

## Scenario: Winning a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Win"
Then Accounts sees "Big deal" in "Won column"
And Accounts no longer sees "Big deal" in "Proposal column"
And Big deal has stage won
Narrate: Big deal moves from the proposal column to the won column.

## Scenario: Losing a lead

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Lose"
Then Accounts sees "Big deal" in "Lost column"
And Accounts no longer sees "Big deal" in "Lead column"
And Big deal has stage lost
Narrate: Big deal moves from the lead column to the lost column.

## Scenario: Losing a qualified deal

Given a Company "Acme"
Given a Deal "Big deal" with stage qualified, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Lose"
Then Accounts sees "Big deal" in "Lost column"
And Accounts no longer sees "Big deal" in "Qualified column"
And Big deal has stage lost
Narrate: Big deal moves from the qualified column to the lost column.

## Scenario: Losing a proposal

Given a Company "Acme"
Given a Deal "Big deal" with stage proposal, company Acme
When Accounts opens Pipeline board
And Accounts clicks "Lose"
Then Accounts sees "Big deal" in "Lost column"
And Accounts no longer sees "Big deal" in "Proposal column"
And Big deal has stage lost
Narrate: Big deal moves from the proposal column to the lost column.

## Scenario: Creating a deal

Given a Company "Acme"
Given a Contact "Ada Lovelace" with first name Ada, last name Lovelace, company Acme
When Accounts opens Pipeline board
And Accounts clicks "New deal"
Then Accounts is on Deal editor
When Accounts enters Big-deal into "Name"
And Accounts enters 12000 into "Amount"
And Accounts enters 2026-03-31 into "Close date"
And Accounts selects Acme in "Company"
And Accounts selects Ada Lovelace in "Contact"
And Accounts clicks "Save"
Then Accounts sees "Big-deal" in "Deal name"
And Accounts sees "lead" in "Stage"
Narrate: The saved deal shows the name Big-deal in stage lead.
