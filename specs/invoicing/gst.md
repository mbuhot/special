# Invoicing

## Scenario: The invoice shows its supplier

Story: As accounts, I need the supplier's business name and ABN on the invoice, so that the customer knows who to pay.
Given a Business "Ledger Studio" with name Ledger-Studio, abn 51824753556
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, supplier Ledger Studio
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 has a supplier block at the top of the details.
Then Accounts sees "Ledger Studio" in "Supplier"
Narrate: The supplier block shows the business name Ledger Studio.
And Accounts sees "51824753556" in "Supplier"
Narrate: It shows the ABN.

## Scenario: GST is added to the lines coded GST

Story: As accounts, I need GST charged only on GST lines, so that GST-free lines are billed at their price.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
Given a LineItem "Training materials" with invoice INV-001, quantity 1, unit price 120, tax code gst-free
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 lists two lines. Consulting is coded GST. Training materials is coded GST-free. Prices exclude GST at ten percent.
Then Accounts sees "$320.00" in "Subtotal"
Narrate: The subtotal is three hundred and twenty dollars.
And Accounts sees "$20.00" in "GST"
Narrate: GST is twenty dollars, ten percent of the two hundred dollars on the GST line.
And Accounts sees "$340.00" in "Totals"
Narrate: The total is three hundred and forty dollars.

## Scenario: Prices that include GST

Story: As accounts, I need to enter GST-inclusive prices, so that the customer sees the price they pay.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices include gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 110, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 lists one line of one hundred and ten dollars. Prices include GST.
Then Accounts sees "$100.00" in "Subtotal"
Narrate: The subtotal is one hundred dollars.
And Accounts sees "$10.00" in "GST"
Narrate: GST is ten dollars.
And Accounts sees "$110.00" in "Totals"
Narrate: The total stays one hundred and ten dollars.

## Scenario: Changing a line's tax code updates the GST

Story: As accounts, I need to recode a line, so that GST follows what was supplied.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows GST of twenty dollars.
And Accounts selects GST-free in "Tax code"
Narrate: The line is recoded GST-free.
Then Accounts sees "$0.00" in "GST"
Narrate: GST drops to zero.
And Accounts sees "$200.00" in "Totals"
Narrate: The total is two hundred dollars.

## Scenario: Changing the GST rate updates the GST

Story: As accounts, I need to set the GST rate, so that the invoice charges the right tax.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows a GST rate of ten percent.
And Accounts enters 5 into "GST rate"
Narrate: The GST rate is five percent.
Then Accounts sees "$10.00" in "GST"
Narrate: GST is ten dollars.
And Accounts sees "$210.00" in "Totals"
Narrate: The total is two hundred and ten dollars.

## Scenario: An invoice that charges GST is titled Tax invoice

Story: As accounts, I need an invoice that charges GST to say so, so that the customer can claim the credit.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100, tax code gst
Given an Invoice "INV-002" with status draft, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Donation" with invoice INV-002, quantity 1, unit price 100, tax code exempt
Then INV-001 is tax invoice
And INV-002 is not tax invoice
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 charges GST.
Then Accounts sees "Tax invoice" in "Invoice title"
Narrate: The heading reads Tax invoice INV-001.
When Accounts opens Invoice editor for INV-002
Narrate: The invoice editor for INV-002 charges no GST.
Then Accounts sees "INV-002" in "Invoice title"
Narrate: The heading reads Invoice INV-002.

## Scenario: A sent invoice keeps its GST settings read only

Story: As accounts, I need a sent invoice to keep its GST settings, so that the customer is billed what was sent.
Given a Company "Acme"
Given an Invoice "INV-001" with status sent, company Acme, gst rate 10, prices exclude gst
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100, tax code gst
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows the sent invoice.
Then Accounts sees "10%" in "GST rate"
Narrate: The GST rate reads ten percent.
And Accounts sees "Exclude GST" in "Prices"
Narrate: Prices read Exclude GST.
And Accounts sees "GST" in "Tax code"
Narrate: The line is coded GST.
