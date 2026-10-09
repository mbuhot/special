# Pipeline

## Model

- Deal: name, amount, close date, stage. Belongs to Company. Belongs to Contact. Belongs to User.
- Deal.stage: lead -> qualified -> proposal -> won, lead -> lost, qualified -> lost, proposal -> lost
- Company has many Deal
- Contact has many Deal
- Task: title, due date, status. Belongs to Deal. Belongs to User.
- Task.status: open -> done
- Deal has many Task

## Policies

- Deal: sales may read, create, update, qualify, propose
- Deal: manager may read, create, update, qualify, propose, win, lose, reassign
- Deal: accountant may read
- Deal: admin may read, create, update, qualify, propose, win, lose, reassign
- Task: sales may read, create, update, complete
- Task: manager may read, create, update, complete
- Task: accountant may read
- Task: admin may read, create, update, complete
