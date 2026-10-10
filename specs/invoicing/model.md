# Invoicing

## Model

- Invoice: number (text, required), status, issue date (date, required), due date (date), notes (text), total (money). Belongs to Company. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description (text, required), quantity (integer, required), unit price (money, required), total (money). Belongs to Invoice.
- Company has many Invoice
