# special

A Markdown spec language with one closed vocabulary and three uses:

| Use                              | Where                                                     |
| -------------------------------- | --------------------------------------------------------- |
| Planning and acceptance criteria | Spec in a Linear ticket, copied into the repo by an agent |
| Executable tests                 | Playwright (browser) and ExUnit (in-process Phoenix)      |
| Narrated demo video              | Playwright demo mode, pocket-tts, ffmpeg                  |

## Layers

```
dialect (TypeScript code)   sections, step patterns, namespaces, contexts, surfaces, checks
        │
spec (Markdown)             the ticket body: Model, Surfaces, Actors, Context, Steps, Scenario
        │
specdsl-core (TS)           parse → bind → lint → AST JSON
        │
   ┌────┴─────┐
Playwright   ExUnit         handlers keyed by step id
```

The AST JSON file is the contract between the two runtimes.

## Repository

```
packages/specdsl-core/        parse, pattern compiler, dialect builder, bind, lint, AST emit, CLI
packages/specdsl-playwright/  TS runtime: test mode, demo mode
dialects/web-app.ts           base UI vocabulary
dialects/invoicing.ts         project vocabulary, extends web-app
elixir/spec_dsl/              Hex package: AST loader, ExUnit case generator, handler macros
apps/invoicing/               sample Phoenix + Ash app, the system under test
specs/*.md                    specs
```

## Spec format

Markdown. `#` is the feature. Each `##` is a section whose kind the dialect defines. Items are bullets or lines. Step lists are bullets or bare lines. Tables hold examples.

```markdown
# Invoicing

## Model

- Customer: name (text, required), email (email)
- Invoice: number (text, required), status, total (money). Belongs to Customer as billed to. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description (text, required), quantity (integer, required), unit price (money, required)
- Customer has many Invoice

## Surfaces

- Invoice list: table "Invoices", button "New invoice"
- Invoice editor: field "Quantity", field "Unit price", region "Totals", button "Send"
- Sidebar (shared): link "Dashboard", link "Invoices"

## Actors

- Accounts: role accountant

## Policies

- Invoice: accountant may read
- Invoice: admin may read, mark paid

## Context

- Clock: 2026-01-15T09:00:00Z

## Steps

- <Actor> creates an invoice for <Customer> means
  - <Actor> opens Invoice list
  - <Actor> clicks "New invoice"
  - <Actor> selects <Customer> in "Customer"

## Scenario: Line total updates as quantity changes

Story: As accounts, I need the line total to follow the quantity, so that the customer is billed the correct amount.
Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
Then Accounts may not mark paid INV-001
Narrate: The line total updates as the quantity changes.
```

`Given`, `When`, `Then`, `And` are ignored prefixes. Step shape is determined by the pattern match.

The `Story:` line is the first line of a scenario and states who needs what and why. Demo mode speaks it over the opening card, and lint warns when a scenario has none.

Model fields are `<Field> [(<Type>[, required])]`. An untyped field has no declared type. Types are `text`, `email`, `phone`, `url`, `money`, `integer`, `decimal`, `date`, `datetime`, `boolean` and `one of a, b, c` (enum). An unknown type is a bind error. A state machine line (`Invoice.status: draft -> sent`) types its field as `one of <states>`; a field declared with a different type or a different value set is a bind error.

Relations take a role: `Belongs to User as owner`, `Has many Task as work`. The relation name defaults to the entity name in snake case.

A surface listed as `<Surface> (shared): ...` (or declared with `shared: true` in the dialect) is present on every page, so its controls resolve from any step; the step's `Surface` argument names the shared surface and the actor stays on the page they were on.

## Pattern mini-language

Used for section items and steps.

| Syntax         | Meaning                                                             |
| -------------- | ------------------------------------------------------------------- |
| `word`         | literal token, case-insensitive                                     |
| `<Slot>`       | slot bound to namespace `Slot`                                      |
| `<Slot:kind>`  | slot bound to namespace `Slot`, entry must have `kind`              |
| `<Slot:a\|b>`  | slot bound to namespace `Slot`, entry must have kind `a` or `b`     |
| `<Slot.kind>`  | slot that captures the kind enum of namespace `Slot`                |
| `<Alias=Slot>` | slot named `Alias` bound to namespace `Slot`                        |
| `"<Slot>"`     | slot whose source text is double-quoted                             |
| `[ ... ]`      | optional group                                                      |
| `<A> <B>, ...` | preceding element repeats, comma separated                          |
| `<on\|off>`    | inline enum                                                         |
| `(<Slot>)`     | slot captured from one parenthesised token, without the parentheses |

