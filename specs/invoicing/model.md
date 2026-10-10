# Invoicing

## Model

- Business: name (text, required), abn (text, required). Has many Invoice as supplied invoices.
- Invoice: number (text, required), status, issue date (date, required), due date (date), gst rate (decimal), prices (one of exclude gst, include gst), notes (text), taxable (money), subtotal (money), gst (money), total (money). Belongs to Company. Belongs to Business as supplier. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description (text, required), quantity (integer, required), unit price (money, required), tax code (one of gst, gst-free, exempt), total (money). Belongs to Invoice.
- Company has many Invoice
