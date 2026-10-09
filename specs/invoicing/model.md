# Invoicing

## Model

- Customer: name, email. Has many Invoice.
- Invoice: number, status, total. Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description, quantity, unit price. Belongs to Invoice.
