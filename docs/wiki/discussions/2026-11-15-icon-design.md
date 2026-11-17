---
title: Icon design skill
section: Discussions
updated: 2026-11-15
status: Accepted
---
# Icon design skill

The user requested an `icon-design` skill for their recurring workflow: use [App Icons](https://www.appicons.store/), [ktnr's Dribbble shots](https://dribbble.com/ktnr/shots), and [Icon Museum](https://icon.museum/) as references, create four prototypes, and present them in grill-form to choose a direction.

The skill owns the reference study, distinct rendered prototypes, visual inspection at small sizes, and refinement from feedback. It delegates the review interface to the existing grill-form assembler and session handling to Fungi. The instructions remain agent and harness independent and reuse the shared project boundary. No new form implementation, generator, or package dependency is introduced.

Four directions and the three sources are defaults that later user instructions can override. Each form option shows the actual artwork offline, with consistent framing and concise context. Existing notes and “Something else” support combinations, requested changes, and rejecting all candidates. A direction choice does not by itself authorize installing assets in a product.

The skill is discoverable through the existing `./skills/` plugin entry. The collection inventory, responsibility map, and plugin description include it.

## Simplification

The user found the first version too long and asked for a complete rewrite matching the brief they usually give agents. The skill now states only the three references, four prototypes, grill-form presentation with embedded artwork, and refinement of the chosen direction. Small-size checks, framing rules, and boundary restatements were removed; the verification below predates this rewrite except where noted.

## Verification

- After the rewrite, the skill-creator validator could not run because no available Python had PyYAML, and none was installed. A manual check confirmed the frontmatter has only `name` and `description`, the name matches the directory, and the one local link resolves.

- All 17 active skills passed the installed skill-creator frontmatter validator. The new UI metadata and 44 local Markdown links across the skill and updated collection documents also passed checks.
- `node --test scripts/*.test.mjs` passed all 40 tests on the working tree, including the pre-existing assembler validation edits.
- `node scripts/native-smoke.mjs /Users/rengwu/.fungi/bin/fungi` passed the existing native grill-form check: cancellation, draft restoration, selections, notes, PNG artifacts, preview/comment state, and submission. Synthetic sessions and bundles remain outside the repository.
- The installed plugin-creator package has no `validate_plugin.py`. Fallback checks passed for manifest JSON, identity/version, changed description fields, referenced asset paths, and skill discovery; full plugin validation remains unavailable.

The [validation evidence](../evidence/2026-11-15-icon-design/validation.json) records source hashes, runtime identity, results, and retained native-session evidence. Report metadata and the rebuilt development wiki passed their structural checks. This change authors the reusable workflow; no product icon has been commissioned or selected, and generated icon quality has not been evaluated in this task.
