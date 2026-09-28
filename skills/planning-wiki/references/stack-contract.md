# jstack conventions

Read this when using any jstack skill. Reuse the project's existing paths and identifiers when present; the paths below are defaults. Skills are reusable process. Product knowledge, drivers, results, and evidence live in the target repository, never in the installed plugin.

## Target project boundary

Resolve the target project from the user's request and workspace before creating or updating records. Paths below are relative to that project, never to jstack's source or installation directory. If the target cannot be determined, ask for it before writing project content; do not substitute the plugin directory. The bundled `examples/wiki/` is a preserved demonstration, not an active project wiki or a template of project facts. Copy only the reusable reader asset when bootstrapping a real project. Plugin-authoring work may update skills, assets, and tests, but does not create an active wiki for jstack.

## Shared record

```text
docs/wiki/
  index.md
  decisions/index.md
  discussions/open-questions.md
  journal/YYYY-MM-DD-topic.md
  features/index.md
  features/<feature>.md
  verification/setup.md
  verification/runs/<run-id>.md
  evidence/<run-id>/
  _build.mjs
  index.html
```

Create folders only when used. Markdown is authoritative; HTML is a generated snapshot. Keep one feature description, with links from planning pages rather than duplicate specifications. A run can cover several features. Use relative Markdown links to connect decision → feature → recipe → run → evidence.

## Ownership and scope

- `grill-me` owns requested design interviews: batched questions that resolve decision prerequisites. It uses `planning-wiki` to persist accepted decisions and open questions in the target project; it does not create a parallel record system or authorize implementation.
- `planning-wiki` owns planning records, navigation, and the reader. It distinguishes requirements, proposals, observations, and accepted decisions.
- `feature-map` owns feature descriptions and verification recipes. It records intended behavior and separately labels observed or unresolved behavior.
- `verify-change` owns verification setup, any needed project-local drivers, run reports, and evidence. Verification alone does not authorize product fixes, commits, merges, deployments, or external messages. Continue fixes when the enclosing task already authorizes them.
- `maintain-verification` audits map/driver drift; it corrects documentation and verification tooling within scope, and reports product regressions separately.

With concurrent workers, give each worker distinct feature files or run IDs. One coordinator updates shared indexes and rebuilds HTML after the writers finish. Do not add a mandatory coordinating skill or require delegation.

## Feature record

Assign a stable ID such as `FEAT-session-rename`; never reuse it for another behavior. Put it in the body so the existing reader displays it. Keep these sections concise:

- **Intent and basis:** what should happen, linked to accepted decisions or requirements. Label source-derived behavior as observed, not approved.
- **Entry points and prerequisites:** user actions, roles/accounts, fixtures, flags, environment, and related features.
- **Expected outcomes:** observable results and relevant invariants; identify unanswered expectations.
- **Verification recipe:** actual commands or tool actions, stable selectors, initial state, expected results, and cleanup. Reference shared setup rather than copying it. Label unexecuted recipes as unvalidated.
- **Coverage and limitations:** affected success/cancel/error/persistence paths; known unavailable paths and cross-feature journeys.
- **Verification history:** links to dated runs with their tested revisions. A latest run is historical evidence, never a permanent certification of the feature.

## Setup and run records

`verification/setup.md` records the real launch command, readiness and build-identity checks, available interaction tools, test data/auth prerequisites, instance isolation, observable effects, evidence location, and cleanup. Prefer tools already available in the project or session. Add small project-local scripts only when they make repeated work reliable; execute them before treating them as usable.

Choose a unique run ID, for example `2026-09-27T103000Z-session-rename`. Reports use normal wiki frontmatter plus `result: Passed`, `Failed`, or `Untested`. `result` is reserved for `verification/runs/` pages; `status` remains planning/document state. Use these report sections:

- **Scope:** feature IDs with relative links, the requested change, selected scenarios, and why these cover it.
- **Build and environment:** exact tested revision; if dirty, record that and a patch/content fingerprint. If no git exists, record a reproducible file manifest with hashes. Include platform, runtime, flags, fixtures, and instance identity without secrets.
- **Results:** table of scenario, expected outcome, observed outcome, Passed/Failed/Untested, and evidence link. Untested includes blocked, skipped, and incomplete scenarios with their reason.
- **Limits and follow-up:** untested scope and any needed judgment, repair, or re-run. Distinguish harness/environment failures from established product failures.

Overall Failed means an exercised expectation failed. Otherwise Untested means any selected scenario remains untested or its outcome is unknown. Passed means all selected scenarios passed; it makes no claim about unselected features. Preserve earlier results after fixes by creating another run or an explicitly dated additional attempt. Correct factual report mistakes transparently; do not silently replace failed history.

## Evidence and reader

Store evidence in `docs/wiki/evidence/<run-id>/`. Link from a run using `../../evidence/<run-id>/<file>`; spaces and special characters must be URL-encoded. Supported local attachments: PNG/JPEG/GIF/WebP, MP4/WebM, PDF, TXT/LOG, JSON, CSV. The reader validates that linked files exist inside the evidence directory, rejects symlinks, and records their SHA-256 hashes. Evidence content changes require rebuilding the reader. HTTP(S) artifact links are also allowed, but availability and content are not validated by the builder.

Attachments open as separate files; images and video are not embedded. Share `index.html` together with its `evidence/` directory to preserve local evidence access. Sharing HTML alone shares readable reports but not the linked attachments. Do not store credentials or raw private account data in evidence. Cleanup must preserve evidence and only remove resources created by this run.

After substantive changes, update relevant links and run from the project root:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

Build/check validates the document and attachment structure, not the truth of the verification claims. Keep the reader offline and dependency-free at runtime. No package installs or package files for wiki work. Existing application build/test commands remain available for product verification.
