# special

A Markdown spec language with one closed vocabulary and three uses:

| Use                              | Where                                                |
| -------------------------------- | ---------------------------------------------------- |
| Planning and acceptance criteria | Spec in a Linear ticket                              |
| Executable tests                 | Playwright (browser) and ExUnit (in-process Phoenix) |
| Narrated demo video              | Playwright demo mode, pocket-tts, ffmpeg             |

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
packages/specdsl-linear/      ticket sync: lint on save, attach video on completion
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

- Customer: name, email
- Invoice: number, status, total. Belongs to Customer. Has many LineItem.
- Invoice.status: draft -> sent -> paid, draft -> void
- LineItem: description, quantity, unit price

## Surfaces

- Invoice list: table "Invoices", button "New invoice"
- Invoice editor: field "Quantity", field "Unit price", region "Totals", button "Send"

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

Given a Customer "Acme"
Given an Invoice "INV-001" with status draft, customer Acme
When Accounts opens Invoice editor for INV-001
And Accounts enters 3 into "Quantity"
Then Accounts sees "300.00" in "Totals"
Then Accounts may not mark paid INV-001
Narrate: The line total updates as the quantity changes.
```

`Given`, `When`, `Then`, `And` are ignored prefixes. Step shape is determined by the pattern match.

## Pattern mini-language

Used for section items and steps.

| Syntax         | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| `word`         | literal token, case-insensitive                        |
| `<Slot>`       | slot bound to namespace `Slot`                         |
| `<Slot:kind>`  | slot bound to namespace `Slot`, entry must have `kind` |
| `<Slot.kind>`  | slot that captures the kind enum of namespace `Slot`   |
| `"<Slot>"`     | slot whose source text is double-quoted                |
| `[ ... ]`      | optional group                                         |
| `<A> <B>, ...` | preceding element repeats, comma separated             |
| `<on\|off>`    | inline enum                                            |

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
  steps:      [ step(pattern, { uses, declares, emits, narrate, modes }) ],
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

### Base specs

A specs tree root holds `specdsl.json` (`{ "dialect": "../dialects/invoicing.ts" }`, relative to that file). A `.md` file with no `## Scenario` section is a base file; one with scenarios is a feature file.

A feature file binds against the base files of the root, then of each directory down to its own (each level sorted by name), then itself, into one registry.

`specdsl bind-all <root>` lints every base file and feature file in the tree together, so coverage and referenced checks are tree-wide, then writes `<feature>.ast.json` beside each feature file. `bind` and `lint` on a file inside a tree default `--base` to the cascade and `--dialect` to the config.

Merging is add-only: redeclaring an entity, actor, or surface is an error naming both locations; Transition and Policies lines extend earlier declarations; scenario names are unique across files.

## Lint checks

| Check      | Rule                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| coverage   | every entry in `declared` is used by at least one `usedBy` emission                        |
| sequence   | within a scenario, consecutive `observed` emissions follow a declared `machine` transition |
| referenced | every entry in `declared` is referenced by some step                                       |

## AST JSON

```json
{
  "dialect": { "name": "invoicing", "version": "1", "stepIds": ["opens", "enters", "sees"] },
  "contexts": { "clock": { "DateTime": "2026-01-15T09:00:00Z" } },
  "actors": { "Accounts": { "Role": "accountant", "extra": {} } },
  "surfaces": {
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
      "fields": ["number", "status", "total"],
      "relations": [
        { "kind": "belongs-to", "entity": "Customer" },
        { "kind": "has-many", "entity": "LineItem" }
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
          "args": { "Actor": "Accounts", "Surface": "Invoice editor", "Ref": "INV-001" },
          "narrate": "Accounts opens the Invoice editor."
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

Narration defaults to the step's `narrate` template. `Narrate:` lines override. Narration is present tense and describes what is on screen.

## Build order

1. specdsl-core. Gate: invoicing example round-trips, unknown control rejected.
2. specdsl-playwright test mode, test-support Plug, web-app handlers. Gate: invoicing scenario passes against apps/invoicing.
3. elixir/spec_dsl. Gate: same scenario passes in ExUnit.
4. Demo mode.
5. Linear sync.
