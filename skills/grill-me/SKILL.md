---
name: grill-me
description: Run a batched interview to clarify a plan, design, or decision and record accepted outcomes in the target project's wiki. Use when the user asks to be grilled, interviewed, or to stress-test an idea through questions; do not impose an interview on routine implementation requests.
---
# Grill me

Build shared understanding through rounds of consequential questions. Adapted from Matt Pocock's grilling workflow; see [provenance](references/upstream.md) and [MIT license](LICENSE).

Read [jstack conventions](../../references/stack-contract.md). Use [plan](../plan/SKILL.md) to interpret and preserve planning outcomes; plan uses wiki for document operations. Resolve the target project before writing; never write project records into jstack's source, installed plugin, or examples. If the project is unclear, clarify the destination before persisting; useful discussion may continue meanwhile.

## Ground the discussion

Establish the scope from the user's request and conversation. Read relevant project instructions, existing decisions, open questions, and feature pages. Reuse settled context rather than asking the user to repeat it. Distinguish accepted requirements, proposals, observed facts, and unknowns.

Research factual questions using the available code, files, tools, or primary sources. Do not make the user supply discoverable facts. Unavailable facts remain unknown; gather the user's preferences and judgments separately. No particular delegation tool is required.

## Follow the decision tree

Track which decisions depend on others. A question is ready when its prerequisites are settled; ask ready questions together without guessing the answers to unresolved prerequisites.

Start with root decisions that shape the rest of the work, such as desired outcome, users, scope, constraints, and major tradeoffs, only where those are unresolved. Prioritize consequential roots when more questions are ready than fit in a round. Resolve these before asking the smaller subquestions that depend on them. Independent branches can progress while another branch is blocked or awaiting research.

After each answer round, recompute the ready questions. Answers can eliminate branches, create new ones, or reopen assumptions. Continue through the tree; there is no fixed number of rounds or total-session question budget. A newly discovered root concern belongs ahead of its dependent implementation details.

## Ask a round

- Ask at most **10 questions per round**. Typically batch **6–10** when that many useful independent questions are ready. Ask fewer when appropriate; never pad a round to reach six.
- Group questions by topic when useful and number them consistently across rounds so the user can answer by number.
- Each numbered question asks one decision and includes a concise recommended answer with its reason. Offer short alternatives when they clarify a tradeoff. Do not hide additional questions in sub-bullets or a compound prompt.
- Keep each question self-contained. Explain only the context needed to make the choice, and identify why a consequential choice matters.
- Use an available question interface if it can represent the full round; otherwise present the numbered batch in the reply. Do not artificially shrink a round to fit a three-question interface.
- Wait for the user's answers before asking questions that depend on them. Read-only fact gathering may continue without assuming choices.

Partial answers settle only the answered decisions. Ask again only for consequential unresolved prerequisites, not every unanswered item mechanically. An explicit “use your recommendations for the rest” delegates those choices; silence does not. Record a recommendation as accepted only when the user accepts it or delegates the choice. A request to pause or stop ends questioning; preserve the open branches.

## Keep the project record current

After substantive answer rounds, use plan's existing records instead of introducing a second documentation system:

- Put accepted decisions, their rationale, and links to affected features in the decision register and relevant topic pages.
- Keep unresolved questions and dependencies in `discussions/open-questions.md`. Record explicit deferrals and their reason; do not turn them into assumed answers.
- Capture a concise dated journal of changed understanding. Preserve superseded decisions and earlier journals.
- Rebuild and check the target project's wiki after changes, through plan and the bundled wiki operations. A missing target or persistence tool is a reporting limitation, not permission to store records in the plugin.

Do not mark planned behavior as implemented or verified. Once the expected behavior is clear, feature-map can turn it into observable outcomes and verification recipes within the user's requested scope.

## Finish with sufficient clarity

Stop when the scoped outcome is understood and consequential branches are resolved or explicitly deferred, even if speculative low-value branches remain. Continue when consequential uncertainty remains and the user wants to explore it. Avoid exhaustive questioning solely to claim the entire imaginable tree is complete.

Summarize the agreed outcome, major decisions, deferred questions, and the next useful step. Confirm shared understanding if it has not already been established. Interview completion does not authorize implementation: proceed only within existing authorization, or wait for the user's instruction to implement. Do not demand a second confirmation when the user has already confirmed the understanding and authorized that next step.
