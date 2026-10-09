# Pipeline

## Scenario: Who may move a deal through the pipeline

Given a Company "Acme"
Given a Deal "Lead deal" with stage lead, company Acme
Given a Deal "Proposal deal" with stage proposal, company Acme
Then Sales rep may qualify Lead deal
And Sales rep may not win Proposal deal
And Sales manager may win Proposal deal
And Accounts may not qualify Lead deal
And Sales rep may not reassign Lead deal
And Sales manager may reassign Lead deal
When Sales rep opens Pipeline board
Then Sales rep does not see "Win"
Narrate: The sales rep's pipeline board shows no Win button. Only the sales manager may win a deal.

## Scenario: Who may complete a task

Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open
Then Sales rep may complete Send proposal
And Accounts may not complete Send proposal
Narrate: A sales rep may complete the task Send proposal. Accounts may not.
