# special

A prototype of spec-first development with AI agents. Product and design write a Markdown spec and design artboards; agents build the system from them; the spec checks the designs and the code on every commit for as long as the system lives.

```
             claude.ai design canvas  ◄── comments from designer and product
                       │
                 /design-sync
                       ▼
 designs/*.dc.html ◄── design-lint ──► specs/**/*.md ◄── conformance, scenarios ──► apps/invoicing
        │                                   │                                          │
   pnpm design                          pnpm bind                            mix test, pnpm e2e
   walkthrough video                    AST JSON                             pnpm demo
   over the artboards                                                        narrated app video
```

The sample system is a small CRM with invoicing: companies, contacts, activities, a deals pipeline, tasks, invoices and a dashboard, for four roles (sales rep, sales manager, accounts, admin).

## The lifecycle

| Stop           | Who                        | What happens                                                                                                                | Check                  |
| -------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1. Ticket      | Product                    | A story is written as a scenario: `Story:` line, steps, `Narrate:` lines. An agent copies it from the ticket into `specs/`. | `pnpm bind`            |
| 2. Design      | Designer and product       | Artboards on the claude.ai canvas show each state of each screen. Comments sent to Claude become artboard edits.            | canvas review          |
| 3. Sync        | Agent                      | `/design-sync` pulls the canvas into `designs/`, reconciles the specs with it, and reports what changed.                    | design-lint            |
| 4. Walkthrough | Agent, reviewed by product | Every scenario plays over the static artboards, filled with the scenario's data, as narrated video.                         | `pnpm design`          |
| 5. Gaps        | Agent                      | Scenarios that fail against the app are the implementation work.                                                            | `mix test`, `pnpm e2e` |
| 6. Build       | Agent                      | The agent implements until the scenarios pass, using the artboards as the visual reference.                                 | all gates              |
| 7. Demo        | Agent                      | Every scenario is recorded against the running app as narrated video.                                                       | `pnpm demo`            |

Detail: `docs/workflow.md`. The plan and its history: `docs/plans/ui.md`.

## What is checked against what

| Pair              | Checked                                                                                                                                                         | Not checked                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Designs and specs | Control names on each surface; every control a scenario uses exists in the artboard; the text a scenario expects appears in that state                          | Layout and styling                                      |
| Specs and code    | Every scenario, in-process and in a browser; model fields, types and relations; the role-by-action matrix; invariants and derived rules as generated properties | Anything no spec states                                 |
| Designs and code  | Through the shared scenarios only                                                                                                                               | Layout and styling; the artboards steer the implementer |

## What a spec holds

Base files declare structure once and cascade from `specs/` down into each project directory. Feature files hold scenarios.

| Section         | Example                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `## Model`      | `- Deal: name (text, required), amount (money), close date (date), stage. Belongs to Company. Belongs to User as owner.`        |
|                 | `- Deal.stage: lead -> qualified -> proposal -> won, lead -> lost`                                                              |
|                 | `- Activity is listed by occurred at newest first`                                                                              |
| `## Surfaces`   | `- Deal page: design pipeline/deal-page, region "Deal name", region "Stage", button "Qualify", table "Tasks"`                   |
| `## Actors`     | `- Sales rep: role sales`                                                                                                       |
| `## Policies`   | `- Deal: sales may read, create, update, qualify, propose`                                                                      |
| `## Invariants` | `- Invoice.total = sum of LineItem.total`                                                                                       |
| `## Derived`    | `- Task is overdue when status is open and due date is before today`                                                            |
| `## Effects`    | `- When Invoice mark paid: create Activity for the first Contact of its company with kind "note", body "Invoice {number} paid"` |
| `## Steps`      | Composite steps with optional data slots, expanded before binding                                                               |
| `## Scenario`   | `Story:`, `Given` / `When` / `Then` steps, `Narrate:` lines                                                                     |

A scenario:

