---
title: Site analysis
section: Discussions
updated: 2026-11-24
---
# Site analysis

The user asked for a skill that studies any website's layout, visuals, content arrangement and hierarchy, typography, interactions and design language. The result is a standalone group of pages in the project's jstack wiki. A wiki may hold several studies, so each must stand alone and link nowhere outside its group. The user asked for concise, slightly open-ended instructions with strict rules used sparingly, composing into other skills where possible. The study is meant to give a reusable catalogue of content blocks, so later work can pick blocks that suit the content. Two grill-form rounds on 2026-11-24 settled the shape. In round 2 the user approved the drafted SKILL.md as written.

| Round | Fungi session |
| --- | --- |
| 1 | `ec8c2653311ff75b559586ba2a322cd4` |
| 2 | `974b9dcc60c33cef1d85f72dc3d65ee4` |

## Decisions

| Question | Decision | Notes |
| --- | --- | --- |
| Name | `site-analysis` | The user's own name. Claude had recommended `site-study`. |
| Page selection | Inventory by page type, then study a few pages of each type until new pages stop showing new blocks. Pages the user names are always included. | Claude's recommendation. |
| Scope | Stay within the main site. Same-origin routes that lead to a different site are left out and listed. | User: “some sites have same-origin routes that lead to a completely different site.” |
| Checkpoint | Confirm the page sample in grill-form for large sites only. | Claude's recommendation. |
| Widths | Desktop, tablet and phone. Other themes, locales and signed-in areas only on request. | The user added tablet. |
| Isolation | Pages link only to each other, their own images and the studied site. The wiki home links in once. | Claude's recommendation. |
| Location | `site-analysis/<site>/`, with images in `attachments/site-analysis/<site>/`. | The reader serves images only from the root `attachments/` and `evidence/` folders, so the builder stays unchanged. The folder follows the skill name (round 2). |
| Navigation | One reader `section` per study, ordered: overview, site-wide topics, cross-cutting pages, block pages, components. | Claude's recommendation (round 2). |
| Re-study | Update the group in place and record the new date. | Claude's recommendation. |
| Blocks | Similar blocks share one long page per kind, with variants underneath each block. Components share one or a few pages. | User: a page per block would be tiring to browse. Claude had proposed a page per block. |
| Block coverage | Where it appears, visual, content hierarchy, content slots, UX and interaction, animation, responsive, suitable uses, related blocks, implementation notes. | Unsuitable uses are reduced to a sentence when one stands out. User: they “have infinitely many cases”. |
| Site-wide pages | A suggested topic list that each study adapts. | User: “different sites might warrant different ways of analysis.” |
| Cross-cutting pages | Tokens, page anatomies, and choosing blocks. | User chose all three. |
| Values | Measured from the live page; estimates labelled. | Claude's recommendation. |
| Animation evidence | Text and still images only. | User: clips would make the files much larger. Claude had recommended adding clips when tools allow. |
| Adaptation | The study describes the studied site only. It names no target project or stack. | User: “keep it super generic.” |
| Reference stance | No line about not copying the studied site. | User's choice. |
| Skill layout | One SKILL.md, including the suggested page tree and block outline. | The user wanted concise instructions, not necessarily a short file. |

## Deferred

The user's first request was a full study of mollie.com, to gather content blocks for an expanded paydibs-redesign site. It is deferred until this skill exists. The study will belong in that project's wiki, not here.
