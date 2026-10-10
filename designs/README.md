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
- `pipeline/deal-page/` holds the deal page in `qualified` and `proposal` states.
- `invoicing/invoice-list/` and `invoicing/invoice-editor/` (`draft`, `sent`) hold the invoice screens.

Markup contract:

- `data-surface="<Name>"` marks a screen region; the value is the spec's surface name.
- `data-control="<Name>"` marks every element a spec can name; the value is the spec's control name.
- `data-next-state="<state>"` on a control makes `pnpm design` load that state after a click.
- An `<a href="....dc.html">` control makes `pnpm design` navigate to that artboard.

Spec link: `- Deal page: design pipeline/deal-page, region "Deal name", ...` (path relative to this directory; the root `specs/specdsl.json` names it with `"designs": "../designs"`).

Commands:

- `pnpm design:lint` reports controls declared but not designed, designed but not declared, wrong `data-surface` values and missing directories.
- `pnpm design -- --scenario "<name>"` records a narrated walkthrough to `design-output/<slug>/design.mp4` and writes `report.json` listing text mismatches.

Artboards are published to a claude.ai design canvas and serve as the build reference (Tailwind + daisyUI).