```markdown
## Scenario: A task becomes overdue as time advances

Story: As the sales rep, I need to see Send proposal listed as overdue once its due date has passed, so that I notice work that is late.
Given a Company "Acme"
Given a Deal "Big deal" with stage lead, company Acme
Given a Task "Send proposal" with title Send-proposal, due date 2026-01-16, deal Big deal, status open
And Send proposal is not overdue
When Sales rep opens Deal page for Big deal
Narrate: The deal page for Big deal lists the task Send proposal, due on the sixteenth of January.
Then Sales rep does not see "Overdue tasks"
Narrate: The page has no overdue tasks region.
When time advances 2 days
Narrate: Two days pass. The due date is now behind.
And Send proposal is overdue
And Sales rep opens Deal page for Big deal
Then Sales rep sees "Send-proposal" in "Overdue tasks"
Narrate: An overdue tasks region appears. It lists the task Send-proposal.
```

- Every line matches one step shape. Unknown words fail at bind time with a line number.
- Quoted names are controls declared on a surface. Their locators live in the per-project surface maps in `dialects/`, so specs never contain selectors.
- Engineers own the vocabulary (`dialects/web-app.ts`) and the surface maps. Product and agents write specs.

Syntax reference: `docs/design.md`.

## Designs

Artboards live at `designs/<project>/<surface>/default.dc.html` and mirror the canvas. They show states and contain no logic.

- Data comes in as props: the record, its rows, counts, permission flags (`canWin`), state flags (`isLead`), predicates (`overdue`). Design mode fills them from the scenario and the spec's rules; on the canvas they are tweaks with sample defaults.
- Interactions change state: `data-next-state` moves a record, `data-field` and `data-saves` edit, `data-creates` and `data-removes` add and delete rows, `data-filters` filters a list.
- Every element a spec names carries `data-control` with the spec's name.

Conventions: `designs/README.md`.

## Layout

| Path                              | Holds                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `specs/`                          | The specs tree                                                                                                   |
| `designs/`                        | Artboards mirrored from the canvas; `canvas.json` names the canvas                                               |
| `dialects/`                       | Vocabulary and per-project surface maps                                                                          |
| `packages/specdsl-core`           | Parse, bind, lint, design-lint, lock. CLI `specdsl`                                                              |
| `packages/specdsl-playwright`     | Browser runtime: test, demo and design modes                                                                     |
| `elixir/spec_dsl`                 | Elixir runtime: scenario cases and the model, policy, invariant and derived conformance suites behind an adapter |
| `apps/invoicing`                  | The sample Phoenix + Ash application                                                                             |
| `.claude/commands/design-sync.md` | The `/design-sync` command                                                                                       |
| `docs/`                           | Design of the spec language, the workflow, the plan, reviews                                                     |

## Commands

Every task runs from the repository root.

| Task                                   | Command                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Install and set up everything          | `pnpm setup`                                                                                                                   |
| Load demo data                         | `pnpm seed:demo`                                                                                                               |
| Run the app                            | `pnpm server`, then http://localhost:4000 as sales@example.com, manager@example.com, accounts@example.com or admin@example.com |
| Bind and lint specs and designs        | `pnpm bind`                                                                                                                    |
| Every test suite                       | `pnpm test`                                                                                                                    |
| Spec language tests                    | `pnpm test:core`                                                                                                               |
| Design renderer tests                  | `pnpm test:render`                                                                                                             |
| Elixir spec runtime tests              | `pnpm test:spec-dsl`                                                                                                           |
| Scenarios and conformance, in-process  | `pnpm test:app`                                                                                                                |
| Scenarios in a browser                 | `pnpm e2e`                                                                                                                     |
| Design walkthrough                     | `pnpm design [-- --scenario "<name>"]`                                                                                         |
| App demo videos                        | `pnpm demo`, then `pnpm demo:reel`                                                                                             |
| Format TypeScript, Markdown and Elixir | `pnpm format`                                                                                                                  |
| Sync the canvas                        | `/design-sync` in Claude Code                                                                                                  |

`pnpm test` binds the specs first, then runs core, renderer, spec runtime, app and browser suites in that order and stops at the first failure.

## Prerequisites

- Node 26, pnpm 11, Elixir 1.20, Erlang 29 (see `.tool-versions`)
- Postgres on localhost:5432, user `postgres`, password `postgres`
- `ffmpeg`, `ffprobe` and `pocket-tts` on PATH for the demo and design videos
