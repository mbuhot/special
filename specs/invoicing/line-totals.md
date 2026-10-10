# Invoicing

## Scenario: Line total updates as quantity changes

Story: As accounts, I need the total on INV-001 to follow the quantity and unit price, so that the customer is billed the correct amount.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 shows the line item Consulting with a quantity of one and a unit price of one hundred.
Then Accounts sees "$100.00" in "Totals"
Narrate: The totals region shows one hundred.
When Accounts enters 3 into "Quantity"
Narrate: The quantity changes to three.
Then Accounts sees "$300.00" in "Totals"
Narrate: The totals region updates to three hundred.
When Accounts enters 50 into "Unit price"
Narrate: The unit price changes to fifty.
Then Accounts sees "$150.00" in "Totals"
Narrate: The totals region updates to one hundred and fifty. The total follows the quantity and the unit price.

## Scenario: Each line shows its own total and a line can be removed

Story: As accounts, I need each line to show its own total and to remove a line, so that INV-001 bills only what was delivered.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 2, unit price 100
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 lists the line Consulting.
Then Accounts sees "$200.00" in "Line total"
Narrate: The line total shows two hundred dollars.
And Accounts sees "Consulting" in "Lines"
Narrate: The lines table holds Consulting.
When Accounts clicks "Remove line"
Narrate: Accounts removes the line.
Then Accounts no longer sees "Consulting" in "Lines"
Narrate: The lines table no longer holds Consulting.
And Accounts sees "$0.00" in "Totals"
Narrate: The totals region shows zero dollars.

## Scenario: Adding a line to an invoice

Story: As accounts, I need to add a line to INV-001, so that the customer is billed for the support provided.
Given a Company "Acme"
Given an Invoice "INV-001" with status draft, company Acme
When Accounts opens Invoice editor for INV-001
Narrate: The invoice editor for INV-001 has no lines. An Add line button is available.
And Accounts clicks "Add line"
Narrate: A new empty line appears.
And Accounts enters Support into "Description"
Narrate: The description is Support.
And Accounts enters 3 into "Quantity"
Narrate: The quantity is three.
And Accounts enters 40 into "Unit price"
Narrate: The unit price is forty dollars.
Then Accounts sees "$120.00" in "Line total"
Narrate: The line total shows one hundred and twenty dollars.
And Accounts sees "$120.00" in "Totals"
Narrate: The totals region shows one hundred and twenty dollars.
