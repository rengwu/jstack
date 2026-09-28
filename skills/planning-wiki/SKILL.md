---
name: planning-wiki
description: Create and maintain a project planning wiki from ongoing discussions, with authoritative Markdown, decisions, open questions, a discussion journal, and a standalone HTML reader. Use when the user wants this persistent planning workflow or asks to update an existing planning wiki.
---
# Planning wiki

Keep project planning in a browsable Markdown tree that stays useful across conversations and during development. Use the bundled reader to produce one offline HTML snapshot. Planning alone does not authorize implementing the planned product; follow the user's current phase and scope.

Read [jstack conventions](references/stack-contract.md) when working with interviews, feature maps, or verification reports. The bundled `grill-me` skill conducts requested design interviews and uses this skill to preserve accepted answers and unresolved questions. The `feature-map`, `verify-change`, and `maintain-verification` skills own their specialized records; this skill keeps the shared navigation and reader coherent.

## Start or resume

Resolve the target project from the user's request and workspace first. Use `docs/wiki/` in that project unless the user specifies another location. Never create project records in jstack's source or installed plugin directory; ask for the target if it is unclear. The bundled example is a demonstration only: do not maintain it as an active wiki or copy its project facts into another project. Read existing project instructions first. For an existing project wiki, read its home page, open questions, decision register, and most recent dated journal entry before continuing the discussion. Read relevant topic pages as needed.

For a new wiki, copy [assets/_build.mjs](assets/_build.mjs) beside its Markdown. Resolve the asset relative to this skill's directory, not the target project. The script contains the parser, sanitizer, reader, styles, and third-party licenses. Do not execute it in the asset directory: it scans its own directory. Never overwrite an existing builder or wiki content blindly; inspect local changes before an upgrade.

Create a small starting tree using the actual conversation:

```text
docs/wiki/
  _build.mjs
  index.html                         Generated
  index.md                           Project idea, scope, navigation
  discussions/open-questions.md      Unresolved choices
  decisions/index.md                 Accepted decisions
  journal/YYYY-MM-DD-topic.md        Discussion history
```

Add topic folders such as `vision/`, `features/`, or `research/` only as content needs them. Use the project's name and real requirements; do not copy another project's content or invent accepted decisions. Link the initial journal, decision register, and open questions from the home page.

Preserve existing project instructions. Add a concise wiki maintenance section to the project's existing `AGENTS.md` (or create one when absent), using the chosen paths: read the home, open questions, decisions, and latest journal when resuming; keep Markdown authoritative; update topics, decisions, and journal after substantive discussions; run build and check; keep generated HTML current; prohibit package files and installs for wiki work. Record a planning-only restriction there only when the user has chosen that phase.

## Maintain the discussion

- Put current understanding on topic pages. Clearly distinguish user-stated requirements, assistant proposals, researched observations, and accepted decisions. An unanswered suggestion is not a requirement.
- Give accepted decisions stable IDs and dates, with context, reasoning, and a source conversation or journal link. When direction changes, retain the old decision, mark it superseded, and link its replacement.
- Keep open questions current. Link resolved questions to their decisions; prioritize useful next discussions without inventing an implementation plan.
- Add a dated journal entry for substantive changes: what changed, why, and what remains open. Preserve previous entries. Use a descriptive suffix for multiple entries on one date and increasing `order` values for their sequence.
- Attribute research to sources and record unavailable references honestly. Do not convert a research finding into user approval.
- Keep the home page and navigation aligned with the current scope. Capture conclusions and rationale, not a verbatim conversation dump. Continue maintaining the wiki during development when requested.

## Markdown format

Plain Markdown works. For planning pages, prefer this optional metadata where it communicates useful state:

```markdown
---
title: Open questions
section: Discussion
status: Open
updated: 2026-09-24
order: 0
---
# Open questions
```

Use the actual update date. Metadata is flat `key: value`, not nested YAML. Supported keys are `title`, `section`, `status`, `updated`, `order`, `summary`, and `result`. `result` is reserved for `verification/runs/` pages and must be `Passed`, `Failed`, or `Untested`; it is separate from planning status. A supplied title must match the first H1. Dates use `YYYY-MM-DD`; order is numeric. The title of `index.md` names the wiki. Without metadata, titles come from the first H1 or filename, and sections from top-level folders. Summaries are optional and are not displayed as decorative subtitles.

Use relative `.md` links between pages, optionally with heading anchors. URL-encode spaces and special characters in paths. Headings generate lowercase anchors, replacing punctuation and spaces with hyphens; duplicate headings gain numbered suffixes. Build/check verifies targets. External links use HTTP(S). Tables, lists, and fenced code blocks work. Raw HTML is sanitized. The reader rejects inline image syntax. Link evidence attachments instead: supported image/video, PDF, text/log, JSON, and CSV files inside `evidence/`, using relative URL-encoded paths. Build/check validates their existence and fingerprints their contents; symlinks and links outside that directory are rejected. See the shared conventions for formats and reporting. Do not create `search.md`; that route is reserved. Hidden paths and symlinks are skipped.

## Build and hand off

From the target project's root, after Markdown or reader changes:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

Adapt paths if the user chose another location. Node.js 22+ is the only prerequisite. Never create `node_modules`, `package.json`, or package-manager lockfiles for this workflow. Never run package-manager installs, including temporary build or test setups. Use Node built-ins and the already-bundled libraries. Do not add a server, CDN, separate styles, or build configuration.

`index.html` is generated: never edit it directly. Rebuild after source changes and include the result with the Markdown. The browser reads an embedded snapshot, so refreshing alone does not pick up Markdown edits. Open the file directly in a browser that supports local HTML; it needs no network connection or folder selection. Share the HTML alone for reading reports, or include its sibling `evidence/` directory to keep local attachment links working. Share Markdown plus the builder and evidence for continued editing.

Preserve the lean Wikipedia-inspired reader. UI text must serve navigation, an action, necessary guidance, or meaningful state. Do not add slogans, ornamental logos, redundant labels, or repeated subtitles. Reader changes belong in the builder's named `template`, `css`, and `js` constants. Preserve bundled licenses.

Report the wiki location and relevant decisions or remaining questions concisely. Do not imply product implementation or global skill installation occurred merely because a wiki was created.