A parenthesised group in the text, such as `(text, required)`, is one token and keeps its commas. A repeated unit may end in an optional group (`<Field> [(<Type>)], ...`); a repeated slot that is absent from an iteration captures an empty string so lists stay aligned.

Compiles to a parser at dialect load. Longest match wins; ambiguity between two steps is a dialect load error.

## Dialect API (TypeScript)

```typescript
dialect({
  name, version,
  namespaces: { Entity: ns(), Control: ns({ scope: "Surface", kinds: [...] }), Ref: ns({ scope: "scenario" }) },
  contexts:   { app: context({ scope: "suite" }), actor: context({ scope: "actor", keyedBy: "Actor", requires: ["data"] }) },
  sections:   { Model: section({ occurs: "once", items: [{ pattern, declares, references, emits }] }),
                Scenario: section({ heading: "Scenario: <Name>", occurs: "many", body: "steps", items: [...] }) },
  surfaces:   { "Invoice editor": surface({ route, controls: { Quantity: field({ css, lv }) } }) },
  steps:      [ step(pattern, { uses, declares, emits, modes }) ],
  checks:     [ check.coverage({ declared, usedBy }), check.sequence({ machine, observed, within }) ],
})
```

Steps in the dialect carry no handler code. Handlers live in runtimes and are keyed by step id. Step id is a slug derived from the pattern or given explicitly.

Scopes: `suite`, `scenario`, `actor`. Setup order follows `requires`. Teardown is reverse. Actor contexts are created on first mention, keyed by actor name.

Dialect extension is object spread. A derived dialect adds; it does not remove or redefine base steps.

## Bind

1. Match each `##` to a section kind. Unknown heading is an error.
2. Declaration pass over items marked `declares`, populating namespaces. Surfaces declared in the dialect are pre-populated.
3. Expand composite steps from `## Steps`.
4. Resolution pass over step lists. Each step parses against the step patterns. Slots resolve against namespaces with kind checks. `Ref` is scenario scoped and must be declared by an earlier step in the same scenario. Slots resolve Ref first, so an `Action` slot resolves in the scope of the Ref's entity.
5. Emit AST or a list of errors with file and line.

### Composite steps

`## Steps` holds `- <header pattern> means` items with nested child steps. The header uses the pattern mini-language; `[ ... ]` groups are optional.

| Rule                  | Behaviour                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Slots                 | `<Slot>` in a child is replaced by the text the scenario line gave the header slot                                           |
| Omitted optional slot | every child (step or `Narrate:`) that mentions the slot is dropped                                                           |
| Narration             | a `Narrate:` after the composite follows its last child; a `Narrate:` child is spoken in place                               |
| AST                   | children are ordinary steps and narration nodes; runtimes and lint see only the expansion                                    |
| Errors                | a header matching a primitive step; recursion; a failing child, reported at the scenario line and the composite's definition |

### Base specs

A specs tree root holds `specdsl.json` (`{ "dialect": "../dialects/invoicing.ts" }`, relative to that file). A `.md` file with no `## Scenario` section is a base file; one with scenarios is a feature file.

A feature file binds against the base files of the root, then of each directory down to its own (each level sorted by name), then itself, into one registry.

A project directory may hold its own `specdsl.json` with `{ "uses": ["../pipeline", "../invoicing"] }` (paths relative to that file; no `dialect`). At each directory, the base files of the used projects (each with its own cascade and `uses`, included once) precede the directory's own.

`specdsl bind-all <root>` lints every base file and feature file in the tree together, so coverage and referenced checks are tree-wide, then writes `<feature>.ast.json` beside each feature file. `bind` and `lint` on a file inside a tree default `--base` to the cascade and `--dialect` to the config.

Merging is add-only: redeclaring an entity, actor, or surface is an error naming both locations; Transition and Policies lines extend earlier declarations; scenario names are unique across files.

## Lint checks

| Check      | Rule                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| coverage   | every entry in `declared` is used by at least one `usedBy` emission                        |
| sequence   | within a scenario, consecutive `observed` emissions follow a declared `machine` transition |
| referenced | every entry in `declared` is referenced by some step                                       |

