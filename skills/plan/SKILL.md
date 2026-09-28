---
name: plan
description: Discuss and develop project ideas, features, scope, alternatives, decisions, and open questions using a persistent project wiki. Use for planning discussions and recording their outcomes, including conclusions from grill-me.
---
# Plan

Develop shared understanding of the requested idea or change and preserve its rationale. Read [jstack conventions](../../references/stack-contract.md). Use [wiki](../wiki/SKILL.md) for page operations and rendering; this skill owns the planning content and when it changes.

## Start or resume

Resolve the target project before writing. Read its instructions and the wiki home, decision register, open questions, latest dated journal, and relevant topic or feature pages. Use the ongoing conversation to avoid asking for facts or decisions already supplied.

If no wiki exists, use wiki to initialize it. Add the minimal planning records needed: `decisions/index.md`, `discussions/open-questions.md`, and a dated `journal/YYYY-MM-DD-topic.md`, linked from the home. Create topic folders only as real content warrants. Do not create planning records when another skill only needs generic wiki operations.

## Discuss the work

Clarify the desired outcome, users, scope, constraints, and consequential tradeoffs. Inspect available code and references for factual answers. Distinguish user requirements, assistant proposals, researched observations, and accepted decisions. Explore alternatives when they materially change the outcome; explain a recommendation and its tradeoffs rather than inventing an elaborate implementation plan by default.

Use the user's preferred discussion style. `grill-me` provides a requested structured interview; ordinary planning does not automatically start one. When receiving its conclusions, preserve its accepted decisions and deferred questions without repeating the interview or imposing another approval round.

Make uncertainty explicit. User acceptance or delegated judgment establishes a decision; silence does not. When planning work becomes concrete, capture observable success criteria that feature-map can elaborate into recipes. Planning does not mark behavior implemented or verified.

## Maintain the planning record

After substantive discussions or accepted answer rounds:

- Put current understanding on relevant topic pages, keeping proposals distinct from requirements.
- Give accepted decisions stable IDs, dates, context, rationale, and a source conversation or journal link. Preserve superseded decisions and link replacements.
- Update open questions and dependencies. Link resolved questions to decisions; preserve explicit deferrals and their reasons.
- Add a concise dated journal of changes, rationale, and remaining uncertainty. Preserve earlier entries; use descriptive suffixes and increasing order for multiple entries on one date.
- Attribute research and state unavailable sources honestly. Maintain the home page and links through wiki, then build/check the reader.

Planning pages may use `status` values such as Exploring, Open, Accepted, and Superseded. These are planning conventions, not reader restrictions. A metadata label does not turn a proposal into an accepted decision.

When establishing ongoing planning for a project, preserve its instructions and add a concise maintenance section to its AGENTS.md: read the planning records on resume, update them after substantive discussions, keep Markdown authoritative, and build/check the wiki. Add a planning-only restriction only if the user chose that phase.

## Finish or continue

Summarize what is settled, what remains open, and the next useful step. Respect the user's current phase. Planning alone does not authorize implementation, publication, or other external actions; existing authorization from the enclosing task remains valid. Do not require repeated confirmation when the user has already made and authorized the decision.
