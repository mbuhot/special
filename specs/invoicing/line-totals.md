# Invoicing

## Scenario: Line total updates as quantity changes

Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
Then Accounts sees "100.00" in "Totals"
When Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
When Accounts enters 50 into "Unit price"
Then Accounts sees "150.00" in "Totals"
Narrate: The line total updates as the quantity and the unit price change.
