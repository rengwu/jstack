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

Grill-form returns `grill-form/v1` with selected labels, notes, untouched status, final prototype states, comment-time states, and artifact references. Unanswered items remain unresolved. Show-outcome returns `outcome/v1` with optional Notes and explicitly selected next steps; reading or closing the report does not acknowledge or accept it. Each workflow can assemble and run without the other workflow installed.

Drafts and pasted image references survive cancellation and reopening. Retained bundles, inputs, and result artifacts remain available. The UI kit includes its fonts, renderers, licenses, and three themes: `classic`, `paper`, and `paper-dark`. Theme selection follows the template and the user's settings, without an agent choosing on routine invocations.

## Verification recipes

Follow [verification setup](../verification/setup.md) for isolation, executable paths, and evidence handling.

1. Run `node --test scripts/*.test.mjs`. Expect schema, artifact/draft, assembly/theme, reader, and report checks to pass on the selected platform. Deprecated screencap checks are archived separately.
2. Copy the imported skills and three workflow test files to a fresh root; run the same workflow tests there. Assemble each workflow in an installation containing only itself, `fungi`, and `fungi-ui`. Expect retained local assets and matching input snapshots.
3. Run `scripts/native-smoke.mjs` against the isolated grill-form installation. Expect cancel → reopen → submitted, preserved PNG/notes, distinct captured/final preview state, and an untouched item.
4. Run `scripts/show-outcome-native-smoke.mjs` against the isolated report installation. Expect notes/image recovery, next-step-only submission, and explicit invalid-input errors.
5. For visual or component changes, run the gallery and theme browser/native recipes and inspect screenshots. They are not required solely to move byte-identical assets.

## Coverage and limits

Native fixtures exercise actual page controls and the public bridge using synthetic input and isolated state. They do not prove physical OS clipboard gestures, human interview judgment, or a live callback into every host. Plugin installation/reloading is separate from source packaging. Unsupported Fungi platforms and unavailable host-delivery routes remain subject to the shared runtime skill's recovery instructions.

## Verification history

- [2026-10-30 archive isolation](../verification/runs/2026-10-30-screencap-archive.md) — active checks after removing the deprecated screencap dependency; Fungi UI assets unchanged.
- [2026-10-29 import](../verification/runs/2026-10-29-fungi-import.md) — imported build, portable assemblies, native feedback recovery, and jstack regressions.
