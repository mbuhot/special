# Design system

Plain CSS shared by the design artboards and the Phoenix app. No build step for artboards, no framework.

```
ds/ledger/
  tokens.json   source of values: name to value, `light` and `dark` sets
  tokens.css    generated from tokens.json: :root and dark custom properties
  ds.css        base, layout, components, utilities; var(--ds-*) only
```

- Tokens are custom properties named by role (`--ds-*`).
- Dark theme follows `prefers-color-scheme`; `data-theme="dark"` or `data-theme="light"` on `<html>` forces one.
- Class names are `ds-<block>`, `ds-<block>__<part>`, `ds-<block>--<modifier>`. No ids, no element selectors beyond base.
- Controls are 36px high; inside `.ds-table`, `.ds-menu`, `.ds-dialog` and `.ds-button--small` they are 32px.

## Classes

Layout

- `ds-shell`, `ds-shell__body`: page frame and the column beside the sidebar
- `ds-sidebar` (`__brand __nav __spacer __user __user-label __user-name __user-email __signout`)
- `ds-nav-link` (`aria-current="page"` marks the current page, `__icon`)
- `ds-main`: padded content area
- `ds-page-header` (`__title`): 72px title bar
- `ds-stack` (`--tight`), `ds-row` (`--tight --end --right --between --padded`), `ds-grid` (`--aside --two`)

Components

- `ds-card` (`--row`, `__title`, `__footer`)
- `ds-properties` (`__row __term __value`): `dl` of label and value rows
- `ds-table` (`--compact`, `__head __cell __actions`; `--end --check --muted` on head and cell)
- `ds-button` (`--primary --secondary --ghost --danger --small --icon`)
- `ds-field` (`--grow --sm --md --lg`, `__label`): label plus control
- `ds-input`, `ds-select` (`--md --auto`), `ds-textarea`, `ds-checkbox`
- `ds-badge` (`--inline`; state: `--lead --qualified --proposal --won --lost --draft --sent --paid --void --open --done --overdue`)
- `ds-menu`, `ds-menu-item`: popover list, placed inside a `position: relative` parent such as `ds-table__actions`
- `ds-dialog` (`__title __actions`): popover panel
- `ds-toolbar` (`__count __label __end`): bulk action bar
- `ds-empty`, `ds-link` (`--strong`)

Utilities: `ds-sr-only`, `ds-muted`, `ds-numeric`

## Artboards

```html
<head>
  <script src="./support.js"></script>
  <link rel="stylesheet" href="../../ds/ledger/tokens.css" />
  <link rel="stylesheet" href="../../ds/ledger/ds.css" />
</head>
```

`support.js` stays first in head, as the canvas requires; the design runtime carries the head stylesheet links into the page it renders. The path is relative to `designs/<project>/<surface>/`. The design runtime serves `designs/`, so `ds/ledger/` resolves. The canvas installs the system as `project/ds/ledger/`; its editor reads `tokens.json`.

## App

`pnpm ds:build` regenerates `tokens.css` from `tokens.json` and writes `apps/invoicing/assets/css/ds.css` (tokens followed by `ds.css`). Edit values in `tokens.json` only. The app links that file from the root layout and emits the same class names; `data-theme` on `<html>` switches theme.