### Derived

A `## Derived` section in a base file declares named predicates and counts over them. Three closed shapes:

| Shape                                         | Example                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `<Entity> is <Predicate> when <Condition>`    | `Task is overdue when status is open and due date is before today` |
| `<Name> counts <Entity> that are <Predicate>` | `Overdue tasks counts Task that are overdue`                       |

A condition is comparisons joined by `and` / `or` (no parentheses; `and` binds tighter). A comparison is `<Field> is <Value>`, `<Field> is not <Value>`, `<Field> is before <Value>` or `<Field> is after <Value>`. Enum fields compare against their states or `one of` values; `before` and `after` apply to date fields, whose value is `today` or `YYYY-MM-DD`. Fields and values that the model does not declare are bind errors with the line.

A scenario step `<Ref> is <Predicate>` or `<Ref> is not <Predicate>` asserts a predicate on a record. It runs in domain mode only. The invariant shapes `Entity.field = left * right` and `= sum of Target.field` remain in `## Invariants`.

`SpecDSL.Derived.holds?(predicate, record, today)` evaluates a predicate over a map of field atoms to values; the conformance test holds the app's counts to it.

## AST JSON

```json
{
  "dialect": { "name": "invoicing", "version": "1", "stepIds": ["opens", "enters", "sees"] },
  "contexts": { "clock": { "DateTime": "2026-01-15T09:00:00Z" } },
  "actors": { "Accounts": { "Role": "accountant", "extra": {} } },
  "surfaces": {
    "Sidebar": {
      "shared": true,
      "controls": {
        "Companies": {
          "kind": "link",
          "locators": { "css": "#nav-companies", "lv": "#nav-companies" }
        }
      }
    },
    "Invoice editor": {
      "route": "/invoices/{id}/edit",
      "controls": {
        "Quantity": {
          "kind": "field",
          "locators": { "css": "#qty", "lv": "input[name='line[quantity]']" }
        }
      }
    }
  },
  "model": {
    "Invoice": {
      "fields": [
        { "name": "number", "type": "text", "required": true },
        { "name": "status", "type": "enum", "values": ["draft", "sent", "paid", "void"] },
        { "name": "total", "type": "money" }
      ],
      "relations": [
        { "kind": "belongs-to", "entity": "Customer", "name": "billed to" },
        { "kind": "has-many", "entity": "LineItem", "name": "line_item" }
      ],
      "machines": {
        "status": {
          "states": ["draft", "sent", "paid", "void"],
          "transitions": [
            { "from": "draft", "to": "sent" },
            { "from": "sent", "to": "paid" },
            { "from": "draft", "to": "void" }
          ]
        }
      }
    }
  },
  "policies": { "Invoice": { "accountant": ["read"], "admin": ["read", "mark paid"] } },
  "derived": {
    "predicates": [
      {
        "entity": "Invoice",
        "name": "unpaid",
        "condition": {
          "op": "or",
          "left": { "op": "is", "field": "status", "value": "draft" },
          "right": { "op": "is", "field": "status", "value": "sent" }
        },
        "file": "specs/invoicing/derived.md",
        "line": 5
      }
    ],
    "counts": [
      {
        "name": "Unpaid invoices",
        "entity": "Invoice",
        "predicate": "unpaid",
        "file": "specs/invoicing/derived.md",
        "line": 6
      }
    ]
  },
  "scenarios": [
    {
      "name": "Line total updates as quantity changes",
      "source": { "file": "specs/invoicing.md", "line": 20 },
      "steps": [
        {
          "id": "given-entity",
          "line": 21,
          "args": { "Entity": "Customer", "Ref": "Acme", "pairs": [] }
        },
        {
          "id": "opens",
          "line": 23,
          "args": { "Actor": "Accounts", "Surface": "Invoice editor", "Ref": "INV-001" }
        },
        {
          "id": "narrate",
          "line": 26,
          "text": "The line total updates as the quantity changes.",
          "modes": ["demo"]
        }
      ]
    }
  ]
}
```

The lock file `dialects/<name>.lock.json` lists step ids, slot names and types, context names and config keys. Runtimes check handler coverage against it.

## Runtimes

