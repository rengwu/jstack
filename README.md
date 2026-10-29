# jstack

<img src="assets/logo.png" alt="jstack icon: a balanced cairn of four stones" width="34%" align="right">

A collection of sixteen active skills for daily development: clarify designs, present results, create plain UI, implement lean solutions, map features, and verify changes. Fungi powers native interviews, visual reviews, and result windows. Planning reuses the project's existing documentation. A Markdown wiki and bundled offline HTML reader support feature maps and verification evidence.

<br clear="right">

## Skills

| Skill | Purpose |
| --- | --- |
| [work-until-grill](skills/work-until-grill/SKILL.md) | Continue work autonomously and use grill-form when a consequential decision needs user input |
| [grill-me](skills/grill-me/SKILL.md) | Clarify designs in dependency-aware rounds, with up to ten questions per round and no session-wide limit |
| [grill-form](skills/grill-form/SKILL.md) | Present interviews, visual reviews, and interactive previews in Fungi; collect decisions and feedback |
| [grill-form-adhd](skills/grill-form-adhd/SKILL.md) | Use grill-form with ADHD writing guidance for questions and answers |
| [show-outcome](skills/show-outcome/SKILL.md) | Present rich results in Fungi with optional feedback, selectable next steps, and a detailed CLI summary |
| [fungi](skills/fungi/SKILL.md) | Handle Fungi availability, native sessions, completion, and response collection |
| [fungi-ui](skills/fungi-ui/SKILL.md) | Compose and style Fungi interfaces with shared components, themes, and assembly helpers |
| [plan](skills/plan/SKILL.md) | Discuss choices and keep decisions and important open questions in existing project notes |
| [wiki](skills/wiki/SKILL.md) | Create, edit, link, validate, and render pages and attachments without prescribing their purpose |
| [feature-map](skills/feature-map/SKILL.md) | Describe user-facing behavior, entry points, expected outcomes, and verification recipes |
| [verify-change](skills/verify-change/SKILL.md) | Exercise the real product and record build-specific results and evidence |
| [maintain-verification](skills/maintain-verification/SKILL.md) | Repair stale maps and verification tooling while reporting product regressions separately |
| [rule-lean](skills/rule-lean/SKILL.md) | Implement and simplify relevant code with practical performance and minimal unnecessary complexity |
| [rule-plain-ui](skills/rule-plain-ui/SKILL.md) | Create UI designs, mockups, prototypes, and implementations without unnecessary text or elements |
| [adhd](skills/adhd/SKILL.md) | Write clear, concise, and direct responses while preserving important details |
| [commit](skills/commit/SKILL.md) | Commit all changes, splitting as needed |

## Using the collection

The collection is packaged with a Codex plugin manifest in `.codex-plugin/plugin.json`. The skill instructions live in `skills/`; load them together so their relative references remain available.

