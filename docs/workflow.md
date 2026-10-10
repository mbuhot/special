# Design to implementation workflow

One loop, six stops. The canvas is where design is discussed; the repository is what everything checks.

```
claude.ai canvas  ──/design-sync──►  designs/  ──►  specs/  ──►  tests  ──►  implementation
  ▲   comments                        design-lint    bind       e2e, mix test
  └── designer and product ◄──────────── design walkthrough video (pnpm design)
```

| Stop           | Who                         | What happens                                                                                                                                                                                                     | Command                                   |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1. Design      | Designer and product        | Edit artboards on the canvas, one per surface state. Leave comments on elements; a comment sent to Claude reaches a Claude Code session watching the canvas, which edits the artboard and replies in the thread. | canvas comments                           |
| 2. Sync        | Claude                      | Pull every artboard into `designs/`, apply mechanical spec changes, and draft scenario and model changes into `docs/proposals/` for review.                                                                      | `/design-sync`                            |
| 3. Specs       | Claude, reviewed by product | Make the specs agree with the designs: new controls declared on surfaces and given scenarios, removals confirmed with the user.                                                                                  | `pnpm bind` until no design-lint warnings |
| 4. Walkthrough | Claude                      | Play every scenario over the static artboards; narrated video for review, report of text mismatches.                                                                                                             | `pnpm design`                             |
| 5. Gaps        | Claude                      | Run the scenarios against the app. Failures are the implementation work the design implies.                                                                                                                      | `pnpm e2e`, `mix test`                    |
| 6. Build       | Claude                      | Implement until the failing scenarios pass, then re-record the app demo.                                                                                                                                         | `pnpm demo`                               |

## Conventions that make the loop work

