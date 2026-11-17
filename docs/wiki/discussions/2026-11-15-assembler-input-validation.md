---
title: Assemblers validate input before opening
section: Discussions
updated: 2026-11-15
status: Accepted
---
# Assemblers validate input before opening

While using grill-form in another project, an agent gave an option the explicit ID `other`, which is reserved for the built-in “Something else” choice. The assembler accepted the file, Fungi opened, and the user saw an empty window with only “Invalid option id”. The user asked for the skill to be fixed so this cannot happen again.

## Cause

`skills/fungi-ui/scripts/assemble.mjs` only checked that the input parsed as JSON. Each workflow's schema validation (`normalizeSpec`, `normalizeInput`) ran for the first time inside the opened page, so an authoring mistake reached the user instead of the agent.

## Change

- The shared `assemble` accepts an optional `validate` function and calls it with the parsed input before creating a bundle.
- The grill-form and show-outcome assemblers pass their own model validators. Invalid input now exits with status 1, the reason on stderr, and no bundle.
- Grill-form ID errors name the offending value and say that `other` is reserved.

The page keeps its own validation; it is the same function.

## Verification

`node --test scripts/*.test.mjs` passed, 40 of 40, including a new test in `scripts/ui.test.mjs` that runs both assembler scripts with rejected and accepted input. No native Fungi session was exercised for this change.
