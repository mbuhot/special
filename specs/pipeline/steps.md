# Pipeline

## Steps

- <Actor> qualifies <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Lead column of the pipeline board. Its Stage menu offers Qualified.
  - <Actor> selects Qualified in "Stage"
- <Actor> proposes <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Qualified column of the pipeline board. Its Stage menu offers Proposal.
  - <Actor> selects Proposal in "Stage"
- <Actor> wins <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in the Proposal column of the pipeline board. Its Stage menu offers Won.
  - <Actor> selects Won in "Stage"
- <Actor> loses <Deal=Ref> on the board means
  - <Actor> opens Pipeline board
  - Narrate: <Deal> is in a column of the pipeline board. Its Stage menu offers Lost.
  - <Actor> selects Lost in "Stage"
- <Actor> creates a deal <Name=Text> for <Company=Ref> [with amount <Amount=Value>] [closing <Close=Value>] [with contact <Contact=Ref>] means
  - <Actor> opens Pipeline board
  - Narrate: The pipeline board has a New deal button above the columns.
  - <Actor> clicks "New deal"
  - <Actor> is on Deal editor
  - Narrate: The deal editor opens with an empty form.
  - <Actor> enters <Name> into "Name"
  - Narrate: The deal name is <Name>.
  - <Actor> enters <Amount> into "Amount"
  - Narrate: The amount is <Amount>.
  - <Actor> enters <Close> into "Close date"
  - Narrate: The close date is <Close>.
  - <Actor> selects <Company> in "Company"
  - Narrate: The company is <Company>.
  - <Actor> selects <Contact> in "Contact"
  - Narrate: The contact is <Contact>.
  - <Actor> clicks "Save"
