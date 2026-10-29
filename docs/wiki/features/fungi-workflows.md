---
title: Fungi workflows
section: Features
updated: 2026-10-30
---
# Fungi workflows

**ID:** `FEAT-fungi-workflows`

## Intent and basis

Jstack supplies the user's daily-use Fungi skills as a self-contained collection. The [accepted migration decision](../decisions/fungi-workflows.md) replaces the old browser-based grill-form and imports `fungi`, `fungi-ui`, `grill-form`, and `show-outcome` together. Other source checkouts are unnecessary at runtime.

## Entry points and prerequisites

- Invoke `grill-form` directly or through `work-until-grill` / `grill-form-adhd` for decision interviews and visual reviews.
- Invoke `show-outcome` to enable rich result windows with optional feedback and selectable next steps.
- Use `fungi-ui` when authoring or changing a Fungi interface; `node skills/fungi-ui/scripts/gallery.mjs` assembles its component gallery.
- Node.js 22+ runs the prepared assemblers. Installed Fungi must respond to `fungi version` on PATH. Keep `fungi`, `fungi-ui`, and the desired workflow installed as siblings. Optional interview interpretation uses `grill-me` and `plan`.

## Expected outcomes

Each workflow takes a JSON file and returns a retained bundle with entry HTML, an input snapshot, and local dependencies. It opens in a native Fungi window. Session completion follows the shared Fungi skill's supported host route and exact receipt, without polling or a browser-download collector.

Grill-form returns `grill-form/v2` with `selection`, `choiceIds` and matching `choices` arrays in option order, notes, untouched status, final prototype states, comment-time states, and artifact references. `selection: "multiple"` renders checkboxes; omitted or `"single"` renders radios. Labels, cards, previews, and keyboard actions toggle checkboxes once. “Something else” can accompany other selections and requires notes or a comment. Clear removes all choices. Unanswered items remain unresolved; no choices are preselected. `required` requires feedback, which can be notes or comments. Compatible v1 drafts restore scalar choices as arrays, and the skill still interprets retained v1 results. Unknown formats, selection modes, duplicate IDs, or unavailable choices fail explicitly.

The [accepted multiple-selection change](../discussions/2026-10-30-grill-form-multiple-selection.md) removes arbitrary question/option counts and field-length, comment-count and image-count limits. Fungi's advertised JSON and artifact byte budgets apply. Rejected saves preserve the editor and the last acknowledged draft; the user can edit and retry. Preview state and region captures are not silently truncated. Diagram rendering retains its renderer bounds and falls back to source without rejecting or truncating questionnaire content.

Show-outcome returns `outcome/v1` with optional Notes and explicitly selected next steps; reading or closing the report does not acknowledge or accept it. Its shared Notes and image feedback use the same runtime budgets. Its existing report-input schema is unchanged. Each workflow can assemble and run without the other workflow installed.

Drafts and pasted image references survive cancellation and reopening. Retained bundles, inputs, and result artifacts remain available. The UI kit includes its fonts, renderers, licenses, and three themes: `classic`, `paper`, and `paper-dark`. Theme selection follows the template and the user's settings, without an agent choosing on routine invocations.

## Verification recipes

Follow [verification setup](../verification/setup.md) for isolation, executable paths, and evidence handling.

1. Run `node --test scripts/*.test.mjs`. Expect schema, artifact/draft, assembly/theme, reader, and report checks to pass on the selected platform. Deprecated screencap checks are archived separately.
2. Copy the imported skills and three workflow test files to a fresh root; run the same workflow tests there. Assemble each workflow in an installation containing only itself, `fungi`, and `fungi-ui`. Expect retained local assets and matching input snapshots.
3. Run `scripts/native-smoke.mjs` against grill-form. The driver isolates its native state and retained bundle. Expect 12 questions, 15 checkbox options, 21 comments, long notes/state, single-choice controls, cancel → reopen → submitted with all selections and PNG notes retained, distinct captured/final preview state, and an untouched item.
4. Run `scripts/show-outcome-native-smoke.mjs` against the isolated report installation. Expect notes/image recovery, next-step-only submission, and explicit invalid-input errors.
5. Run `scripts/grill-form-browser-smoke.mjs` with an installed Puppeteer module and Chromium path. Expect keyboard/label/preview toggles, clear, multi-selection restoration, v1 recovery, 25 pasted images, and payload-budget error/recovery with the previous draft intact. Inspect its desktop and 420 px screenshots. Its public Fungi bridge is a test double; the preceding native recipe establishes actual runtime persistence.
6. For visual or component changes, run the gallery and theme browser/native recipes and inspect screenshots. They are not required solely to move byte-identical assets.

## Coverage and limits

Native fixtures exercise actual page controls and the public bridge using synthetic input and isolated state. They do not prove physical OS clipboard gestures, human interview judgment, or a live callback into every host. Plugin installation/reloading is separate from source packaging. Unsupported Fungi platforms and unavailable host-delivery routes remain subject to the shared runtime skill's recovery instructions.

## Verification history

- [2026-10-30 multiple selection](../verification/runs/2026-10-30-grill-form-multiple-selection.md) — checkbox interaction, v1 compatibility, content-cap removal, native persistence, and shared UI regressions.

- [2026-10-30 archive isolation](../verification/runs/2026-10-30-screencap-archive.md) — active checks after removing the deprecated screencap dependency; Fungi UI assets unchanged.
- [2026-10-29 import](../verification/runs/2026-10-29-fungi-import.md) — imported build, portable assemblies, native feedback recovery, and jstack regressions.
