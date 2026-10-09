# Invoicing

## Scenario: Line total updates as quantity changes

Story: As accounts, I need the total on INV-001 to follow the quantity and unit price, so that the customer is billed the correct amount.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows the line item Consulting with a quantity of one and a unit price of one hundred.
Then Accounts sees "100.00" in "Totals"
Narrate: The totals region shows one hundred.
When Accounts enters 3 into "Quantity"
Narrate: The quantity changes to three.
Then Accounts sees "300.00" in "Totals"
Narrate: The totals region updates to three hundred.
When Accounts enters 50 into "Unit price"
Narrate: The unit price changes to fifty.
Then Accounts sees "150.00" in "Totals"
Narrate: The totals region updates to one hundred and fifty. The total follows the quantity and the unit price.
