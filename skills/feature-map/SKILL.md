---
name: feature-map
description: Create or update a project's user-facing feature map with expected behavior, entry points, and executable verification recipes in its shared wiki. Use to map features or update their documented behavior after a change.
---
# Feature map

Read [the shared conventions](../../references/stack-contract.md). Work in the target project's wiki, normally `docs/wiki/`. If no wiki exists, use [wiki](../wiki/SKILL.md) to establish it without inventing project requirements.

## Map behavior

Read existing feature records and relevant requirements and decisions. Inspect routes, menus, commands, tests, and source entry points to identify the requested behavior. Start with the requested feature or a few important workflows; do not inventory the whole product unless requested.

Create or update `features/index.md` and one concise file per coherent user-facing feature using the shared feature record. Keep IDs stable, and link related decisions and features. Distinguish expected behavior supported by requirements from behavior merely observed in code. Surface ambiguity rather than declaring current bugs to be the intended contract.

Document all relevant entry points, prerequisites, observable outcomes, and affected variants. Include cross-feature journeys when a shared state transition matters. Give exact actions using the project's actual tools from `verification/setup.md`; don't invent commands, selectors, or executable capability. If a driver or account is missing, record the gap. A recipe not yet run is unvalidated.

Prefer a small map that another agent can follow without reading the entire codebase. Keep common launch and cleanup instructions in setup; feature pages supply only feature-specific details. Split a page when its workflows need substantially different prerequisites.

## Finish

Link features from the home page and relevant planning pages. Preserve verification history and record when a behavior change requires re-verification; never carry an old pass forward as proof of new code. Use wiki to maintain links and build/check the reader. Report what is mapped, what is uncertain, and which recipes still need execution.
