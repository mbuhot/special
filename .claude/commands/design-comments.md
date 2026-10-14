---
description: Answer open design comments on the canvas by editing artboards or the design system, then reply and resolve
argument-hint: "[canvas url]"
---

Work through the canvas's open comment threads that were sent to Claude. Each gets a design edit and a reply within minutes; nothing here touches the repo, specs or tests.

Canvas: the URL in $ARGUMENTS if given, else every URL in `designs/canvas.json`. Design system: the `artifact` of each record in the canvas's `project/canvas.json` `designSystems`.

1. Read the canvas's comment threads (ArtifactComments `read`). Keep the open threads activated for Claude. Report open threads not sent to Claude and leave them alone.
2. For each thread, read the anchored artboard from the canvas (Artifact `read` with its `path`) and decide the reach of the change:
   - one screen (layout, copy, a control added or removed, a state shown): edit that artboard;
   - every screen (a colour, spacing, type, control size, how a shared component looks): edit the design system artifact's `project/tokens.json` or `project/components/bundle.css` (read them first), publish it, then reinstall it on the canvas: copy its `project/tokens.json`, `project/tokens.css`, `project/components/bundle.css` and `project/README.md` into the canvas's `project/ds/<folder>/`, and set the record's `version` in `project/canvas.json` to the system's new version, in one canvas publish. Artboards link the copy by path and need no edit.
   - a question: answer it in the thread and change nothing until the commenter replies.
3. Artboard rules: artboards show states, never logic (`renderVals` passes props through; conditions only through `sc-if` on flags); every element a spec names keeps its `data-control`; reusable styling is a design-system class, inline styles are for one-off layout. Never edit the installed copy under `project/ds/`.
4. Publish each change as soon as it is made (re-read a file right before editing it if the canvas changed since you read it), reply in the thread with what changed in plain words, and resolve the thread. Leave it open only while a question is unanswered.
5. When a change implies a spec change (a new control, a removed control, a new field), say so in the reply; the next `/design-sync` proposes it.
6. Report: threads answered and how (artboard, design system, question), threads left open and why.
