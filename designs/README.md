# Designs

Artboards for the Ledger CRM sample app, one self-contained `*.dc.html` file each (1280x800).

- `shell/` holds the application shell.
- `dashboard/` holds the dashboard and its empty state.
- `crm/` holds the contact and company record pages.
- `pipeline/` holds the deal record page.
- `invoicing/` holds the invoice list and the invoice editor in draft and sent states.
- `data-surface="<Name>"` marks a screen region (`Sidebar`, `Dashboard`).
- `data-control="<Name>"` marks every element a spec can name; the name matches the spec's control name exactly.
- Artboards are published to a claude.ai design canvas and serve as the build reference (Tailwind + daisyUI).