- Every element a spec can name carries `data-control="<Name>"`; the artboard root area carries `data-surface="<Surface>"`. Names match the spec exactly.
- One artboard per state of a surface, named after the state in the model (`pipeline/deal-page/qualified.dc.html`). A button that moves to another state carries `data-next-state="<state>"`; a link to another surface is an `<a href>` to that artboard.
- A surface with data props is one `default.dc.html` (`pipeline/deal-page/default.dc.html`). Props: the record as `<entity>` (`deal.name`, `deal.amount`), machine field `stage` with `is<State>` flags (`isLead`), predicates as booleans (`<predicate>`), has-many rows as `<relation plural>` (`tasks`, each row with its fields, `is<State>` and child predicates such as `row.overdue`) and `any<Predicate>` (`anyOverdue`). Holes are dotted lookups, so `renderVals` computes the flags from the tweaks and design mode fills the same names from the scenario.
- A surface opened without a Ref whose artboard declares a list prop named after an entity's plural (`deals`, `invoices`) and no `<entity>` record prop is a list surface. Design mode fills the prop with every Given record of the entity in Given order, each row built like a has-many row (fields, `name`, `is<State>`, predicates). Columns and groups are `sc-if` on the row flags.
- An element with `data-record="{{ row.name }}"` and `data-next-state="<state>"` sets that record's machine field on a click and re-renders the same artboard. Without `data-record`, `data-next-state` applies to the surface record. When several cards show the same control, the click targets the card of the only record not in a final state, else the first.
- Permission flags: every record object and row carries `can<Action>` booleans (`canWin`, `canMarkPaid`, `canUpdate`) from the spec's Policies for the role of the actor who opened the surface; list surfaces also carry `canCreate<Entity>` (`canCreateDeal`).
- Edits: a control with `data-field="<field>"` collects `enters`/`selects` values as a pending edit of the surface record, or of the row named by `data-record="{{ row.name }}"`. A click on `data-saves` applies the pending values and re-renders. A click on `data-creates="<relation plural or entity plural>"` creates a record from the pending values (child of the surface record for a has-many relation, top-level for an entity plural on a list surface), named by `name`, `title` or the unique field, then re-renders. A click on `data-removes` with `data-record` deletes that row. An editor opened without a Ref starts with an empty record of its entity, taken from the first word of the surface name (Contact editor: Contact); `data-saves` there creates the record.
- Text filter: `data-filters="<rows prop>"` on a field sets each row's `matches` to whether any string field contains the entered text, ignoring case. `data-filters="<rows prop>"` with `data-filter-field="<field>"` on a select sets `matches` by equality on that field (a belongs-to field compares the related record's name). A select with `data-filters="<rows prop>"` and `data-filter-flag` keeps rows whose flag named by the selected option value is true (`<option value="overdue">`); an empty option value keeps every row. Rows start with `matches: true`; the artboard hides rows with `sc-if` on `matches`.
- Effects: a click with `data-next-state` that moves a record into the state of a `## Effects` entry in the spec creates that entry's target record (`When Invoice mark paid` adds a note Activity to the company's first Contact).
- Counts: top-level props hold every Derived count (`overdueTasks`, `unpaidInvoices`) at the scenario clock and `<state><EntityPlural>Count` for every machine state (`leadDealsCount`).
- Belongs-to: a record or row exposes the related record's name as `<relation>` (`deal.company`) and its fields as `<relation>Record`.
- Computed fields: the spec's product and sum invariants (`LineItem.total = quantity * unit price`, `Invoice.total = sum of LineItem.total`) are evaluated on every record before rendering and after every edit; money renders as `$200.00`.
- Ordering: `<Entity> is listed by <Field> [newest first|oldest first]` in a Model section sorts every row list of that entity (list surfaces, has-many rows, `all<EntityPlural>`) by the field; oldest first is the default.
- New records: a record starts in the first state of its machine and takes the next value of a declared sequence (`INV-001`, `INV-002`).
- Natural key: a Given record that sets no required text field gives the entity's first required text field the Ref name (LineItem description, Invoice number, Task title).
- Users: a belongs-to User relation left unset points at the user of the first actor in the scenario (a User named after the actor, holding its role); created records point at the actor on screen; datetime fields of created records take the scenario clock and date fields stay empty.
- Immediate edits: on a record surface whose artboard has no `data-saves` element, `enters` and `selects` into a `data-field` apply to the record at once and re-render.
- Name after save: a save that changes the natural-key field renames the record, so `name` and every relation to it follow the new value.
- Supporting props: `all<EntityPlural>` (`allCompanies`, `allContacts`) holds every record as top-level rows for select options; `<field>Value` holds the raw input value (ISO date, plain number) beside the formatted `<field>`; `has<Count>` booleans (`hasOverdueTasks`, `hasLeadDeals`) accompany every Derived count and per-state count.
- View-state flags: a click on `data-toggles="<flag>"` with `data-record` flips that boolean on that row; without `data-record` it flips a top-level flag. View state lives in the session (never written to the record), survives re-render and is cleared when the surface is re-opened. Opening a row's `menuOpen` closes every other row's `menuOpen`; opening any other row flag (`reassignOpen`) closes that row's menu; a save on a row closes its overlays.
- Inverse flags: every row carries `selected`, `menuOpen`, `reassignOpen` (default false) and `notSelected`, `notMenuOpen`, `notReassignOpen`; every Derived predicate on a record or row carries `not<Predicate>` (`notOverdue`, `notDueThisWeek`); a toggled top-level flag carries `not<Flag>`. Other booleans have no inverse.
- Selection: `data-toggles-all="<flag>"` with `data-selection="<rows prop>"` sets the flag on every row of that prop whose `matches` is true (all on if any is off, else all off). `data-clears="<flag>"` with `data-selection` turns the flag off on every row. Top-level `anySelected` and `selectedCount` count rows with `selected` true in the prop named by the artboard's first `data-selection`.
- Bulk actions: an element with `data-selection="<rows prop>"` and `data-next-state` applies that state change to every selected row through the single-record state-change path (effects run, permission flags re-derive). `data-saves` with `data-selection` applies the pending values of controls carrying the same `data-selection` and `data-field` to every selected row. Both clear `selected` afterwards.
- Stage select: a select with `data-field` naming the record's machine field and `data-record` changes state through the `data-next-state` path (matching the option value or label to a state, ignoring case), with transitions, effects and permission flags applied.
- Drag and drop: `draggable`, `data-drag-record` and `data-drop-state` are design annotations; design mode ignores them.
- Per-state files remain valid; design mode picks the file named after the record's machine state, else `default`.
- The canvas board paths mirror `designs/` (`project/pipeline/deal-page/qualified.dc.html`), so sync is a copy.
- The canvas URL lives in `designs/canvas.json`.

Design mode also outlines the control in red and shows a caption "Design differs: expected ..., found ..." for 2 seconds when a text check disagrees with the artboard.

## What each check proves

| Check                        | Fails when                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| design-lint (in `pnpm bind`) | an artboard and its surface disagree on control names                                                                             |
| `pnpm design`                | a scenario opens a surface with no artboard or uses a control the artboard lacks; text disagreements are reported without failing |
| `pnpm e2e`, `mix test`       | the running app does not do what the scenario says                                                                                |
