# Shared

## Model

- User: email (email, required), role (one of sales, manager, accountant, admin, required).

## Policies

- User: sales may read
- User: manager may read
- User: accountant may read
- User: admin may read, create, update
