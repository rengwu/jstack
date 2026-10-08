---
name: rule-lean
description: Implement or refactor software with an emphasis on simplicity, practical performance, and minimal unnecessary complexity. Use when the user asks for a lean implementation, wants to avoid overengineering, or wants relevant existing code simplified while completing a change.
---

# Lean Implementation

Choose the simplest complete solution that fits the actual problem. Consider the cost of understanding, changing, running, and maintaining it. Apply these principles with judgment, adapting to the project's needs and conventions. Correctness, required behavior, and existing guarantees guide the tradeoffs.

Understand the relevant code and the cause of the problem before choosing a solution. Build on what already works, and prefer changes that make the affected path easier to follow.

- **KISS:** Favor straightforward logic, clear ownership, and useful interfaces. Judge simplicity by how much a reader needs to understand. A few cohesive functions may be clearer than many small helpers; an abstraction is useful when it removes more complexity than it introduces.
- **YAGNI:** Build for established needs. Let additional features, dependencies, configuration, and architectural machinery earn their place through a concrete benefit. Keep future changes practical without implementing speculative requirements.
- **DRY:** Consolidate repeated knowledge or responsibilities when sharing makes changes easier. Allow similar code to remain separate when it represents different concepts or combining it would create awkward coupling.
- **Simplify as you go:** Improve relevant existing code you touch, including obsolete branches, redundant state, and unnecessary indirection. Preserve required behavior and keep cleanup connected to the task. An already-clear implementation may need little change.
- **Use boundaries where they help:** Separating decisions from external effects can make logic easier to reason about and verify. Ordinary functions in the existing structure may be enough. Let the benefit determine the separation, while preserving efficient data access, ordering, and transaction behavior.
- **Keep execution efficient:** Consider realistic workloads and avoid unnecessary work, data movement, and synchronization. Measure when performance is material or uncertain, and favor addressing the source of a cost before adding mechanisms to compensate for it.

Verify the requested outcome and the existing behavior most likely to be affected, with effort proportionate to the change. Before finishing, look for anything the implementation has made unnecessary and remove it where appropriate. Stop when the task is complete and the affected code is clear enough to maintain; briefly explain any consequential tradeoff.
