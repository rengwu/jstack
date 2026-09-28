---
name: verify-change
description: Verify a requested code change or feature against the running product using its feature map, recording build-specific outcomes and evidence in the project wiki. Use when behavioral verification is requested or needed to complete an authorized implementation task.
---
# Verify a change

Read [the shared conventions](../planning-wiki/references/stack-contract.md), the relevant feature files, and `verification/setup.md`. Use the bundled `feature-map` skill for missing feature knowledge and `planning-wiki` for a missing wiki. Preserve the user's current scope; verification by itself does not authorize fixing product code or shipping it.

## Prepare a bounded check

Identify the requested change and affected user behavior. Select scenarios based on the diff, requirements, entry points, and relevant cancel/error/persistence paths. State the selected scope and gaps; don't require a full regression sweep for every edit. For a bug fix, reproduce on the baseline where practical, then exercise the same scenario on the changed build.

Discover existing browser, desktop, CLI, API, or test drivers. Write or update setup with real launch, readiness, build-identity, isolation, auth/fixture, observation, and cleanup instructions. Verify any new helper by executing it. Use existing tools before creating wrappers; absence of a custom CLI is not a blocker when existing tools can exercise the behavior.

## Exercise and observe

1. Start or identify the intended instance. Check the build and revision, required account state, and ownership of ports/data. Don't let simultaneous runs drive the same mutable instance.
2. Establish known initial state. Drive real user entry points. Internal setters and mocked bypasses cannot prove the path they skip; seed setup state only outside the behavior under test.
3. Wait for observable completion. Capture the trigger and outcome, plus underlying effects where relevant: persistence, network requests, file contents, or state after reopening. Screenshots alone do not prove invisible side effects.
4. On failure, diagnose whether it is the app, tooling, or environment. Recheck health and reset after a surprising state. Fix and retry within the enclosing task's authorization; stop dependent checks when a missing prerequisite or repeated failure prevents useful progress. Mark them Untested with the actual reason.
5. Save evidence and the tested revision/fingerprint before cleanup. Remove only resources the run created and confirm evidence survives. Do not collect credentials into logs or screenshots.

## Record the outcome

Write `verification/runs/<run-id>.md` following the shared report contract. Use explicit Passed/Failed/Untested results per scenario and the conservative aggregate rule. Include what was actually observed, not another agent's self-report. Label independent review only if a different verifier actually performed it.

Link the report from each affected feature's history; have the coordinator update common navigation if workers are concurrent. Rebuild and check the wiki. In the handoff, provide the verdict, report link, and material untested paths. A successful wiki build is not product verification.
