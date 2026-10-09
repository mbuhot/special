# CRM

## Model

- Activity: kind, body, occurred at. Belongs to Contact. Belongs to User.
- Contact has many Activity

## Policies

- Activity: sales may read, create, update
- Activity: manager may read, create, update
- Activity: accountant may read
- Activity: admin may read, create, update
