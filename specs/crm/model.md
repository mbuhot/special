# CRM

## Model

- Activity: kind (one of note, call, email, meeting, required), body (text, required), occurred at (datetime, required). Belongs to Contact. Belongs to User as author.
- Contact has many Activity
- Activity is listed by occurred at newest first

## Policies

- Activity: sales may read, create, update
- Activity: manager may read, create, update
- Activity: accountant may read
- Activity: admin may read, create, update
