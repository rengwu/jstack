---
title: Orchestrate
section: Discussions
updated: 2026-11-20
---
# Orchestrate

The user asked to turn the workflow used while building Apparate into a skill: they talk to one orchestrator agent, and an implementor agent in another Rex pane does the work, the two passing messages through files. Two grill-form rounds on 2026-11-20 settled the shape.

## Decisions

| Question | Decision | Notes |
| --- | --- | --- |
| Shape | The Apparate workflow as is: orchestrator writes briefs and reviews; implementor pushes back once, builds, verifies, records, reports; disputes after one exchange go to the user in grill-form. | User confirmed. |
| Name | `orchestrate` | Claude's recommendation. |
| Rex | Portable core (mail files, roles, review loop); Rex is one documented transport. | Keeps agent and harness independence (`references/stack-contract.md`). The user asked how other terminals (chartr, Terminal.app, WezTerm) could open and reach an implementor of another provider; round 2 answered it. |
| Agents | The orchestrator is the session that invoked the skill. The implementor is asked for on each project, never assumed. | User: "don't assume defaults here". |
| Implementors | Exactly one. | User: "keep it simple here." Claude had recommended one by default, more on request. |
| Orchestrator code | Never writes product code. | User: "keeps it simple and clear cut, no guessing". |
| Mail | `.agents/jstack/orchestrate/mail/`, with `.agents/jstack/orchestrate` added to `.gitignore`. | User's path, following jstack's conventions. |
| Briefs | The project's wiki (`docs/wiki/build/`) if it has one, otherwise `.agents/jstack/orchestrate/build-guides/`. | User's choice. |
| Commits | The implementor, after the orchestrator's review passes. | Claude's recommendation. |
| Unscriptable terminals | Superseded by "tmux anywhere" below when tmux is installed. Otherwise ask the user at the start: a headless implementor resumed per message, or a tab the user opens and relays notices to. | User's choice; Claude had recommended headless only. |
| Terminals driven | Rex and tmux. tmux also covers any terminal started inside it. | Claude's recommendation. WezTerm, kitty and iTerm2 were offered and not chosen. |
| tmux anywhere | tmux is the intermediary for any terminal: the user opens a tab and starts the implementor in a named tmux session, which the orchestrator reaches from anywhere. Manual notices remain only without tmux. | Follow-up the same day: in the first version a user-opened tab needed the user to type every notice, and the user asked for a nudgeless relay. Claude recommended tmux over a home-made terminal wrapper; the user: "manual nudge when the user doesn't have tmux". |
| Launch command | Remembered per project in `.agents/jstack/orchestrate/implementor.json`. | Claude's recommendation. |

## Mechanics

Messages are append-only Markdown with `## <time> <subject>` headers; transports carry only one-line notices. The orchestrator waits for replies with `skills/orchestrate/scripts/wait-for-message.mjs` through the host's background mechanism instead of polling; `scripts/orchestrate.test.mjs` covers it. In Apparate the mail lived in the orchestrator's session scratchpad, which disappeared mid-session; keeping it in the project avoids that.
