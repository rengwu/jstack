---
title: Grill-form multiple selection verification
section: Verification
updated: 2026-10-30
result: Passed
---
# Grill-form multiple selection verification

## Scope

Verified `FEAT-fungi-workflows` after implementing the [accepted multiple-selection and content-limit change](../../discussions/2026-10-30-grill-form-multiple-selection.md). The selected scope covers checkbox/radio behavior, result arrays, compatible v1 drafts, partial and required feedback, larger content, actual runtime-budget checks, native cancellation/reopening, and shared Notes, comments, previews, and themes. See the [feature contract](../../features/fungi-workflows.md) and [executable setup](../setup.md).

## Build and environment

The tested working tree is based on `b94c1ac` with uncommitted implementation changes and plugin manifest `0.4.0`. The [manifest](../../evidence/2026-10-30-grill-form-multiple-selection/manifest.json) records the full revision, SHA-256 hashes of skill resources and test drivers, macOS/Node/Chromium versions, and the tested Fungi binary hash. Node is `v22.19.0`; Fungi is `v0.1.0-alpha.2`, protocol 1.

Native fixtures used unique temporary `FUNGI_STATE_DIR` directories, cleared the real conversation callback target, and drove prepared page controls through the public bridge. Native checks ran sequentially. Browser checks used the already installed Puppeteer module recorded in the manifest, isolated Chromium pages, local fixture servers, blocked external requests, and a public Fungi API test double. Bundles and native session directories remain retained at the paths in their evidence; the copied PNG artifacts below remain available independently.

## Results

| Scenario | Expected outcome | Observed outcome | Result | Evidence |
| --- | --- | --- | --- | --- |
| Repository tests | Existing reader/report/UI checks and new choice/transport regressions pass | All 39 tests passed, including ordered multi-select arrays, clear/untouched semantics, invalid modes and IDs, explanatory “Something else”, v1 migration, larger fields/comments/images, and runtime byte limits | Passed | [Test output](../../evidence/2026-10-30-grill-form-multiple-selection/tests.log) |
| Native grill-form persistence | Mixed question types and larger content save, reopen, and submit without lost selections | 12 questions and 15 checkbox options; radio behavior preserved; three selections including “Something else” restored; 21 comments, notes and final state beyond 12,000 characters, comment-time state, one PNG, and untouched questions preserved | Passed | [Native result](../../evidence/2026-10-30-grill-form-multiple-selection/grill-native.json), [PNG](../../evidence/2026-10-30-grill-form-multiple-selection/grill-native-0.png) |
| Browser interactions and v1 recovery | Labels, keyboard, visual previews and clear behave correctly; older drafts restore to controls | Independent checkbox toggles, single-radio selection, additive “Something else”, v2 draft restoration, and v1 scalar-to-array recovery passed | Passed | [Browser checks](../../evidence/2026-10-30-grill-form-multiple-selection/grill-browser.json) |
| Larger editable feedback and payload failure | Content above old caps remains editable; actual byte limits fail without losing input | 13,000-character notes and 25 pasted PNGs submitted; a smaller advertised JSON budget rejected saving while preserving the full editor text and previous acknowledged draft; reducing the text allowed save and submission | Passed | [Browser checks](../../evidence/2026-10-30-grill-form-multiple-selection/grill-browser.json) |
| Desktop and narrow layout | Checkbox rows and visual cards remain usable without horizontal overflow | Desktop and 420 px screenshots inspected; selected states are visible and controls fit the viewport | Passed | [Desktop](../../evidence/2026-10-30-grill-form-multiple-selection/multiple-desktop.png), [Narrow](../../evidence/2026-10-30-grill-form-multiple-selection/multiple-narrow.png) |
| Shared result window | Notes/images and selected next steps retain existing behavior | Native close/reopen/submit, image preservation, selection-only feedback, and malformed-input errors passed | Passed | [Outcome native](../../evidence/2026-10-30-grill-form-multiple-selection/outcome-native.json), [PNG](../../evidence/2026-10-30-grill-form-multiple-selection/outcome-native-0.png) |
| Shared components | Notes editing and preview/comment behavior remain intact | Gallery image paste/preview/delete/undo, keyboard region comments, independent captured/final state, narrow layout, and duplicate-submit protection passed | Passed | [Gallery](../../evidence/2026-10-30-grill-form-multiple-selection/gallery.json) |
| Themes | All themes load, remain readable, and fit narrow layouts | Nine Chromium gallery/workflow combinations passed contrast, fonts and layout checks; all three native theme loads passed | Passed | [Browser themes](../../evidence/2026-10-30-grill-form-multiple-selection/themes.json), [Native themes](../../evidence/2026-10-30-grill-form-multiple-selection/native-themes.json) |
| Skill/plugin packaging | Active skills and manifest validate | All 16 skill frontmatter checks and the plugin validator passed | Passed | [Validation](../../evidence/2026-10-30-grill-form-multiple-selection/validation.json) |

## Limits and follow-up

The checks establish the selected scenarios on this macOS build. They do not establish every Fungi platform, physical OS clipboard gestures, arbitrary-size performance, or live callbacks into every agent host. The v1 conversion and payload-recovery browser checks use the public bridge test double; actual native persistence is covered separately. The existing diagram renderer still uses rendering bounds with source fallback. Show-outcome's report-input limits are outside this change; its shared Notes/image feedback now uses runtime budgets.

During driver development, the first browser attempt read checkbox state before the iframe's asynchronous selection message arrived, and the next used a keyboard helper unavailable in the installed Puppeteer version. The driver now waits for the observable state and uses the installed keyboard API; the final full run passed. An existing unit assertion for the intentionally removed 12,000-character Notes cap was updated to require acceptance. These were test adaptations, not unresolved product regressions.

The source changes are local and uncommitted. Installed plugin caches and previously generated forms were not rewritten; new form bundles must use the updated plugin source. Historical sessions and evidence remain preserved.
