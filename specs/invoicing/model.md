# Invoicing

## Model

- Invoice: number (text, required), status, total (money). Belongs to Company. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description (text, required), quantity (integer, required), unit price (money, required). Belongs to Invoice.
- Company has many Invoice
