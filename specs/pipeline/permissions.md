# Pipeline

## Scenario: Who may move a deal through the pipeline

Story: As the sales manager, I need to be the only one who can win or reassign a deal, so that sales are confirmed deliberately.
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

## Scenario: Who may complete a task

Story: As the sales manager, I need tasks to be completed only by the sales team, so that task status can be trusted.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-20, deal Big deal, status open
Then Sales rep may complete Send proposal
Narrate: A sales rep can complete the task Send proposal.
And Accounts may not complete Send proposal
Narrate: Accounts cannot complete the task Send proposal.

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
