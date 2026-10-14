A full-width table with uppercase muted heads, hairline row rules and an optional trailing actions cell.

Provide: `th.ds-table__head` and `td.ds-table__cell` cells. Modifiers `--end` (right aligned), `--check` (checkbox column) and `--muted` (secondary text) apply to both. `ds-table--compact` tightens the rows. Controls inside a table are 32px high.

- Right-align numbers with `--end` and set them in `ds-numeric`.
- Put row actions in `ds-table__actions`; it positions a `ds-menu` or `ds-dialog` below the trigger.
- An empty table shows one `td.ds-table__cell.ds-empty` spanning every column.
