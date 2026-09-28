# jstack

A collection of five cooperating skills for clarifying designs, mapping features, and verifying changes. Each project's Markdown wiki holds its decisions, expected behavior, and verification evidence. A bundled offline HTML reader makes those records browsable.

## Skills

| Skill | Purpose |
| --- | --- |
| [grill-me](skills/grill-me/SKILL.md) | Clarify designs in dependency-aware rounds, with up to ten questions per round and no session-wide limit |
| [planning-wiki](skills/planning-wiki/SKILL.md) | Preserve requirements, decisions, open questions, and discussion history in a project wiki |
| [feature-map](skills/feature-map/SKILL.md) | Describe user-facing behavior, entry points, expected outcomes, and verification recipes |
| [verify-change](skills/verify-change/SKILL.md) | Exercise the real product and record build-specific results and evidence |
| [maintain-verification](skills/maintain-verification/SKILL.md) | Repair stale maps and verification tooling while reporting product regressions separately |

## Using the collection

The collection is packaged with a Codex plugin manifest in `.codex-plugin/plugin.json`. The skill instructions live in `skills/`; load them together so their relative references remain available.

Start in the project you want to work on. Ask for a design interview with `grill-me`, or use `planning-wiki` to start or resume its records. Then map an important feature and verify its behavior. Use the skills that fit the task; this is not a mandatory sequence for every change.

Example requests:

- “Use grill-me to clarify this feature, then record our decisions in this project's wiki.”
- “Use feature-map to document conversation renaming and its expected outcomes.”
- “Use verify-change to check this fix and record what passed, failed, or remains untested.”

## Project boundary

**Project records belong in the target project's repository, never in jstack.** The default location is `docs/wiki/` inside that project. jstack contains the reusable skills, reader asset, and development tests. The local historical demonstration is excluded from this public repository.

The [shared conventions](skills/planning-wiki/references/stack-contract.md) connect decisions → features → verification recipes → dated runs → evidence. A passing run applies only to the recorded build and selected scenarios.

## Wiki reader

The reusable builder is [`skills/planning-wiki/assets/_build.mjs`](skills/planning-wiki/assets/_build.mjs). The planning-wiki skill copies it into the target project's wiki. From that project, with Node.js 22 or newer:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

The builder embeds its dependencies and needs no package installation. Open the generated `index.html` locally. Share its sibling `evidence/` directory as well if readers need the linked attachments. Markdown remains authoritative.

## Development

Reader behavior tests use Node built-ins and temporary isolated fixtures:

```sh
node --test scripts/reader.test.mjs
```

See [AGENTS.md](AGENTS.md) for contribution boundaries and validation guidance.

## Attribution

`grill-me` adapts Matt Pocock's interviewing workflow. Its [provenance](skills/grill-me/references/upstream.md) records the upstream revision, and its [MIT license](skills/grill-me/LICENSE) is preserved. The wiki builder preserves the licenses of its bundled dependencies in the source file.
