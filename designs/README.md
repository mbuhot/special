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
