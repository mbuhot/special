# Invoicing

## Invariants

- LineItem.total = quantity \* unit price
- Invoice.taxable = sum of LineItem.total where tax code is gst
- Invoice.gst = taxable \* gst rate / 100 when prices is exclude gst
- Invoice.gst = taxable \* gst rate / (100 + gst rate) when prices is include gst
- Invoice.subtotal = sum of LineItem.total when prices is exclude gst
- Invoice.subtotal = sum of LineItem.total - gst when prices is include gst
- Invoice.total = subtotal + gst
- Invoice.number is unique
- Invoice.number is assigned on creation as "INV-" followed by a 3 digit sequence
- Invoice.status only changes through send, mark paid, void
