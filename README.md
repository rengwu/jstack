# jstack

A collection of thirteen skills for clarifying designs, implementing lean solutions, mapping features, and verifying changes. Planning reuses the project's existing documentation. A Markdown wiki and bundled offline HTML reader support feature maps and verification evidence.

## Skills

| Skill | Purpose |
| --- | --- |
| [work-until-grill](skills/work-until-grill/SKILL.md) | Continue work autonomously and use grill-form when a consequential decision needs user input |
| [grill-me](skills/grill-me/SKILL.md) | Clarify designs in dependency-aware rounds, with up to ten questions per round and no session-wide limit |
| [grill-form](skills/grill-form/SKILL.md) | Present offline interview forms with Markdown descriptions, tables, and Mermaid diagrams; collect answers and clean up temporary files |
| [grill-form-concise](skills/grill-form-concise/SKILL.md) | Use grill-form with concise-writing guidance for questions and answers |
| [plan](skills/plan/SKILL.md) | Discuss choices and keep decisions and important open questions in existing project notes |
| [wiki](skills/wiki/SKILL.md) | Create, edit, link, validate, and render pages and attachments without prescribing their purpose |
| [feature-map](skills/feature-map/SKILL.md) | Describe user-facing behavior, entry points, expected outcomes, and verification recipes |
| [verify-change](skills/verify-change/SKILL.md) | Exercise the real product and record build-specific results and evidence |
| [maintain-verification](skills/maintain-verification/SKILL.md) | Repair stale maps and verification tooling while reporting product regressions separately |
| [rule-lean](skills/rule-lean/SKILL.md) | Implement and simplify relevant code with practical performance and minimal unnecessary complexity |
| [concise-writing](skills/concise-writing/SKILL.md) | Write clear, concise, and direct responses while preserving important details |
| [capture-feedback](skills/capture-feedback/SKILL.md) | Capture screen regions and inline feedback in a native macOS panel, then hand the batch to an agent |
| [commit](skills/commit/SKILL.md) | Commit all changes, splitting as needed |

## Using the collection

The collection is packaged with a Codex plugin manifest in `.codex-plugin/plugin.json`. The skill instructions live in `skills/`; load them together so their relative references remain available.

Start in the project you want to work on. Ask for a design interview with `grill-me`, or use `plan` to start or resume a planning discussion. Use `wiki` directly for document operations. Then map an important feature and verify its behavior. Use the skills that fit the task; this is not a mandatory sequence for every change.

Use `rule-lean` on its own or alongside other skills for flexible guidance on KISS, YAGNI, DRY, and simplifying relevant code. It does not require a wiki workflow.

Example requests:

- “Use work-until-grill to implement this autonomously; grill me when a consequential decision needs my input.”

- “Use grill-me to clarify this feature, then record our decisions in this project's wiki.”
- “Use grill-form to interview me through a static questionnaire.”
- “Use feature-map to document conversation renaming and its expected outcomes.”
- “Use verify-change to check this fix and record what passed, failed, or remains untested.”
- “Use rule-lean to implement this change and simplify the relevant code.”

## Separation of responsibilities

`grill-me` feeds planning outcomes into `plan`; `grill-form` optionally presents its rounds without changing grill-me. Its prepared native HTML template works offline; Node scripts collect answers, save a transcript in an existing target wiki or temporary directory, and remove session files. The agent then interprets the transcript through grill-me/plan. It needs no server, frameworks, packages, build, or per-interview UI development. `plan` reuses existing project documentation and asks before adopting jstack wiki when none exists. `feature-map` and verification workflows use `wiki` for document operations. Wiki renders generic metadata. The report checker in `verify-change` validates its own outcome vocabulary and report location; the reader does not interpret those states.

The former `planning-wiki` skill is replaced by `plan` and `wiki`. Existing project Markdown and paths can be reused. Inspect local reader customizations before upgrading the builder.

`capture-feedback` ships a small prebuilt Objective-C/AppKit app for macOS. It captures rectangular regions anywhere on screen, preserves drafts, and collects paired images and notes. Both capture-feedback and grill-form use “done” by default, with optional verified background completion and no repeated agent polling.

## Project boundary

**Project records belong in the target project's repository, never in jstack.** The default location is `docs/wiki/` inside that project. jstack contains the reusable skills, reader asset, and development tests. The local historical demonstration is excluded from this public repository.

The [shared conventions](references/stack-contract.md) connect decisions → features → verification recipes → dated runs → evidence. A passing run applies only to the recorded build and selected scenarios.

## Wiki reader

The reusable builder is [`skills/wiki/assets/_build.mjs`](skills/wiki/assets/_build.mjs). The wiki skill copies it into the target project's wiki. From that project, with Node.js 22 or newer:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

The builder embeds its dependencies and needs no package installation. Open the generated `index.html` locally. Standard Markdown images display local PNG/JPEG/GIF/WebP attachments inline. Share its `attachments/` directory (or the supported legacy `evidence/` directory) as well so images and linked files remain available. Markdown remains authoritative.

## Development

Reader and report-checker tests use Node built-ins and temporary isolated fixtures:

```sh
node --test scripts/*.test.mjs
```

See [AGENTS.md](AGENTS.md) for contribution boundaries and validation guidance.

## Attribution

`grill-me` adapts Matt Pocock's interviewing workflow. Its [provenance](skills/grill-me/references/upstream.md) records the upstream revision, and its [MIT license](skills/grill-me/LICENSE) is preserved. The wiki builder preserves the licenses of its bundled dependencies in the source file.
