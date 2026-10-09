# Pipeline

## Scenario: Who may move a deal through the pipeline

Given a Company "Acme"
Given a Deal "Lead deal" with stage lead, company Acme
Given a Deal "Proposal deal" with stage proposal, company Acme
Then Sales rep may qualify Lead deal
Narrate: A sales rep can qualify the Lead deal.
And Sales rep may not win Proposal deal
Narrate: A sales rep cannot win the Proposal deal.
And Sales manager may win Proposal deal
Narrate: A sales manager can win the Proposal deal.
And Accounts may not qualify Lead deal
Narrate: Accounts cannot qualify the Lead deal.
And Sales rep may not reassign Lead deal
Narrate: A sales rep cannot reassign the Lead deal.
And Sales manager may reassign Lead deal
Narrate: A sales manager can reassign the Lead deal.
When Sales rep opens Pipeline board
Narrate: This is the pipeline board for a sales rep.
Then Sales rep does not see "Win"
Narrate: The board has no Win button for a sales rep. Winning a deal is left to the sales manager.

## Scenario: Who may complete a task

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open
Then Sales rep may complete Send proposal
Narrate: A sales rep can complete the task Send proposal.
And Accounts may not complete Send proposal
Narrate: Accounts cannot complete the task Send proposal.
