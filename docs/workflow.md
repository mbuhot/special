# Design to implementation workflow

One loop, five stops. The canvas is where design is discussed; the repository is what everything checks.

```
claude.ai canvas  ──/design-sync──►  designs/  ──►  specs/  ──►  tests  ──►  implementation
  ▲   comments                        design-lint    bind       e2e, mix test
  └── designer and product ◄──────────── design walkthrough video (pnpm design)
```

| Stop           | Who                         | What happens                                                                                                                                                                          | Command                                   |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1. Design      | Designer and product        | Edit artboards on the canvas, one per surface state. Leave comments on elements; a comment sent to Claude asks for a change, and Claude edits the artboard and replies in the thread. | canvas comments                           |
| 2. Sync        | Claude                      | Pull every artboard into `designs/<project>/<surface-slug>/<state>.dc.html`.                                                                                                          | `/design-sync`                            |
| 3. Specs       | Claude, reviewed by product | Make the specs agree with the designs: new controls declared on surfaces and given scenarios, removals confirmed with the user.                                                       | `pnpm bind` until no design-lint warnings |
| 4. Walkthrough | Claude                      | Play every scenario over the static artboards; narrated video for review, report of text mismatches.                                                                                  | `pnpm design`                             |
| 5. Gaps        | Claude                      | Run the scenarios against the app. Failures are the implementation work the design implies.                                                                                           | `pnpm e2e`, `mix test`                    |
| 6. Build       | Claude                      | Implement until the failing scenarios pass, then re-record the app demo.                                                                                                              | `pnpm demo`                               |

## Conventions that make the loop work

- Every element a spec can name carries `data-control="<Name>"`; the artboard root area carries `data-surface="<Surface>"`. Names match the spec exactly.
- One artboard per state of a surface, named after the state in the model (`pipeline/deal-page/qualified.dc.html`). A button that moves to another state carries `data-next-state="<state>"`; a link to another surface is an `<a href>` to that artboard.
- The canvas board paths mirror `designs/` (`project/pipeline/deal-page/qualified.dc.html`), so sync is a copy.
- The canvas URL lives in `designs/canvas.json`.

## What each check proves

| Check                        | Fails when                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| design-lint (in `pnpm bind`) | an artboard and its surface disagree on control names                                                                             |
| `pnpm design`                | a scenario opens a surface with no artboard or uses a control the artboard lacks; text disagreements are reported without failing |
| `pnpm e2e`, `mix test`       | the running app does not do what the scenario says                                                                                |
