# special

One Markdown spec, three uses: acceptance criteria in a Linear ticket (an agent copies it into the repo), executable tests in two runtimes, and a narrated demo video.

```
specs/**/*.md ──► pnpm bind ──► specs/<project>/<feature>.ast.json
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
               ExUnit + LiveViewTest   Playwright (browser)   Playwright demo mode
               apps/invoicing/test     pnpm e2e               pnpm demo → demo-output/*.mp4
```

## The sample app

A CRM: companies, contacts, activities, a deals pipeline, tasks, invoicing and a dashboard. Four roles use it: sales rep, sales manager, accounts, admin.

```
specs/
├── company.md  contact.md  user.md  actors.md    shared entities and roles
├── crm/         uses invoicing                   companies, contacts, activities
├── pipeline/                                     deals, tasks
├── invoicing/   uses crm                         invoices
└── dashboard/   uses pipeline, invoicing         home page counts
```

## Layout

| Path                          | Holds                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `dialects/`                   | The vocabulary, as TypeScript: sections, step patterns, contexts, surfaces with locators, checks |
| `specs/`                      | Specs in Markdown: shared base files at the root, one directory per project, bound ASTs          |
| `packages/specdsl-core`       | Parse, bind, lint, lock. CLI `specdsl`                                                           |
| `packages/specdsl-playwright` | Browser runtime: test mode and demo mode                                                         |
| `elixir/spec_dsl`             | Elixir runtime: AST loader, `SpecDSL.Case`, `SpecDSL.Handlers`                                   |
| `apps/invoicing`              | Sample Phoenix + Ash CRM, the system under test                                                  |
| `docs/design.md`              | Design                                                                                           |

## Scenarios

`pnpm demo:reel` joins every video in spec order into `demo-output/reel.mp4`, one chapter per scenario, and writes `demo-output/reel.m3u8`. Each scenario produces `demo-output/<slug>/demo.mp4`. The slug is the lowercase scenario name with runs of non-alphanumerics collapsed to hyphens. A scenario with two actors produces `demo-<actor-slug>.mp4` per actor.

### crm

| Scenario                                     | The video shows                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Timeline shows a contact's activities        | A contact page with a timeline, newest activity first.                                    |
| Logging a note on a contact                  | A note logged on a contact appears in the timeline with today's date.                     |
| Activity timeline advances with the clock    | After two days pass, a logged meeting appears in the timeline with the later date.        |
| Company list shows every company             | The company table lists Acme and Globex.                                                  |
| Searching companies by name                  | Searching narrows the company table to Globex.                                            |
| Creating a company                           | A new company is saved and its page shows the name Initech.                               |
| Editing a company                            | The company name changes to Acme-Corp.                                                    |
| Company page lists its contacts and invoices | The company page shows the name, its contact, its invoice and an edit button.             |
| Contact list shows every contact             | The contact table lists Ada Lovelace and Grace Hopper.                                    |
| Searching contacts by name                   | Searching narrows the contact table to Grace Hopper.                                      |
| Filtering contacts by company                | Filtering by company narrows the contact table to the contacts of Acme.                   |
| Creating a contact                           | A new contact is saved and shows the name Ada Lovelace.                                   |
| Editing a contact                            | The contact name changes to Ada-Byron Lovelace.                                           |
| Who may edit contacts                        | A sales rep may edit a contact. Accounts may only read it. Both roles may edit a company. |

### pipeline

| Scenario                                        | The video shows                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| Who may move a deal through the pipeline        | The sales rep's board has no Win button. Only the sales manager may win. |
| Who may complete a task                         | A sales rep may complete a task. Accounts may not.                       |
| Pipeline board shows a deal in its stage column | The board lists Big deal in the lead column.                             |
| Qualifying a lead                               | Big deal moves from the lead column to the qualified column.             |
| Proposing a qualified deal                      | Big deal moves from the qualified column to the proposal column.         |
| Winning a proposal                              | Big deal moves from the proposal column to the won column.               |
| Losing a lead                                   | Big deal moves from the lead column to the lost column.                  |
| Losing a qualified deal                         | Big deal moves from the qualified column to the lost column.             |
| Losing a proposal                               | Big deal moves from the proposal column to the lost column.              |
| Creating a deal                                 | A new deal is saved and shows the name Big-deal in stage lead.           |
| Adding a task to a deal                         | The deal page lists the new task with its due date in the task table.    |
| Completing a task                               | The task status changes to done.                                         |
| A task becomes overdue as time advances         | Two days later the task appears in the overdue tasks region.             |

