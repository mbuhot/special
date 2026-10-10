---
description: Pull the design canvas into designs/, propose the spec changes it implies, and after approval report implementation gaps
argument-hint: "[canvas url] [approved]"
---

Sync the claude.ai design canvas into the repository. The sync runs in two passes, because scenarios carry product intent and product approves them.

Canvas: the URL in $ARGUMENTS if given, else every URL in `designs/canvas.json`. If $ARGUMENTS contains `approved`, skip to pass 2.

Design comments are not part of this command. A comment on the canvas is answered by editing the artboard on the canvas and replying in the thread; the sync only reads what the designs now say.

## Pass 1: pull and propose

1. Pull. For each canvas, read `project/canvas.json`, then every `project/<project>/<surface-slug>/<state>.dc.html` it lists, and write each byte for byte to `designs/<project>/<surface-slug>/<state>.dc.html`. Never format these files. Report boards whose path is not three segments under `project/`. List local artboards the canvas no longer has; delete them only after the user confirms.
2. Show the design change: `git diff --stat designs/`, and per artboard the `data-control` names added and removed (`git diff -U0 designs/ | grep data-control`).
3. Apply the mechanical spec changes, which need no approval:
   - a control added to an artboard: declare it on the surface line in `specs/<project>/surfaces.md` and add its locator to the surface map in `dialects/<project>.ts`;
   - a control renamed (same element, new name): rename it on the surface, in the surface map and in every scenario that uses it;
   - a new design directory: add the `design` clause to its surface.
4. Draft the intent changes, without writing them to `specs/`:
   - a new scenario for each new control or interaction (Story line, steps, Narrate lines in the voice-over style);
   - each existing scenario whose steps no longer match the design (for example a button replaced by a select), with the rewritten steps;
   - each control on a surface that no artboard has any more: whether to drop it from the spec or restore it in the design. Do not guess.
   - model, policy, derived or invariant changes the design implies (a new field shown, a new action offered).
   Write the drafts to `docs/proposals/design-sync-<date>.md`, one section per change, each with the file it would change and the exact text.
5. Run `pnpm bind` and fix only mechanical errors. Commit the designs and the mechanical spec changes in two commits with explicit `git add`; commit the proposal file.
6. Report and stop: artboards changed; mechanical changes applied; the proposal file with a one-line summary of each proposed change. Ask the user to review the proposal and run `/design-sync approved` (or edit the proposal first).

## Pass 2: apply the approved proposal

1. Apply every change in the newest `docs/proposals/design-sync-*.md` that the user has not struck out, then `pnpm bind` until it reports no errors and no design-lint warnings.
2. Walk the designs: `pnpm design`. Every scenario must pass. List each mismatch from the "Design mismatches" summary, grouped by scenario, saying whether the artboard or the scenario looks wrong. Do not fix them here.
3. Find implementation gaps: `pnpm test:app` and `pnpm e2e`. List failing scenarios with their first failing step: that list is the implementation work.
4. Commit the spec changes with explicit `git add`. Never commit `*.ast.json`, `*.lock.json`, `design-output/` or `test-results/`.
5. Report: spec changes applied, design run result with the mismatch list (a sync with mismatches is not clean; say so first), failing scenarios. Stop; implementing the gaps is a separate request.