The Fungi workflows require Node.js 22+ and the [Fungi app](https://github.com/rengwu/fungi/releases), with `fungi` on PATH. All workflow instructions, components, fonts, renderers, licenses, and assembly helpers ship here; no other source checkout is needed. Keep `fungi`, `fungi-ui`, and the desired workflow directories as siblings when installing skills individually. `grill-form` and `show-outcome` can each run without the other. This repository is their maintained home for daily use.

Start in the project you want to work on. Ask for a design interview with `grill-me`, or use `plan` to start or resume a planning discussion. Use `wiki` directly for document operations. Then map an important feature and verify its behavior. Use the skills that fit the task; this is not a mandatory sequence for every change.

Use `rule-lean` on its own or alongside other skills for flexible guidance on KISS, YAGNI, DRY, and simplifying relevant code. It does not require a wiki workflow.

Use `rule-plain-ui` on its own or alongside other skills when designing or implementing UI. It keeps text and elements focused on a justifiable UX purpose.

Example requests:

- “Use work-until-grill to implement this autonomously; grill me when a consequential decision needs my input.”

- “Use grill-me to clarify this feature, then record our decisions in this project's wiki.”
- “Use grill-form to interview me in Fungi.”
- “Use show-outcome for results in this conversation.”
- “Use feature-map to document conversation renaming and its expected outcomes.”
- “Use verify-change to check this fix and record what passed, failed, or remains untested.”
- “Use rule-lean to implement this change and simplify the relevant code.”
- “Use rule-plain-ui to design this settings screen.”

## Separation of responsibilities

`grill-me` feeds planning outcomes into `plan`; `grill-form` presents visual reviews or interview rounds without changing grill-me. The workflow's Node.js assembler packages its prepared HTML and sibling `fungi-ui` assets into a retained offline bundle. Fungi opens the bundle in a native window, saves drafts and artifacts, and returns submitted feedback. The agent interprets that feedback through grill-me/plan. Routine use needs no server, package installation, or per-interview UI development. Bundles and results remain available for reopening.

`show-outcome` owns a separate report page with rich content, optional Notes, and selectable next steps. Both workflows follow [fungi](skills/fungi/SKILL.md) for availability and completion. [fungi-ui](skills/fungi-ui/SKILL.md) owns reusable components and the `classic`, `paper`, and `paper-dark` themes. A personal `~/.config/fungi-ui/settings.json` setting can override the template theme. Component guidance is for authoring interfaces; prepared workflow callers only supply JSON, assemble, launch, and interpret the result.

Grill-form accepts a JSON input file. Feedback separates final prototype settings from comment-time snapshots, and inline image references resolve to Fungi artifacts. See its [workflow](skills/grill-form/SKILL.md), [authoring guide](skills/grill-form/references/authoring.md), and [reusable visual examples](skills/grill-form/assets/examples.json).

`plan` reuses existing project documentation and asks before adopting jstack wiki when none exists. `feature-map` and verification workflows use `wiki` for document operations. Wiki renders generic metadata. The report checker in `verify-change` validates its own outcome vocabulary and report location; the reader does not interpret those states.

The former `planning-wiki` skill is replaced by `plan` and `wiki`. Existing project Markdown and paths can be reused. Inspect local reader customizations before upgrading the builder.

`screencap` is deprecated. Its skill, native app and source, completion helpers, tests, references, and earlier mockups are preserved in [archive/screencap](archive/screencap/README.md), outside the active plugin skills and default test suite.

## Project boundary

**Project records belong in the project being developed.** For jstack itself, the [development wiki](docs/wiki/index.md) holds relevant decisions, findings, open questions, and verification evidence. Other projects keep their own records. Follow the [target project boundary](references/stack-contract.md#target-project-boundary); the plugin installation is never a fallback destination. The local historical demonstration remains excluded from this public repository.

The [shared conventions](references/stack-contract.md) connect decisions → features → verification recipes → dated runs → evidence. A passing run applies only to the recorded build and selected scenarios.

## Wiki reader

The reusable builder is [`skills/wiki/assets/_build.mjs`](skills/wiki/assets/_build.mjs). The wiki skill copies it into the target project's wiki. From that project, with Node.js 22 or newer:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

The builder embeds its dependencies and needs no package installation. Open the generated `index.html` locally. Standard Markdown images display local PNG/JPEG/GIF/WebP attachments inline. Share its `attachments/` directory (or the supported legacy `evidence/` directory) as well so images and linked files remain available. Markdown remains authoritative.

## Development

Keep relevant development notes in [`docs/wiki/`](docs/wiki/index.md). Its Markdown and supporting evidence can be committed normally. To render it, copy `skills/wiki/assets/_build.mjs` to `docs/wiki/_build.mjs` and run the build/check commands above. The copied builder and generated `index.html` are ignored.

Unit and integration tests use Node built-ins and temporary isolated fixtures:

```sh
node --test scripts/*.test.mjs
```

The [Fungi verification setup](docs/wiki/verification/setup.md) covers native workflow checks, the component gallery, themes, and installed-layout checks. Browser smoke drivers are development checks; users run the workflows in Fungi.

See [AGENTS.md](AGENTS.md) for contribution boundaries and validation guidance.

## Attribution

`grill-me` adapts Matt Pocock's interviewing workflow. Its [provenance](skills/grill-me/references/upstream.md) records the upstream revision, and its [MIT license](skills/grill-me/LICENSE) is preserved. The wiki builder preserves the licenses of its bundled dependencies in the source file.

The Fungi workflows preserve their [UI provenance](skills/fungi-ui/references/provenance.md) and [bundled renderer and font licenses](skills/fungi-ui/assets/vendor/README.md).
