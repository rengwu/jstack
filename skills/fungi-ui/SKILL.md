---
name: fungi-ui
description: Shared UI components and authoring guidance for building or changing Fungi interfaces. Use when composing UI or extending components; routine use of a workflow with a prepared assembler does not need this skill.
---
# Fungi UI

Use these components as building blocks. Choose, arrange and style them for the workflow; local CSS overrides and variants are welcome. Shared implementations live here, including rich content, choices, inline image Notes, previews and region comments. Add missing reusable controls here before consuming them from another skill.

Keep authoring separate from routine use. When a workflow has a mechanical assembler or equivalent, its caller follows that workflow's input, invocation and result instructions without reading this skill or selecting components. Put component knowledge in the workflow's implementation. Keep this kit focused on reusable UI and supporting authoring/assembly utilities; workflow decisions and interpretation belong to the consuming skill. Agents composing or changing an interface directly can consult this guide.

Read the [component catalog](references/components.md) for imports, inputs and events. The [gallery source](assets/gallery.mjs) is a working composition example; its [page](examples/gallery.html) also demonstrates workflow-owned style overrides. Use [fungi](../fungi/SKILL.md) for availability, presentation and completion.

## Assemble an interface

Node.js 22+ is required for assembly. Keep this directory beside consuming skills. Each workflow owns its page composition, assembler, input/result schemas and feedback interpretation. Workflow modules can import `../../fungi-ui/assets/COMPONENT.mjs` from their `assets/` directory. Load `fungi-ui/assets/ui.css`, then the workflow's overrides.

The shared [assembler](scripts/assemble.mjs) copies the workflow and kit into a fresh retained directory. Its layout is `workflow/assets/` and `fungi-ui/assets/`, with the HTML entry at the root. Page templates reference those paths; module imports retain the same sibling structure as the source. All served files stay beneath the entry page, as Fungi requires. Generated copies are session artifacts, not another source to maintain. Edit the kit or workflow source and assemble again.

A workflow's `scripts/assemble.mjs` can be this small:

```js
import {assembleCLI} from '../../fungi-ui/scripts/assemble.mjs';
await assembleCLI({assets:new URL('../assets/',import.meta.url),entry:'form.html'});
```

Call it with `--input /absolute/path/to/questions.json`. `assemble({assets,entry,input})` accepts an assets directory URL/path, an HTML filename and an optional input-file path. It returns `{directory,html,theme,input?}`; the input is copied so later source edits cannot change a retained bundle. Launch the returned absolute paths using the delivery route selected by the Fungi skill. Keep that bundle for waiting and reopening.

## Themes

Each workflow template names its default with `data-theme` on `<html>`. The user can override that default for every assembled page with `~/.config/fungi-ui/settings.json` (or under `$XDG_CONFIG_HOME`):

```json
{"theme": "paper"}
```

The assembler applies the setting and returns the `theme` it used. An unknown name stops assembly and lists the available themes. Agents never choose a theme for routine use. Tools and tests can pass `theme` to `assemble()`. Theme files, tokens and authoring rules are in the [component catalog](references/components.md#themes-and-tokens).

## Try the components

```sh
node /absolute/path/to/fungi-ui/scripts/gallery.mjs
```

Open the returned `html` using Fungi and the host's selected delivery route. The gallery uses demo data, including a live preview, region comments and inline image editing. Its theme buttons switch every component between the bundled themes. Its submitted schema is `fungi-ui-gallery/v1`; it does not establish project decisions.

Preserve [vendor licenses](assets/vendor/README.md). The editor, preview and comment implementations derive from jstack; see [provenance](references/provenance.md). Validate shared changes through both consuming workflows and the gallery, including narrow layouts, draft recovery and the affected interactions.
