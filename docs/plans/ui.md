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

| #   | Change | Why | Status |
| --- | ------ | --- | ------ |

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
