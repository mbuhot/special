# Tests

- A behaviour a person can observe on a screen is a scenario in `specs/`. It is never a hand-written LiveView test or Playwright test.
- Hand-written ExUnit tests cover only what no screen shows: resource invariants, calculations, error returns from actions, query semantics.
- There are no hand-written Playwright tests. `pnpm e2e` runs the scenarios.
- A LiveView test that restates a scenario is deleted when found.
- Every ExUnit module is `async: true`. Shared mutable state that forces a module to run sync (a global clock, a persistent_term, a named process) is a defect in the code under test; scope it to the test process (process dictionary found through `$callers`) and keep the module async.
- A user-visible error path (validation message, forbidden action) gets a scenario. The spec gap is fixed before a domain test is written for it.
- Each scenario opens with a `Story:` line (`As <role>, I need <goal>, so that <reason>.`) and every visible change carries a `Narrate:` line in the voice-over style of the global instructions.

# Specs

- Specs are the source of truth. The Model, Surfaces, Actors and Policies in `specs/` are hand-written; conformance tests in `apps/invoicing/test/spec` hold the Ash resources to them. Nothing in `specs/` is generated from code.
- Base files are declared once and cascade (`specs/*.md`, then `specs/<project>/*.md`); a feature file holds scenarios only.
- After any change under `packages/specdsl-core/src` or `dialects/`, run `pnpm bind` (it rebuilds core) before e2e, demo or `mix test`.
- Design artboards live in `designs/<project>/<surface-slug>/<state>.dc.html` and carry `data-surface` and `data-control` attributes whose values match the spec's names exactly. A surface line names its directory with `design <project>/<surface-slug>`. `specdsl design-lint` (run by `pnpm bind`) checks the link; `pnpm design` walks scenarios over the artboards. They are published to the claude.ai canvas https://claude.ai/artifact/Vwe4b8Fhj1R3tkNCcE4ygS.

# Designs

- The canvas https://claude.ai/artifact/Vwe4b8Fhj1R3tkNCcE4ygS holds the artboards; the design system https://claude.ai/artifact/PUHF3hyTt87V4opkdiSQWe holds tokens and component styles. The canvas carries an installed copy of the system under `project/ds/ledger/`.
- Route every design change by its reach:
  - one screen (a column, a moved element, copy, which controls a surface shows): edit that artboard on the canvas;
  - every screen (a colour, spacing, type, control size, a component's look): edit the design system artifact (`project/tokens.json` or `project/components/bundle.css`), then reinstall it on the canvas (copy its files into `project/ds/ledger/` and update the `designSystems` record's version in `project/canvas.json`). Artboards link the copy by path, so they need no edit.
- Never edit the installed copy under `project/ds/` on the canvas, nor `designs/ds/` in the repo: both are overwritten from the system.
- Inline styles in an artboard are for one-off layout only; anything reusable is a class in the design system. Styling repeated within one screen (the cards on a board, rows in a list) is reusable too: it becomes a design-system pattern named for what it is (`ds-board-card`), never for the screen.
- Component scripts: the design system ships only client-side DOM mechanics (keyboard navigation, focus, Escape and outside-click dismissal, positioning) in `components/bundle.js` (`window.Ledger.attach` / `detach`), attached by `data-ds-*` attributes, with no state and no server calls. `pnpm ds:build` copies it into the app, which attaches it through a LiveView hook. Anything that changes state or talks to the server (selecting a value, changing month, saving, events, `phx-*`, `JS` commands) stays in the app. A component preview with behaviour carries an inline stand-in for the app that owns that state; it never ships in `bundle.js`.
- A canvas comment gets an artboard or design-system edit and a reply in its thread (`/design-comments`); syncing to the repo is `/design-sync`.

# Gates

- All suites: `pnpm test` (bind, core, renderer, spec runtime, app, browser). Single suites: `pnpm test:core`, `pnpm test:render`, `pnpm test:spec-dsl`, `pnpm test:app`, `pnpm e2e`. Designs: `pnpm design`. Video: `pnpm demo`, then `pnpm demo:reel`.
- Never commit `*.ast.json`, `*.lock.json`, `demo-output/`, `test-results/`. Stage with explicit `git add <files>`.
- If asdf shims complain: `ASDF_PNPM_VERSION=11.9.0 ASDF_ELIXIR_VERSION=1.20.2`.
