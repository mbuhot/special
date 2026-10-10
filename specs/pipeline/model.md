# Pipeline

## Model

- Deal: name (text, required), amount (money), close date (date), stage. Belongs to Company. Belongs to Contact. Belongs to User as owner.
- Deal.stage: lead -> qualified -> proposal -> won, lead -> lost, qualified -> lost, proposal -> lost
- Company has many Deal
- Contact has many Deal
- Task: title (text, required), due date (date, required), status. Belongs to Deal. Belongs to User as assignee.
- Task.status: open -> done
- Deal has many Task

## Policies

- Deal: sales may read, create, update, qualify, propose
- Deal: manager may read, create, update, qualify, propose, win, lose, reassign
- Deal: accountant may read
- Deal: admin may read, create, update, qualify, propose, win, lose, reassign
- Task: sales may read only mine
- Task: sales may create, update, complete
- Task: manager may read, create, update, complete, reassign, see all
- Task: accountant may read
- Task: admin may read, create, update, complete, reassign, see all
