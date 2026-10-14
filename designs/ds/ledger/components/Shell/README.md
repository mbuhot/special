The page frame: a sidebar with brand, navigation links and the signed-in user, beside a column holding the page header and main content.

Provide: the nav links (an `a` per destination with `aria-current="page"` on the current one and an SVG icon in `ds-nav-link__icon`), the user name and email, and the page content.

- Use `ds-shell` once per page, `ds-sidebar` as its first child and `ds-shell__body` as the second.
- Put `ds-sidebar__spacer` before `ds-sidebar__user` to pin the user block to the bottom.
- Put page content in `ds-main`; stack blocks with `ds-stack`, lay them out with `ds-row` and `ds-grid`.
- Keep one `aria-current="page"` link.
