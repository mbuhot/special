# UI iteration plan

Goal: a small business owner would consider running the app in place of HubSpot. Each iteration picks the single most impactful change, adjusts the specs first, then builds.

## Method

1. Review the current screens (`demo-output/*/steps/*.png` after `pnpm demo`).
2. Pick one change. Record it below with the reason.
3. Spec worker edits `specs/` (surfaces, scenarios) so the change is specified before any code. `pnpm bind` must pass.
4. Red gate: `pnpm e2e` or `mix test` fails on the new scenarios.
5. Implementation worker builds until the gate passes. Format. Commit with explicit `git add`.
6. Append to the spec-first notes.
7. Adversarial review agent judges code quality and user experience from screenshots and code. Done when it passes.

## Iterations

| #   | Change                                                                                                         | Why                                                                                                                                       | Status      |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Application shell: sidebar on every page, identity block, dashboard as linked cards; DSL gains shared surfaces | Every screen reviewed is an unstyled scaffold under a top bar; the shell is what a buyer sees first and every later screen sits inside it | in progress |

## Spec-first notes

Observations on where writing the spec first helped or hindered each iteration.

## DSL evolution queue

Interleaved with UI iterations. The specs must capture the critical behaviour and structural model so an agent can regenerate the application from them, while staying readable.

| #   | Idea                                      | Shape                                                                                                                                  |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Composite steps in use                    | `## Steps` archetypes for the pipeline transitions and the deal form; scenarios name only their variation                              |
| D2  | Slotted composites                        | Optional groups in a composite header: `fills a standard order for <Company> [with quantity <Value>]`                                  |
| D3  | Form fill with pairs                      | `<Actor> fills <Surface> with <Field> <Value>, ...` reusing the `Given ... with` pair syntax                                           |
| D4  | Field types and validations in `## Model` | `Deal.amount: money, required`, `Contact.email: email, unique`; conformance test holds Ash to it; scenarios for validation messages    |
| D5  | Navigation in `## Surfaces`               | Each surface declares how it is reached (`from Contact list via "Ada Lovelace"`); lint: every surface reachable; demo follows the path |
| D6  | Design reference per surface              | `design: <figma url or image path>` on a surface; reviewer compares the step screenshot with the frame                                 |
| D7  | Computed fields and derived lists         | `Invoice.total = sum of LineItem.total`; dashboards declared as counts over a filter                                                   |
| D8  | Notifications and jobs                    | `## Jobs` with triggers; `<Actor> receives email "<Subject>"`                                                                          |

### Iteration 1, application shell

- Helped: the sidebar had to be a surface before any code existed, which forced the question "which surface owns a control that is on every page". The answer became a DSL feature (shared surfaces) instead of a Playwright workaround.
- Helped: declaring the dashboard links in the spec fixed the control names before the design and the implementation workers started; both used the same names without coordination.
- Hindered: the spec change needed a DSL change first, so the red gate could not run until core landed; implementation was dispatched on the spec text alone and the red/green sequence was reconstructed afterwards.
- Hindered: `clicks` accepted only buttons, so sidebar links needed kind alternatives in the pattern language (`<Control:button|link>`). A vocabulary gap surfaces as a bind error, which is cheap to find and costs a core change to fix.
- Design: artboards carry `data-control` names matching the spec; a lint that checks them is not written yet (D6).

### Invariants and architecture (queued)

| #   | Idea                          | Shape                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D9  | `## Invariants` section       | Closed shapes: `<Entity>.<Field> = sum of <Rel>.<Field>`, `<Entity>.<Field> = <Field> * <Field>`, `<Entity>.<Field> is unique`, `is required`, `<Entity> is <Predicate> when <condition>`, `<Entity>.<Field> only changes through <Action>, ...`. ExUnit runtime generates a StreamData property per line, using the factory as the generator |
| D10 | Machine properties            | From the existing `Transition` emissions: a stateful property runs random action sequences and asserts every observed change is a declared edge and every undeclared one errors                                                                                                                                                               |
| D11 | Policy properties             | From `## Policies`: sample roles × states × records and assert `Ash.can?` equals the matrix (today one record per role)                                                                                                                                                                                                                       |
| D12 | `## Domains` for architecture | `Billing: Invoice, LineItem`, `Billing uses CRM`; conformance holds Ash domains and `mix xref` boundaries to it                                                                                                                                                                                                                               |

- Caught: the implementation worker built "Recent activity" from the artboard and added an Ash read action for it; the policy conformance test failed because the spec names no such action. The design ran ahead of the spec. Fix: declare the region and a scenario in the spec, and query through the primary read action.

### Architecture queue

| #   | Item         | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | ash_boundary | Add the `ash_boundary` dep to apps/invoicing; every domain exposes code interfaces only; `Ash.Query` / `Ash.Changeset` / `Ash.read` etc. are forbidden in `InvoicingWeb` (today: 2 call sites in deal*live/board.ex and company_live/show.ex, plus 13 `Ash.can?` calls to replace with generated `can*<action>?` interface functions). Compile fails on a leak. Pairs with D12 (`## Domains`), which the conformance test can then hold against the boundary config |

### Iteration 1 review

docs/reviews/2026-10-10-iteration-1.md: FAIL. Blocking: invoice editor, contact/deal/company record pages, login; invoice line editing, new-invoice company, racy numbering, email-only auth.

| 2 | Record pages for contact, company and deal: properties panel with every model field, associations as links, stage and status controls, timeline with author and formatted dates; DSL gains typed fields, enums and named relations (D4) | Reviewer's top recommendation; closes UX 2, 3, 4, 6 and spec 2, 3, 7 | in progress |
| 3 | Invoice editor: customer selection, dates, per-line totals, read-only outside draft, persisted-or-error edits, safe numbering; DSL gains invariants (D9) | Blocking UX 1 and code 1, 2, 3 | queued |
| 4 | Authentication: password login, logout, no stock landing page | Blocking UX 5 and code 4 | queued |

### Iteration 2, record pages

- Helped: the `referenced` lint refused a declared "Qualify" button on the Deal page with no scenario clicking it, so the spec worker wrote the Qualify and Lose scenarios before any code existed. Declared controls cannot be dead.
- Hindered: a Company-page scenario that mentions a Deal cannot live in specs/crm (the project does not see Deal); it moved to the pipeline project. Project boundaries in the specs tree shape where a cross-cutting scenario lives.
- Caught: the ash_boundary worker's first attempt added a `for_company` read action; the policy conformance test rejected it as unspecified, so the query became a plain domain function over the primary read.
- Caught: making every module async exposed sandbox deadlocks on natural keys; the fix is key ordering (users first) in the spec runtime, which the spec's `Given` order already follows for everything else.