| Concern      | Elixir                                | Playwright                               |
| ------------ | ------------------------------------- | ---------------------------------------- |
| UI steps     | Phoenix.LiveViewTest                  | browser                                  |
| Domain steps | direct Ash action calls, Ecto sandbox | test-support Plug on the app, `:e2e` env |
| Actor        | conn per actor, logged in             | browser context per actor                |
| Demo         | none                                  | hold, highlight, TTS, timestamps, ffmpeg |

Domain semantics (factory, reload, clock, jobs) are implemented once in Elixir. The Plug exposes them over HTTP for Playwright.

Elixir usage:

```elixir
defmodule MyApp.SpecHandlers do
  use SpecDSL.Handlers, dialect: "dialects/invoicing.lock.json"
  context :actor, setup: fn decl, ctx -> ... end
  step "opens", %{actor: actor, surface: surface, ref: ref}, ctx do ... end
end

defmodule MyApp.SpecTest do
  use SpecDSL.Case, ast: "specs/*.ast.json", handlers: MyApp.SpecHandlers
end
```

One ExUnit test per scenario, tagged with spec file and line.

## Demo mode

1. Synthesise narration per step with pocket-tts, cached by text hash. Record clip durations.
2. Run the scenario with highlight on each target and a hold equal to the clip duration. Record a timestamp per step. Playwright records video.
3. Mux clips at timestamps with ffmpeg. `Caption:` and non-UI steps render as overlay cards.
4. Emit mp4 and per-step screenshots.

Narration comes from `Narrate:` and `Caption:` lines and is present tense, describing what is on screen.

## Designs

Each surface line may name its artboards: `- Deal page: design pipeline/deal-page, region "Deal name", ...`. The path is relative to the directory the root `specdsl.json` names with `"designs"`. The directory holds one `<state>.dc.html` per state; the AST surface node carries `design`.

| Tool                                 | Does                                                                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specdsl design-lint <root>`         | Warns on controls declared but absent from every artboard, `data-control` values not declared on the surface or a shared surface, a `data-surface` that differs from the surface name, and a missing directory. `bind-all` runs it too |
| `pnpm design -- --scenario "<name>"` | Playwright project `design`: runs the scenario over the static artboards with the demo recorder, writes `design-output/<slug>/design.mp4` and `report.json`                                                                            |

Step semantics in design mode:

- `opens` keeps a record store filled from `Given` lines. The surface record is the Ref, or the first Given entity with a machine state. The artboard named by that state is rendered, else `default`, else the first file, with props built from the record (see "Artboard props").
- `clicks` highlights the `data-control` element, then follows an `<a href="*.dc.html">`, or applies `data-next-state` to the record's machine field and re-renders.
- `time advances` moves the scenario clock, which starts at the Context clock.
- `sees`, `no longer sees`, `does not see` and `is on` compare against the artboard; mismatches go to `report.json` and do not fail the run.
- A mismatch outlines the control in red and captions "Design differs: expected ..., found ..." for 2 seconds in the video.
- A missing artboard or control fails the run.
- `has`, `may`, `may not`, `is` and `is not` do nothing; `Story`, `Narrate` and `Caption` behave as in demo mode.

### Artboard props

An artboard declares props in its `data-props` (each prop's `default` is sample data) and fills `{{ path }}` holes, `<sc-if>` and `<sc-for>`. The local renderer (`packages/specdsl-playwright/src/design/render.ts`) merges design-mode props over those defaults, expands the template and serves static HTML; it does not run the artboard script. Design mode builds these props from the record:

| Prop                     | Value                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `<entity>` (lower camel) | the record's fields (camelCase keys; dates `20 Jan 2026`, money `$12,000.00`) and `name` = the Ref                               |
| `<machine field>`        | current state (`stage`)                                                                                                          |
| `is<State>`              | true for the current state (`isLead`)                                                                                            |
| `<predicate>`            | the Derived predicate of the record's entity, evaluated at the scenario clock                                                    |
| `<relation plural>`      | child rows of each has-many relation (`tasks`); a row holds the fields, `name`, `is<State>` and child predicates (`row.overdue`) |
| `any<Predicate>`         | true when any child row satisfies the predicate (`anyOverdue`)                                                                   |

## Build order

1. specdsl-core. Gate: invoicing example round-trips, unknown control rejected.
2. specdsl-playwright test mode, test-support Plug, web-app handlers. Gate: invoicing scenario passes against apps/invoicing.
3. elixir/spec_dsl. Gate: same scenario passes in ExUnit.
4. Demo mode.
