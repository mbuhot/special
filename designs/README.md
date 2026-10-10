# Designs

Artboards for the Ledger CRM sample app, one self-contained `*.dc.html` file per surface state (1280x800).

```
designs/
  <project>/
    <surface-slug>/
      <state>.dc.html      state = a value of the surface's machine field, or `default`
```

- `shell/Shell.dc.html` holds the application shell (reference; the Sidebar is a shared surface).
- `shell/login/default.dc.html` holds the Login surface (no sidebar; `Email` field and `Log in` button). The Sidebar's `Sign out` control is an `<a href="../../shell/login/default.dc.html">` in every artboard that has a sidebar.
- `dashboard/dashboard/` holds the dashboard in `default` and `empty` states.
- `crm/contact-page/` and `crm/company-page/` hold the record pages.
- `pipeline/deal-page/default.dc.html` holds the deal page as one data-driven artboard.
- `pipeline/pipeline-board/default.dc.html` holds the board as one list artboard (`deals`).
- `invoicing/invoice-list/` and `invoicing/invoice-editor/` (`draft`, `sent`) hold the invoice screens.

Data props: an artboard declares `data-props` on its `text/x-dc` script (`default` = sample data; `editor` enum or boolean = canvas tweak; `editor: null` = data). Holes are dotted lookups into `renderVals()`, which returns `{ ...this.props }` plus derived flags. `pnpm design` fills the props from the scenario:

| Prop                           | Value                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `<entity>`                     | the surface record's fields, camelCase keys, plus `name` (the Ref)                            |
| `<machine field>`, `is<State>` | current state and one flag per state                                                          |
| `<predicate>`                  | the entity's Derived predicate at the scenario clock                                          |
| `<relation plural>`            | child rows; each row has its fields, `name`, `is<State>` and child predicates (`row.overdue`) |
| `any<Predicate>`               | true when any child row satisfies the predicate                                               |

List surfaces: a surface opened without a Ref whose artboard declares a plural prop (`deals`) and no `<entity>` prop gets every Given record of that entity as rows, in Given order, built like child rows. Filter and group with `sc-if` on the row flags.

Runtime conventions (design mode supplies all data and flags; artboards hold no logic):

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

Markup contract:

- `data-surface="<Name>"` marks a screen region; the value is the spec's surface name.
- `data-control="<Name>"` marks every element a spec can name; the value is the spec's control name.
- `data-next-state="<state>"` on a control makes `pnpm design` load that state after a click.
- `data-record="{{ row.name }}"` with `data-next-state="<state>"` makes a click set that record's machine field and re-render the same artboard.
- An `<a href="....dc.html">` control makes `pnpm design` navigate to that artboard.

Spec link: `- Deal page: design pipeline/deal-page, region "Deal name", ...` (path relative to this directory; the root `specs/specdsl.json` names it with `"designs": "../designs"`).

Commands:

- `pnpm design:lint` reports controls declared but not designed, designed but not declared, wrong `data-surface` values and missing directories.
- `pnpm design -- --scenario "<name>"` records a narrated walkthrough to `design-output/<slug>/design.mp4` and writes `report.json` listing text mismatches.

Artboards are published to a claude.ai design canvas and serve as the build reference (Tailwind + daisyUI).
