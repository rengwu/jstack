# jstack conventions

Apply the independence, project boundary, and scope rules to all jstack work. Read the record sections when mapping features or verifying behavior. Reuse existing project paths and identifiers; paths below are defaults.

## Agent and harness independence

Describe capabilities and outcomes without requiring a particular agent, harness, provider, model, or proprietary tool. Adapt to available tools, permissions, and repository instructions. Use portable scripts and standard runtime APIs for mechanical helpers, including waits, scheduling, state, and cancellation. Keep optional host integrations and packaging separate so workflows remain usable without them.

## Completion and waiting

Prefer automatic delivery without model polling. Keep the exact session identity and launch receipt in conversation context; never consume another conversation's latest batch. Execute returned `argv` arrays directly when supported; `command` strings are POSIX-shell conveniences.

For `grill-form`, `show-outcome`, and other Fungi interfaces, follow [fungi](../skills/fungi/SKILL.md) for host-specific delivery and result handling. Fungi owns the session and completion route; do not layer another waiter over it. Keep retained bundles and session artifacts available for reopening.

## Target project boundary

Resolve the target project before writing its records, drivers, or evidence; ask if unclear. Store them in that project's repository. When developing jstack itself, use `docs/wiki/` in its source checkout for relevant development decisions, findings, open questions, and verification evidence. When using jstack in another project, keep that project's records there; the plugin source and installation directory are never fallback destinations.

Reuse skills and the reader asset, not example project facts. Keep `examples/wiki/` as a preserved demonstration. Do not create speculative sample wikis or fill jstack's development wiki with invented project data. Use temporary directories for generated sample wikis, demo sessions, and scratch files; record only their relevant development findings and supporting evidence in the wiki.

## Shared record

Planning follows existing project documentation. If no documentation system exists, `plan` asks before adopting jstack wiki. Feature and verification records default to:

```text
docs/wiki/
  index.md
  features/index.md
  features/<feature>.md
  verification/setup.md
  verification/runs/<run-id>.md
  evidence/<run-id>/
```

Create folders only when used. Keep one authoritative feature description. Use relative Markdown links to connect decisions → features → recipes → runs → evidence. A run can cover several features. Markdown is authoritative; HTML is generated through `wiki`.

## Ownership and scope

- `work-until-grill`: completion, routing consequential user decisions to `grill-form`.
- `grill-me`: interviews; `plan` interprets and records accepted outcomes and open questions.
- `grill-form`: optional Fungi presentation and feedback interpretation; `grill-me` stays independent of it.
- `show-outcome`: result presentation with optional feedback and selectable next steps.
- `fungi`: availability, native sessions, delivery, collection, and recovery for Fungi workflows.
- `fungi-ui`: reusable UI components, themes, and assembly; workflows own composition and schemas.
- `plan`: planning content in existing documentation; use `wiki` when applicable.
- `wiki`: generic document operations and rendering; callers own content workflows and metadata meanings.
- `feature-map`: feature descriptions and verification recipes.
- `verify-change`: setup, project-local drivers, runs, and evidence.
- `maintain-verification`: documentation/tooling drift; report product regressions separately.
- `rule-lean`: independent implementation guidance; records only when the task calls for them.
- `rule-plain-ui`: independent UI design and implementation guidance; no wiki workflow required.

Preserve existing scope and authorization. Planning or verification alone does not authorize product changes, commits, merges, deployments, or external messages; continue work already authorized by the enclosing task.

If workers run concurrently, assign distinct feature files or run IDs; one coordinator updates indexes and rebuilds after writers finish. Delegation is optional.

## Feature record

Put a stable ID such as `FEAT-session-rename` in the body; never reuse it for another behavior. Include:

- **Intent and basis:** expected behavior linked to requirements or accepted decisions; label source-derived behavior as observed.
- **Entry points and prerequisites:** actions, roles/accounts, fixtures, flags, environment, related features.
- **Expected outcomes:** observable results, invariants, and unresolved expectations.
- **Verification recipe:** real commands/actions, stable selectors, initial state, expected results, cleanup. Link shared setup; label unexecuted recipes unvalidated.
- **Coverage and limitations:** relevant success/cancel/error/persistence paths, unavailable paths, cross-feature journeys.
- **Verification history:** links to dated runs with tested revisions.

## Setup and run records

`verification/setup.md` records launch commands, readiness and build-identity checks, available tools, data/auth prerequisites, instance isolation, observable effects, evidence location, and cleanup. Prefer existing tools; execute new helpers before treating them as usable.

Use unique run IDs, such as `2026-09-27T103000Z-session-rename`, and frontmatter `result: Passed`, `Failed`, or `Untested`. Planning `status` is independent. Include:

- **Scope:** linked feature IDs, requested change, selected scenarios, and coverage rationale.
- **Build and environment:** exact tested revision; if dirty, record that and a patch/content fingerprint. Without git, include a reproducible file manifest with hashes. Include platform, runtime, flags, fixtures, and instance identity without secrets.
- **Results:** table of scenario, expected outcome, observed outcome, Passed/Failed/Untested, and evidence link. Explain blocked, skipped, incomplete, or unknown outcomes as Untested.
- **Limits and follow-up:** untested scope, needed judgment, repairs, or reruns; distinguish tooling/environment failures from established product failures.

Overall **Failed** means an exercised expectation failed; otherwise **Untested** means any selected scenario is untested or unknown; **Passed** means all selected scenarios passed. Results apply only to the tested build and scope and never permanently certify a feature. Preserve earlier results with new runs or dated attempts after fixes; correct factual mistakes transparently.

Run [verify-change's metadata checker](../skills/verify-change/SKILL.md#report-metadata-check) with the wiki root and any custom report location. It validates report outcome metadata, not observations; unrelated pages are outside its scope.

## Evidence and reader

Store evidence under `evidence/<run-id>/` in the wiki; link from runs using `../../evidence/<run-id>/<file>`. Exclude credentials and raw private account data. Cleanup preserves evidence and removes only resources created by the run.

Follow [wiki attachment rules](../skills/wiki/SKILL.md#attachments) and [build/check instructions](../skills/wiki/SKILL.md#build-and-hand-off) for formats, links, rendering, and sharing. Rebuild after source or evidence changes. Structural checks do not establish verification claims. Wiki operations require no package installation or package files.
