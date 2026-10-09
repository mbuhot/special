# special

One Markdown spec, three uses: acceptance criteria in a Linear ticket, executable tests in two runtimes, and a narrated demo video.

```
specs/**/*.md ──► pnpm bind ──► specs/invoicing/<feature>.ast.json
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
               ExUnit + LiveViewTest   Playwright (browser)   Playwright demo mode
               apps/invoicing/test     pnpm e2e               pnpm demo → demo-output/*.mp4
```

## Layout

| Path                          | Holds                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `dialects/`                   | The vocabulary, as TypeScript: sections, step patterns, contexts, surfaces with locators, checks |
| `specs/`                      | Specs in Markdown: shared base files at the root, one directory per project, bound ASTs          |
| `packages/specdsl-core`       | Parse, bind, lint, lock. CLI `specdsl`                                                           |
| `packages/specdsl-playwright` | Browser runtime: test mode and demo mode                                                         |
| `packages/specdsl-linear`     | Pull specs from Linear issues, lint, attach videos                                               |
| `elixir/spec_dsl`             | Elixir runtime: AST loader, `SpecDSL.Case`, `SpecDSL.Handlers`                                   |
| `apps/invoicing`              | Sample Phoenix + Ash app, the system under test                                                  |
| `docs/design.md`              | Design                                                                                           |

## Commands

| Task                   | Command                                    |
| ---------------------- | ------------------------------------------ |
| Install                | `pnpm install`                             |
| Bind and lint specs    | `pnpm bind`                                |
| Regenerate the lock    | `pnpm lock`                                |
| Core tests             | `pnpm --filter @special/specdsl-core test` |
| Scenarios in ExUnit    | `cd apps/invoicing && mix test test/spec`  |
| Scenarios in a browser | `pnpm e2e`                                 |
| Demo videos            | `pnpm demo`                                |

## Prerequisites

- Node 26, pnpm 11, Elixir 1.20, Erlang 29 (see `.tool-versions`)
- Postgres on localhost:5432, user `postgres`, password `postgres`
- `ffmpeg`, `ffprobe`, `pocket-tts` on PATH for demo mode
- `cd apps/invoicing && mix setup && MIX_ENV=e2e mix ash.setup && MIX_ENV=e2e mix assets.build`

## Writing a spec

A directory holding `specdsl.json` (`{ "dialect": "../dialects/invoicing.ts" }`) is the root of a specs tree. A file without a `## Scenario` section is a base file and holds `## Model`, `## Surfaces`, `## Actors` and `## Policies`. A file with scenarios is a feature file. `specdsl bind-all <root>` lints the whole tree and writes `<feature>.ast.json` beside each feature file.

A feature file binds against the base files of the root, then of each directory down to its own, then itself. Models shared between projects live once at a higher level and cascade down.

```
specs/
├── specdsl.json
├── customer.md                            shared base file
└── invoicing/
    ├── model.md  surfaces.md  policies.md     project base files
    └── line-totals.md  sending.md  ...        feature files ──► line-totals.ast.json  sending.ast.json  ...
```

A single file may hold every section. Bound with `specdsl bind`, it is its own base:

```markdown
# Invoicing

## Model

- Invoice: number, status, total. Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void

## Surfaces

- Invoice editor: field "Quantity", region "Totals", button "Send"

## Actors

- Accounts: role accountant

## Scenario: Line total updates as quantity changes

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
And Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
Narrate: The line total updates as the quantity changes.
```

- Every step matches one pattern from the dialect. Unknown words fail at bind time with a line number.
- Nouns come from `## Model`, `## Surfaces` and `## Actors`. Quoted names are controls on the surface the actor has open.
- `Narrate:` applies to the step above it and is used by demo mode only.

## Adding vocabulary

| Change                  | Where                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new screen or control | `surface(...)` in the project dialect with `css`, `lv` and `form` locators                                                                         |
| A new step shape        | `step(pattern, ...)` in the dialect, a handler in `packages/specdsl-playwright/src/handlers` and in `apps/invoicing/test/support/spec_handlers.ex` |
| A new context           | `context(...)` in the dialect, setup and teardown in both runtimes                                                                                 |
| A composite step        | `## Steps` section of the spec                                                                                                                     |

Runtimes check handler coverage against `dialects/<name>.lock.json`.
