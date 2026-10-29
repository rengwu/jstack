---
title: Fungi skill import verification
section: Verification
updated: 2026-10-29
result: Passed
---
# Fungi skill import verification

## Scope and build

Verify [FEAT-fungi-workflows](../../features/fungi-workflows.md) after importing the four Fungi skills, replacing the browser-based grill-form, and separating screencap completion guidance/tests. The [accepted decision](../../decisions/fungi-workflows.md) requires a self-contained jstack bundle and preserved workflow behavior.

Tested jstack base `ff6ac0bd2abfd6255b01e196aa8bc783f15efe26` with the uncommitted migration. Imported source revision: `5e262322dddf70b02ac4ab0db9eeba5cc7315b83`. The [manifest](../../evidence/2026-10-29-fungi-import/manifest.json) fingerprints the actual skill, script, reference, manifest, and root-instruction bytes, plus the installed Fungi binary. Environment: macOS on arm64, Node `v22.19.0`, Fungi `v0.1.0-alpha.2`, WKWebView renderer.

The portable checks copied the skill files into temporary installations without symlinks. Each native workflow ran from a separate installation containing only that workflow, `fungi`, `fungi-ui`, and its test driver. Native drivers used isolated state and cleared callback identity. No human session received synthetic feedback.

## Results

| Scenario | Expected and observed outcome | Result | Evidence |
| --- | --- | --- | --- |
| Jstack regression suite | All 54 Node tests passed, with no skips; includes imported workflows, reader/report checks, and screencap completion | Passed | [Test log](../../evidence/2026-10-29-fungi-import/tests.log) |
| Portable skill copy | All 20 imported workflow tests passed from a fresh root; both individual workflow assemblers returned retained HTML and matching input snapshots | Passed | [Portable results](../../evidence/2026-10-29-fungi-import/portable.json), [test log](../../evidence/2026-10-29-fungi-import/portable-tests.log) |
| Native grill-form | Cancel/reopen restored choice, notes, and PNG; submission preserved an untouched question, final preview state 22, comment-time state 20, and matching artifact hash | Passed | [Native result](../../evidence/2026-10-29-fungi-import/grill-native.json), [retained PNG](../../evidence/2026-10-29-fungi-import/grill-native-submitted-0.png) |
| Native show-outcome | Optional Notes and PNG restored; selected next steps submitted without Notes; malformed input and embedded interview questions produced explicit errors | Passed | [Native result](../../evidence/2026-10-29-fungi-import/outcome-native.json), [retained PNG](../../evidence/2026-10-29-fungi-import/outcome-native-reportSubmitted-0.png) |
| Self-contained references | 67 local Markdown links and 36 relative module imports resolved; no skill symlinks or references to the example source repository; legacy browser implementation paths absent | Passed | [Structure check](../../evidence/2026-10-29-fungi-import/structure.json) |
| Import completeness | All 65 tracked skill files imported; only the interview-routing paragraph and two provenance documents differ; runtime assets and licenses remain byte-identical | Passed | [Import comparison and hashes](../../evidence/2026-10-29-fungi-import/manifest.json) |
| Skill and plugin metadata | All 17 skill frontmatter checks passed; plugin `0.3.0` validated | Passed | [Validation summary](../../evidence/2026-10-29-fungi-import/validation.json) |

## Limits and follow-up

This check verifies the source bundle and native workflows. It does not test plugin publication/reloading, installed personal skill routing, a real human interview, physical clipboard gestures, or host callback delivery. The current personal skill symlinks still resolve to the example checkout, and the existing installed plugin cache remains `0.2.1`; source changes take effect there only after the installation is switched or updated.

The login shell used for this run did not find `fungi` on PATH. Native checks used the explicit installed binary at `/Users/rengwu/.fungi/bin/fungi`, whose version and availability checks passed. Normal skill invocation still requires adding that directory to the host's PATH; no shell configuration was changed by the source migration.

Browser screenshot/theme sweeps were outside this packaging check because the imported runtime assets are byte-identical. Theme assets, fonts, settings precedence, and bundle references were checked by the imported tests. The [setup](../setup.md) documents broader visual checks for future UI changes. Retained native evidence and PNG bytes are copied into this wiki; disposable installations and native session bundles remain available at the paths in their records.
