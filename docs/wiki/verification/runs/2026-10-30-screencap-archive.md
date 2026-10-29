---
title: Screencap archive verification
section: Verification
updated: 2026-10-30
result: Passed
---
# Screencap archive verification

## Scope and build

Verify the [accepted screencap deprecation](../../decisions/fungi-workflows.md#screencap-archive-2026-10-30): preserve all dedicated screencap resources under `archive/screencap/`, remove them from active discovery and execution paths, and retain working relative paths in the archive. The existing [Fungi workflows](../../features/fungi-workflows.md) remain active.

Tested jstack base `ff6ac0bd2abfd6255b01e196aa8bc783f15efe26` with the uncommitted Fungi migration and this archival change, on macOS 27.0 arm64 with Node `v22.19.0`. The [manifest](../../evidence/2026-10-30-screencap-archive/manifest.json) records pre-move and archived hashes, file modes, and the final source fingerprint.

## Results

| Scenario | Expected and observed outcome | Result | Evidence |
| --- | --- | --- | --- |
| Preserve screencap resources | All 18 original files retained at archived paths, with permissions preserved. Only the skill deprecation text and two relocated reference documents changed; executable, app signature files, source, scripts, tests, fixture helper, and mockups are byte-identical | Passed | [Move manifest](../../evidence/2026-10-30-screencap-archive/manifest.json) |
| Active collection | Manifest still discovers `./skills/`, containing 16 skills. Active skill/reference/test files have no screencap, capture-feedback, or old completion-helper dependencies | Passed | [Isolation checks](../../evidence/2026-10-30-screencap-archive/manifest.json) |
| Active regression suite | `node --test scripts/*.test.mjs`: 35 passed, no skips or failures | Passed | [Active log](../../evidence/2026-10-30-screencap-archive/active-tests.log) |
| Archived regression suite | `node --test archive/screencap/scripts/*.test.mjs`: 19 passed, including app architecture/signature, note layout, collection, and completion behavior | Passed | [Archive log](../../evidence/2026-10-30-screencap-archive/archive-tests.log) |
| Archive paths and metadata | 70 local Markdown links and 16 relative test/helper imports resolved. All 16 active skills, the archived skill, and plugin manifest passed validation | Passed | [Manifest](../../evidence/2026-10-30-screencap-archive/manifest.json), [validators](../../evidence/2026-10-30-screencap-archive/validation.json) |

## Limits

No live screen capture or real host callback was exercised; archived tests use disposable local sessions and stub notifications. Fungi runtime behavior was unchanged; one extra trailing blank line in `comments.mjs` was removed before commit and all 35 active tests passed again. Its native workflow checks were not repeated. Existing user sessions and installed plugin caches were not part of this repository move. Historical mixed-feature records remain where they were originally recorded.
