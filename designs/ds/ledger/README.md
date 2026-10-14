Plain CSS for the Ledger CRM and invoicing app. Controls are 36px high; inside tables, menus, dialogs and small buttons they are 32px.

## Content fundamentals

- Write short sentence-case labels: "Add task", "Open deal", "Reassign…". Table heads are set uppercase by `ds-table__head`.
- Address the user by role and action, never by "I" or "we". Empty states say what is missing: "No open tasks".
- Currency and counts use `ds-numeric` so digits align.
- State is a word on a `ds-badge`: Lead, Qualified, Proposal, Won, Lost, Draft, Sent, Paid, Void, Open, Done, Overdue.

## Visual foundations

- Colour: set text in `ds-text` on `ds-bg`, `ds-surface` and `ds-surface-muted`; secondary copy in `ds-text-secondary`; labels in `ds-text-muted`. Accent text uses `ds-accent-ink`; accent fills use `ds-accent` with `ds-accent-text`.
- Themes: `light` is the default on `:root`; `data-theme="dark"` on `<html>` switches every token. Text holds 4.5:1 on the grounds its token note names in both themes.
- Type: the sans stack in `--font-sans`; sizes `ds-text-xs` to `ds-text-3xl`; weights `ds-weight-medium`, `ds-weight-semibold`, `ds-weight-bold`. Text style classes `ds-caption`, `ds-small`, `ds-body`, `ds-lead`, `ds-subtitle`, `ds-title`, `ds-display`.
- Spacing: `ds-space-1` (4px) to `ds-space-8` (32px). Card padding is `ds-space-5`; row gap `ds-space-3`; page padding `ds-space-8`.
- Borders: 1px `ds-border` hairlines; controls use `ds-border-strong`. Radius is `ds-radius` (8px); badges use `ds-radius-pill`.
- Shadow: only `ds-shadow-popover`, on menus and dialogs.
- Focus: a 2px `ds-focus-ring` outline offset 1px on every interactive element.
- Layout: a 240px sidebar beside a column holding a 72px page header and a padded `ds-main`.

## Iconography

- Navigation icons are 20px outline SVGs, stroke width 1.75, round caps, drawn in `currentColor` inside `ds-nav-link__icon`.
- Icon buttons use `ds-button--icon` with a text glyph such as the vertical ellipsis.
- No logo is provided; the sidebar brand is plain type in `ds-sidebar__brand`.

## Using the classes

- Class names are `ds-<block>`, `ds-<block>__<part>` and `ds-<block>--<modifier>`.
- Load `tokens.css` then `components/bundle.css`.
- Every value in the stylesheet is a token custom property; change a value in `tokens.json`.
- Utilities: `ds-sr-only`, `ds-muted`, `ds-numeric`.
