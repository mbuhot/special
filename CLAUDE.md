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

# Gates

- Core: `pnpm --filter @special/specdsl-core test`. App: `cd apps/invoicing && mix test`. Browser: `pnpm e2e`. Video: `pnpm demo`, then `pnpm demo:reel`.
- Never commit `*.ast.json`, `*.lock.json`, `demo-output/`, `test-results/`. Stage with explicit `git add <files>`.
- If asdf shims complain: `ASDF_PNPM_VERSION=11.9.0 ASDF_ELIXIR_VERSION=1.20.2`.