### invoicing

| Scenario                                                     | The video shows                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Invoice list shows every invoice                             | The invoice table lists INV-001 and INV-002.                                          |
| Creating an invoice from the list                            | A new draft invoice opens in the editor.                                              |
| Line total updates as quantity changes                       | The line total updates as the quantity and the unit price change.                     |
| Who may send and settle invoices                             | The sales rep's editor has no Send button. Accounts may send. Only an admin may void. |
| Sending a draft invoice marks it sent                        | The invoice status changes to sent.                                                   |
| A manager sees an invoice once it is sent                    | Accounts sends the invoice, then the admin opens it and sees status sent. Two videos. |
| Marking a sent invoice paid                                  | The invoice status changes to paid.                                                   |
| Voiding a draft invoice                                      | The invoice status changes to void.                                                   |
| Only an admin can void or mark an invoice paid               | The accountant's editor shows Send and no Void or Mark paid.                          |
| Marking an invoice paid logs a note on the company's contact | The invoice becomes paid. The contact's timeline shows the note Invoice INV-001 paid. |

### dashboard

| Scenario                              | The video shows                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Dashboard counts open deals per stage | The dashboard lists two deals in lead and one in proposal. Won deals are absent. |
| Dashboard counts overdue tasks        | The dashboard shows one overdue task.                                            |
| Dashboard counts unpaid invoices      | The dashboard shows two unpaid invoices. Paid invoices are absent.               |

## Commands

| Task                   | Command                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                | `pnpm install`                                                                                                                                                  |
| Set up the app         | `cd apps/invoicing && mix setup`                                                                                                                                |
| Run the app            | `cd apps/invoicing && mix phx.server`, then http://localhost:4000; sign in as sales@example.com, manager@example.com, accounts@example.com or admin@example.com |
| Bind and lint specs    | `pnpm bind`                                                                                                                                                     |
| Regenerate the lock    | `pnpm lock`                                                                                                                                                     |
| Core tests             | `pnpm --filter @special/specdsl-core test`                                                                                                                      |
| Scenarios in ExUnit    | `cd apps/invoicing && mix test`                                                                                                                                 |
| Scenarios in a browser | `pnpm e2e`                                                                                                                                                      |
| Demo videos            | `pnpm demo`                                                                                                                                                     |
| One reel with chapters | `pnpm demo:reel`                                                                                                                                                |

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

- Invoice: number (text, required), status, total (money). Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void

## Surfaces

- Invoice editor: field "Quantity", region "Totals", button "Send"

## Actors

- Accounts: role accountant

## Scenario: Line total updates as quantity changes

Story: As accounts, I need the line total to follow the quantity, so that the customer is billed the correct amount.
Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100
When Accounts opens Invoice editor for INV-001
And Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
Narrate: The line total updates as the quantity changes.
```

- Every step matches one pattern from the dialect. Unknown words fail at bind time with a line number.
- Nouns come from `## Model`, `## Surfaces` and `## Actors`. Quoted names are controls on the surface the actor has open, or on a surface marked `(shared)`.
- A field may carry a type and `required`: text, email, phone, url, money, integer, decimal, date, datetime, boolean, or `one of a, b, c`. A relation may be named: `Belongs to User as author`. Conformance tests hold the Ash resources to these.
- `Story:` is the first line of every scenario: "As <who>, I need <what>, so that <why>." Demo mode speaks it over the opening card, and lint warns when it is missing.
- `Narrate:` applies to the step above it and is used by demo mode only.

## Adding vocabulary

| Change                  | Where                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new screen or control | `surface(...)` in the project dialect with `css`, `lv` and `form` locators                                                                         |
| A new step shape        | `step(pattern, ...)` in the dialect, a handler in `packages/specdsl-playwright/src/handlers` and in `apps/invoicing/test/support/spec_handlers.ex` |
| A new context           | `context(...)` in the dialect, setup and teardown in both runtimes                                                                                 |
| A composite step        | `## Steps` section of the spec                                                                                                                     |

Runtimes check handler coverage against `dialects/<name>.lock.json`.
