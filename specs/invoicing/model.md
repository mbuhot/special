# Invoicing

## Model

- Invoice: number, status, total. Belongs to Company. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description, quantity, unit price. Belongs to Invoice.
- Company has many Invoice
