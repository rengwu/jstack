---
name: site-analysis
description: Study a website's design language, layout, content blocks, typography and interactions, and record the findings as a standalone group of pages in the project's wiki. Use when the user asks to study, analyse or break down a website or its design.
---
# Site analysis

Study one website the way a designer would. The result should let someone understand the site's design, and choose and adapt its pieces, without visiting it again. Describe what the site does and why it works. Adapting it to anything else is a separate step, so keep the study about the site alone.

Work in the target project's wiki, following the [target project boundary](../../references/stack-contract.md#target-project-boundary). Use [wiki](../wiki/SKILL.md) for page operations, attachments and build/check.

## Scope

Stay within the main site: the pages that share its header, footer and design language. Same-origin routes can lead to a different site, such as a docs portal, help centre or app. Leave those out unless the user asks, and list them in the overview.

Inventory the site from its navigation, footer and sitemap, and group the pages by type. Study a few pages of each type, and stop adding pages once new ones stop showing new blocks. Always include pages the user names. For a large site, confirm the sample with [grill-form](../grill-form/SKILL.md) before the detailed capture.

Cover desktop, tablet and phone widths, choosing each to land in one of the site's own layout ranges. Cover other themes, locales or signed-in areas only when asked.

## Study

Read each page from top to bottom, then use it: hover, focus, open menus, step through carousels, scroll through reveals, resize across breakpoints. Measure values from the live page where you can, such as computed styles, custom properties, fonts, media queries, transitions and keyframes. Label anything estimated from screenshots.

Let the site shape the analysis. These topics usually earn a page; merge, split, add or drop them to fit what the site actually does:

- **Design language:** the overall character and its recurring moves.
- **Colour, typography, and layout and spacing:** grid, containers, breakpoints and rhythm.
- **Imagery and presentation:** photography, illustration, icons, and how products and features are shown.
- **Motion and interaction:** animation, microinteractions, states, and scroll behaviour.
- **Content and hierarchy:** how pages sequence information, and where emphasis falls.
- **Navigation:** menus, information architecture and wayfinding.
- **Voice and copy:** tone, headline patterns and calls to action.
- **Responsive behaviour:** how layouts reflow across widths.

Add three cross-cutting pages:

- **Tokens:** the measured values in one place.
- **Page anatomies:** the block sequence of each page type.
- **Choosing blocks:** which blocks suit which kinds of content, with a few notes on poor fits.

## Blocks

A block is a page section that could be placed, reordered or reused on its own, including the header and footer. Put similar blocks together on one long page per kind, named after what the site has, for example heroes, feature grids, media and text, proof, or calls to action. Put each block's variants underneath it. Components used inside blocks, such as buttons, cards, chips and form fields, share one or a few pages.

Cover what applies to each block:

```markdown
## <Block name>

<Images at desktop, tablet and phone>

- **Where it appears:** the pages it appears on, with live links.
- **Visual:** layout, surfaces, type, imagery and spacing.
- **Content hierarchy:** reading order and emphasis.
- **Content slots:** each field, with item counts and length ranges.
- **UX and interaction:** states, behaviour and affordances.
- **Animation:** trigger, properties, duration and easing.
- **Responsive:** what changes across widths.
- **Suitable uses:** content it fits, plus a sentence on poor fits when one stands out.
- **Related blocks:** alternatives in this study.
- **Implementation notes:** techniques observed in the markup, CSS or scripts.

### <Variant name>

What differs from the main block, with its own image.
```

## Record

Keep the study as a standalone group: its pages link only to each other, to their own images and to the studied site. The wiki home links to the study once. Give every page the same `section` so the reader groups the study together, and use `order` to put the overview first, then the site-wide topics, the cross-cutting pages, the block pages and the components. Studying the site again updates the group in place and records the new date in its overview.

```text
<wiki>/
  index.md                       one link to the study
  site-analysis/<site>/
    index.md                     purpose, scope, pages studied, date, sub-sites left out
    <topic>.md                   site-wide analysis
    tokens.md
    page-anatomies.md
    choosing-blocks.md
    blocks/<kind>.md             several related blocks each
    components.md
  attachments/site-analysis/<site>/
```

Use still images only. Crop each to the block or state it shows, and keep files small (JPEG or WebP). Build and check the wiki, then report where the study is, what it covers and what was left out.
