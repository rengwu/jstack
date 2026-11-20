---
name: orchestrate
description: Run a project with two agent sessions, an orchestrator and one implementor, exchanging messages through files. The orchestrator writes briefs, answers pushback, reviews, and keeps records; the implementor builds, verifies, and commits. Use when the user asks to orchestrate, to start the orchestrator workflow, or to work alongside an implementor agent.
---
# Orchestrate

## Roles

- **Orchestrator:** the session that invoked this skill. The user talks only to it. It turns requests into briefs, answers pushback, reviews diffs and verification runs, keeps the project's records and keeps the user posted. It never writes product code, not even a one-line fix; every change goes through a brief.
- **Implementor:** exactly one other agent session, possibly another provider. It reads each brief, pushes back before writing code if it disagrees, builds, verifies, records the run, reports, and commits after the orchestrator's review passes. It never pushes without the user's go-ahead, and never types into the orchestrator's session: anything typed there arrives as user input.

## Start

1. Resolve the target project ([target project boundary](../../references/stack-contract.md#target-project-boundary)). Workflow state lives in `.agents/jstack/orchestrate/`; add that path to the project's `.gitignore` if it isn't there.
2. Read `.agents/jstack/orchestrate/implementor.json`. If it is missing, ask the user which agent implements and how to launch it; never assume one. Store the answer in the [implementor file](references/transports.md#implementor-file) so later sessions restart it without asking.
3. Choose the [transport](references/transports.md): Rex when this session runs in Rex; otherwise tmux when it is installed, in a pane beside this session or in a tab the user opens in any terminal. Without tmux, ask the user to choose a headless implementor or a tab where they type each notice themselves.
4. Start the implementor with the [starting prompt](references/implementor-prompt.md), and confirm it is running before sending work.

## Messages

Two append-only Markdown files in `.agents/jstack/orchestrate/mail/`: `to-implementor.md` and `to-orchestrator.md`. Each message starts with a `## <ISO 8601 time> <subject>` header. Never edit or remove an earlier message. Content always goes in the file; the transport only carries a one-line notice naming the file and subject, such as `New message in to-implementor.md: Section 4 review`.

Wait for replies with [wait-for-message.mjs](scripts/wait-for-message.mjs), run through the host's background mechanism so its exit wakes the orchestrator, rather than polling. When a wait ends without a message, check the implementor is still alive through the transport.

## Briefs

Write each piece of work as a brief before it starts: in the project's jstack wiki (`docs/wiki/build/`) when it has one, otherwise in `.agents/jstack/orchestrate/build-guides/`. Never create a wiki just for this. A brief names its goal, the decisions that apply, the exact behavior, references (files, prototypes, screenshots), the checks, and anything off limits. Requests the user makes while work is underway become new sections, queued behind the current one.

## The loop

1. Send a brief. The implementor replies with pushback before writing code, or says it has none.
2. Answer each point. If either side still disagrees after that one exchange, ask the user with [grill-form](../grill-form/SKILL.md), attributing both positions. Parts that don't depend on the answer go ahead.
3. The implementor builds, runs the brief's checks, records the run (with [verify-change](../verify-change/SKILL.md) when the project keeps a wiki), and reports.
4. Review the diff and the run yourself; a report is not a review. Send findings as a numbered list. Repeat until the review passes.
5. Tell the implementor to commit. One commit per brief unless the brief says otherwise.

Keep the user posted in a line or two when work starts, when a report arrives, and when a review passes or fails. Say plainly what has and hasn't been reviewed.
