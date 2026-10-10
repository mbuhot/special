# Invoicing

## Invariants

- LineItem.total = quantity \* unit price
- Invoice.total = sum of LineItem.total
- Invoice.number is unique
- Invoice.number is assigned on creation as "INV-" followed by a 3 digit sequence
- Invoice.status only changes through send, mark paid, void
