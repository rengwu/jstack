---
title: Fungi workflows in jstack
section: Decisions
updated: 2026-10-30
status: Accepted
---
# Fungi workflows in jstack

The user requested importing all four current Fungi-powered skills into jstack for daily use: `fungi`, `fungi-ui`, `grill-form`, and `show-outcome` (formerly `outcome`). The existing browser-tab grill-form is replaced by the native Fungi workflow. The separate example repository remains a place for Fungi authoring examples and documentation; jstack must work without it.

## Ownership and behavior

- Jstack maintains all four skill directories, their instructions, agents metadata, page templates, modules, styles, fonts, vendors, licenses, and assemblers. Resources use sibling-relative paths within the collection. Fungi and Node.js 22+ remain runtime prerequisites.
- `fungi` owns runtime availability, native sessions, delivery, collection, and recovery. Workflow inputs and interpretation remain with `grill-form` and `show-outcome`.
- `fungi-ui` owns reusable components, themes, and bundle assembly. Routine callers supply JSON to a prepared assembler; component documentation is for authoring or changing interfaces.
- `grill-form` remains an optional presentation layer for `grill-me` and `plan`. Existing `work-until-grill` and `grill-form-adhd` references resolve to the replacement. `grill-me` remains independent of presentation.
- `show-outcome` retains its own report schema and page; it can run without grill-form. Both workflows preserve drafts, retained bundles, and result artifacts for reopening.
- The old browser launcher, downloaded-answer collector, template, duplicated vendors, and their obsolete tests are removed. Screencap retains its separate native implementation and completion helper.

The plugin version is `0.3.0`, reflecting the new skills and changed grill-form runtime. No commit or publication is part of this migration. Historical wiki records describe their original builds and remain preserved.

## Screencap archive — 2026-10-30

The user subsequently requested deprecating screencap without deleting it. Its skill directory, native source and signed app, completion launcher/adapter, tests, references, and earlier capture-feedback mockups now live under `archive/screencap/`. The archive keeps the original relative layout so its executable and tests resolve their dependencies without a rebuild. Its README records the contents and explicit check command.

Jstack now exposes sixteen active skills. Active skill instructions, completion guidance, and test scripts no longer depend on screencap. The shared test helper's screencap wait utility is archived; active reader/report tests retain their symlink utility. Existing mixed-feature historical records and verification evidence remain in place. See the [archive isolation check](../verification/runs/2026-10-30-screencap-archive.md).

## Verification

See the [feature contract](../features/fungi-workflows.md), [setup and recipes](../verification/setup.md), and the [migration run](../verification/runs/2026-10-29-fungi-import.md). The checks cover portable skill assembly, current schemas and assets, native Fungi feedback/draft handling, and existing jstack regressions. New evidence belongs to jstack; historical example evidence is not copied in as proof of the imported build.
