# Designs

Artboards for the Ledger CRM sample app, one self-contained `*.dc.html` file per surface state (1280x800).

```
designs/
  <project>/
    <surface-slug>/
      <state>.dc.html      state = a value of the surface's machine field, or `default`
```

- `shell/Shell.dc.html` holds the application shell (reference; the Sidebar is a shared surface).
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
- Text filter: `data-filters="<rows prop>"` on a field sets each row's `matches` to whether any string field contains the entered text, ignoring case. `data-filters="<rows prop>"` with `data-filter-field="<field>"` on a select sets `matches` by equality on that field (a belongs-to field compares the related record's name). Rows start with `matches: true`; the artboard hides rows with `sc-if` on `matches`.
- Counts: top-level props hold every Derived count (`overdueTasks`, `unpaidInvoices`) at the scenario clock and `<state><EntityPlural>Count` for every machine state (`leadDealsCount`).
- Belongs-to: a record or row exposes the related record's name as `<relation>` (`deal.company`) and its fields as `<relation>Record`.

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
