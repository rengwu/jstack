---
name: maintain-verification
description: Audit and repair drift in a project's feature map, verification setup, and drivers by comparing source with live behavior. Use for requested verification maintenance or demonstrated stale recipes; report product regressions separately.
---
# Maintain verification

Read [the shared conventions](../planning-wiki/references/stack-contract.md). Locate the project's wiki, feature index, verification setup, and recent runs. If none exists, use the bundled `feature-map` and `verify-change` skills to establish a small real workflow instead of inventing audit results.

## Check the requested scope

For a periodic audit, cover the mapped features; for a targeted stale recipe, check that feature and affected shared tooling. Compare the index to feature files and inspect relevant source changes for missing or renamed entry points, prerequisites, flags, selectors, or expected behavior.

Check source findings by exercising the live app with the same build-identity and evidence discipline as `verify-change`. A source-only review cannot establish a working recipe. Group compatible checks to reduce setup work, but use one driver owner for a shared instance. Record blocked paths explicitly; don't turn incomplete coverage into a clean audit.

## Classify before editing

- **Documentation drift:** agreed behavior or navigation changed and the map is outdated. Correct it with the supporting decision/source and live observation.
- **Harness gap:** the app works but the recipe or driver cannot exercise it. Repair the verification tooling and re-run the repaired path before calling it usable.
- **Product regression:** observed behavior contradicts the accepted expectation. Preserve the expectation and report the failure. Do not adjust the map to make the app pass.
- **Unclear intent:** source and records disagree without an accepted decision. Record the open question; don't choose a new product requirement during maintenance.

Default edits are limited to the wiki and its project-local verification tools. Product repairs, commits, or publishing need authorization from the enclosing task. Preserve old run reports. Record a new audit run with actual per-scenario outcomes using the shared run contract; link repaired recipes and remaining gaps.

Rebuild and check the wiki. Report clean only when the selected coverage completed without drift or failures; otherwise report corrected items, product findings, and incomplete coverage. Don't create a branch or PR solely to report a clean audit.
