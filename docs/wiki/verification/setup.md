---
title: Fungi workflow verification setup
section: Verification
updated: 2026-10-30
---
# Fungi workflow verification setup

Run from the jstack root with Node.js 22+. All active skill assets and local test helpers are included. Unit/integration tests need no packages. Deprecated screencap checks live separately under `archive/screencap/`; the active suite has no screencap dependency.

```sh
node --test scripts/*.test.mjs
```

## Native Fungi workflows

Install Fungi and put `fungi` on PATH for normal skill use. The native development drivers accept an absolute executable path so a run identifies the exact tested build. Replace `FUNGI_BINARY` and `EVIDENCE` below with that path and a fresh evidence directory:

```sh
node scripts/native-smoke.mjs FUNGI_BINARY EVIDENCE/grill-native.json
node scripts/show-outcome-native-smoke.mjs FUNGI_BINARY EVIDENCE/outcome-native.json
node scripts/ui-theme-native-smoke.mjs FUNGI_BINARY EVIDENCE/native-themes.json
```

These bounded synthetic checks assemble the actual workflow and shared kit into a retained temporary bundle, append a fixture driver there, and isolate `FUNGI_STATE_DIR`. They clear the callback target so synthetic results cannot notify a real conversation. The drivers exercise visible controls and the public Fungi bridge, including cancellation, reopening, draft restoration, submitted schemas, notes, PNG artifacts, and preview/comment state. They do not answer human sessions. Run native checks sequentially because they open real windows.

Drivers record `version` and `doctor`, session IDs, and retained evidence paths. Record the repository revision, dirty-source hashes, OS, Node version, and tested Fungi binary hash for each run. Preserve relevant returned artifacts before removing only disposable fixture directories. Do not delete the user's sessions.

## Components, themes, and browser checks

Run `node skills/fungi-ui/scripts/gallery.mjs` and follow the Fungi skill to open its returned page for manual component review. The gallery includes workflow style overrides, notes with images, interactive previews, and region comments. Themes are `classic`, `paper`, and `paper-dark`; routine assembly respects the user's existing theme setting.

Optional browser drivers accept an already-installed Puppeteer module and Chromium executable. Those are development tools, not workflow dependencies. Pass absolute paths and a fresh evidence directory:

```sh
node scripts/ui-browser-smoke.mjs PUPPETEER_MODULE CHROME EVIDENCE/gallery
node scripts/show-outcome-browser-smoke.mjs PUPPETEER_MODULE CHROME EVIDENCE/outcome
node scripts/ui-theme-smoke.mjs PUPPETEER_MODULE CHROME EVIDENCE/themes
```

They start an isolated headless browser and local fixture server, block external requests, inject a public bridge test double, capture desktop/narrow layouts, and close the browser/server afterward. They check component interactions, save/submit recovery, theme contrast, fonts, and overflow; they do not prove a live host callback or physical OS clipboard behavior. Inspect screenshots when changing appearance.

## Portable layout and documentation

For packaging changes, copy the four skill directories and their three Node test files (`transport`, `show-outcome`, and `ui`) to a fresh temporary root, with no symlinks or other source checkout. Run those tests there and invoke each workflow's assembler with a real JSON input. Also assemble each workflow with only its `fungi` and `fungi-ui` siblings, and inspect the retained asset paths. Imports, fonts, themes, licenses, and input snapshots must resolve locally.

Validate all skills with the installed skill-creator validator and the plugin manifest with the installed plugin validator. Check local Markdown links and module imports. Validate run metadata and rebuild the wiki:

```sh
node skills/verify-change/scripts/check-reports.mjs docs/wiki
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

Copy `skills/wiki/assets/_build.mjs` into the wiki if missing or outdated, preserving any intentional local customization. Structural checks establish document integrity, not runtime behavior.
