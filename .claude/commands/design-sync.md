---
description: Pull the design canvas into designs/, reconcile the specs with it, and report implementation gaps
argument-hint: "[canvas url]"
---

Sync the claude.ai design canvas into the repository and carry the change through specs and tests.

Canvas: $ARGUMENTS if given, else every URL in `designs/canvas.json` (`{"canvases": ["https://claude.ai/artifact/..."]}`).

1. Read comments first. For each canvas, read its comment threads with the ArtifactComments tool. List open threads addressed to Claude with their anchor (artboard and element). Do not act on them in this command; they are inputs to step 4.
2. Pull. For each canvas, read `project/canvas.json`, then every `project/<project>/<surface-slug>/<state>.dc.html` it lists. Write each to `designs/<project>/<surface-slug>/<state>.dc.html`. A canvas board whose path is not three segments under `project/` is reported and skipped. Delete local artboards that the canvas no longer lists only after listing them and confirming with the user.
3. Show the design change: `git diff --stat designs/` and, per changed artboard, the `data-control` names added and removed (`git diff -U0 designs/ | grep data-control`).
4. Lint: `pnpm bind`. Each design-lint warning is one of:
   - control in an artboard but not on its surface: a design addition. Add the control to the surface line in `specs/<project>/surfaces.md` and its locator to the project surface map in `dialects/<project>.ts`, and write or extend a scenario that uses it (Story and Narrate lines, voice-over style). Bind's referenced check fails until a scenario uses it.
   - control on a surface but in no artboard: a design removal or rename. Ask the user whether the spec should drop it or the design should restore it; do not guess.
   - surface without a design directory: report it.
     Re-run `pnpm bind` until it reports no errors and no design-lint warnings.
5. Walk the designs: `pnpm design`. Every scenario must pass. The run ends with a "Design mismatches" summary (also `design-output/mismatches.json`): each line is a step where the artboard and the scenario disagree on visible text or presence. List every mismatch in the final report, grouped by scenario. Do not fix them in this command: for each, say whether the artboard or the scenario looks wrong, and leave the decision to the user.
6. Find implementation gaps: `pnpm e2e` and `cd apps/invoicing && mix test`. Failing scenarios are the implementation work the design change implies. List them by scenario name with the first failing step.
7. Commit in two units with explicit `git add`: the designs, then the spec and surface-map changes. Do not commit generated files (`*.ast.json`, `*.lock.json`, `design-output/`).
8. Report: comment threads read, artboards changed, spec changes, design run result with the mismatch count and the list of mismatches, failing scenarios. A sync with mismatches is not clean; say so in the first line. Stop there; implementing the gaps is a separate request.
