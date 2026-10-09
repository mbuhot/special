# CRM build plan

Grow apps/invoicing into a HubSpot-style CRM, spec first.

## Method, per feature, in this order

1. Spec worker: base lines (Model, Surfaces, Actors, Policies) at the right level of the specs tree, scenarios in a feature file, Narrate lines in present tense describing what is on screen. Surfaces and controls go into the dialect (split `dialects/*.ts` by screen area) with css and lv locators. `pnpm bind` binds clean with zero lint warnings. The spec worker never touches apps/.
2. Red gate, once: `cd apps/invoicing && mix test test/spec` fails only on the new scenarios and on conformance for the new model or policy lines. If nothing fails the spec added nothing testable; fix the spec.
3. Implementation worker: Ash resources, policies, LiveViews and handlers until that gate passes, then `pnpm e2e`, then `DEMO_SCENARIO=<one new scenario> pnpm demo`. It never edits specs/ or dialect patterns; it may add locators to surfaces the spec declared.
4. Format, commit one logical unit per feature with explicit `git add <files>`, update the memory file (status, gates, queue), dispatch the next feature in the same turn.

## Specs tree target

```
specs/specdsl.json
specs/company.md, specs/contact.md, specs/user.md   shared entities and their policies
specs/crm/        companies, contacts, activities
specs/pipeline/   deals, stages, tasks
specs/invoicing/  existing; invoices belong to Company
```

Shared entities live at the root. A project redeclaring one is a bind error.

## Feature queue, in priority order

1. Rename Customer to Company across spec, dialect, app and factory. specs/company.md: name, domain, industry; Has many Contact, Has many Invoice, Has many Deal. Invoices belong to Company. Existing scenarios stay green.
2. Contacts. specs/contact.md: first name, last name, email, phone; Belongs to Company. crm/contacts.md: list, create, edit, search by name, filter by company. Surfaces: Contact list, Contact editor.
3. Companies. crm/companies.md: list, create, edit, company page showing its contacts and invoices.
4. Deals. pipeline/deals.md. Deal: name, amount, close date, stage; Belongs to Company, Belongs to Contact, Belongs to User (owner). Deal.stage: lead -> qualified -> proposal -> won, lead -> lost, qualified -> lost, proposal -> lost. Surfaces: Pipeline board (a column per stage, a card per deal, a "Move to <stage>" control per card), Deal editor. Scenarios cover every declared transition.
5. Activities. crm/activities.md. Activity: kind (note | call | email | meeting), body, occurred at; Belongs to Contact, Belongs to User. Timeline region on the Contact page, newest first. Uses the Clock context for "occurred at".
6. Tasks. pipeline/tasks.md. Task: title, due date, status (open -> done); Belongs to Deal, Belongs to User (assignee). Overdue tasks highlighted on the deal page; a `time advances` scenario makes a task overdue.
7. Roles and policies. Actors: Sales rep (role sales), Sales manager (role manager), Accounts (role accountant), Admin (role admin). Sales reps read everything, create and update their own deals, contacts and activities; managers also move deals to won or lost and reassign deals; accountants own invoicing; admins everything. Every policy line is exercised by a `may` or `may not` scenario per role per sensitive action; policy conformance stays green.
8. Dashboard. Home surface after login: counts of open deals per stage, overdue tasks, unpaid invoices, each a region with a scenario asserting the number after the Givens.
9. Mark paid creates an Activity of kind note on the company's primary contact ("Invoice INV-001 paid"), spec'd as a cross-project scenario in specs/invoicing/settling.md.
10. Demo: `pnpm demo` over the whole tree; README lists each scenario with a one-line description of its video.

## Rules

- Orchestrate only: plan, dispatch Sonnet workers at high effort, review the diff, run final gates, commit. One file boundary and one gate run per worker; "do the work yourself; do NOT spawn subagents". Never search outside the repo; Ash and Phoenix docs are in apps/invoicing/deps.
- Test names describe behaviour from the user's perspective. No inline comments. Types over boolean flags. Formatters before every commit.
- Gates: `pnpm --filter @special/specdsl-core test` only when core changed; `pnpm bind`; `cd apps/invoicing && mix test`; `pnpm e2e`; filtered `pnpm demo` per feature; full `pnpm demo` only for item 10. Redirect runner output to the scratchpad and read the file.
- Commit per feature with explicit `git add <files>`. Never commit `*.ast.json`, `*.lock.json`, demo-output or test-results.
- Core changes only when a spec cannot be expressed; separate dispatch with core tests; record new vocabulary in docs/design.md.
- If asdf shims complain: ASDF_PNPM_VERSION=11.9.0 ASDF_ELIXIR_VERSION=1.20.2.
