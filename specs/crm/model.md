# CRM

## Model

- Activity: kind (one of note, call, email, meeting, required), body (text, required), occurred at (datetime, required). Belongs to Contact. Belongs to User as author.
- Contact has many Activity

## Policies

- Activity: sales may read, create, update
- Activity: manager may read, create, update
- Activity: accountant may read
- Activity: admin may read, create, update
