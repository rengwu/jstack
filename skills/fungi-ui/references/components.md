# Component catalog

Import only the modules you need from `../../fungi-ui/assets/` in a workflow's `assets/*.mjs`. Load `ui.css` first and workflow CSS afterward. Component classes can be overridden freely; see [Themes and tokens](#themes-and-tokens). Components do not import any workflow.

The [working gallery](../assets/gallery.mjs) composes these pieces. Its [template](../examples/gallery.html) shows asset paths, bundled script loading and the page policy used by the assembler.

| Component | Import | Purpose |
| --- | --- | --- |
| Buttons, fields, radio/checkbox choices and action controls | `controls.mjs` | Native controls, recommendation labels, optional preview cards |
| Markdown, tables and diagrams | `rich-content.mjs` | Sanitized offline rendering, bounded diagrams, optional expansion |
| Notes with inline image chips | `notes.mjs` | Paste, preview, editing, native undo and image limits |
| Interactive preview | `preview.mjs` | Sandboxed HTML, state changes and region capture |
| Region comments | `comments.mjs` | Comment dialog, captured preview, Notes, edit/delete/cancel |
| Feedback controller | `feedback.mjs` | Debounced saves, ordered submission, busy state and errors |
| File conversion | `files.mjs` | Blob/data-URL conversion for workflow transport adapters |
| DOM helpers | `dom.mjs` | `element(tag,text?,className?)`, `escapeHTML(text)` |

## Controls

`button(label,{className?,type?,onClick?})` returns a native button. `createField(label,{className?})` returns a fieldset with its legend; append the desired contents.

```js
const {element:control,input}=createChoice({
  type:'checkbox', id:'review', value:'review', label:'Review the layout',
  recommendation:'Check the main flow before polishing details.',
  checked:false, className:'my-workflow-choice',
  onChange:(checked,value)=>{ /* update workflow state */ }
});
```

`type` defaults to `radio`; use a shared `name` for a radio group. Recommendations display a badge and reason, with accessible label/description associations; they never preselect a choice. `createChoiceCard({control,preview,onSelect})` combines a choice with a visual preview. `onSelect` can call the choice input's `click()` method.

`createFeedbackControls({cancelLabel?,submitLabel?})` returns `{actions,cancel,submit,status,message}`. Append the three containers `actions`, `status`, `message` where the workflow needs them. Default labels are Cancel and Submit feedback. The default IDs support one form per page; change IDs if composing multiple independent forms.

## Rich content

`createRichContent(markdown,{label?,images?,links?,expandable?})` returns a section. Defaults: label Content, raster images disabled, external links rendered as links, expansion enabled. Use `images:true` for PNG/JPEG/GIF/WebP data URLs and `links:'text'` to render references as text. Fungi itself disables external navigation.

Load the bundled `marked.js`, `purify.js` and `pele.js` before using this component. Raw HTML is displayed as text. Diagrams reject configuration directives and external resources, sanitize SVG and bound input/output. Failures display source rather than breaking the interface.

Tables wrap prose while preserving short identifiers. Tables that need more space scroll inside a focusable region. Diagrams expose `data-render-state` as ready or error for inspection. Styling and layout are shared; content and reference policies belong to the caller.

## Inline image Notes

Create one Notes context per interface so image IDs and limits cover all editors, including comments:

```js
const answer={notes:'',images:[],comments:[]};
const notes=createNotes({
  values:()=>[answer,...answer.comments],
  limits:{count:20,fileBytes:5*1024*1024,totalBytes:20*1024*1024},
  onChange:()=>feedback?.changed()
});
const editor=notes.createEditor({id:'notes',label:'Notes',value:answer});
container.append(editor.notes,editor.error);
```

`values()` returns all live note objects. Each has `{notes,images?}`; images use `{id,offset,dataUrl}`. Clamp limits to the values advertised by `fungi.ready()`. Restore saved attachments to data URLs before creating the context. The constructor validates restored images, references and limits.

Editors mutate their supplied note object and call the context's `onChange`. An editor-specific `onChange` callback can also update a dialog's controls. `editor.dispose()` stops pending file-read callbacks from changing a discarded editor. `notes.ready()` reports whether all Notes and images can be serialized. `notes.fragment(value)` renders noneditable Notes, and `notes.previewImage(id)` opens an image. `notes.read(node)` extracts editor text/reference positions.

Paste creates clickable chips at the caret. Deleting a chip removes its reference; undo can restore it. Text that merely resembles an image token stays ordinary text. Clipboard transfer between editors in the same context preserves references using a private payload; other clipboard content enters as plain text or supported images.

Workflows own serialization into their result schemas. Use actual editor offsets rather than searching text for image-like tokens. `files.mjs` exports `blobToDataURL(blob)` and `dataURLToBlob(url)` for transport adapters. Image bytes stay out of the editable DOM and become keyed Fungi artifacts on submission.

## Previews and region comments

```js
const preview={html:'<p>A design to review</p>',height:280,state:{size:16}};
const comments=createComments({
  id:'design',previews:{main:preview},value:answer,notes,
  onChange:()=>feedback?.changed()
});
const view=createPreview({
  preview,label:'Design preview',state:answer.states?.main,
  onState:value=>{answer.states??={};answer.states.main=value;feedback?.changed();},
  onRegion:(region,state)=>comments.add('main',region,state)
});
container.append(view,comments.box);
```

`createPreview` accepts `preview`, optional current `state`, `label`, `onState`, `onSelect`, `onRegion`, `commentable` (default true), `readOnly` (default false), and a captured `snapshot`. It returns the preview element with a `dispose()` method for removed views. Set `commentable:false` for visual-choice previews; use `onSelect` to select their radio control.

Authored HTML runs in an opaque-origin iframe with no network, parent DOM access or nested frames. Inside it, use `window.fungiPreview.state` and `window.fungiPreview.setState(completeState)`. The legacy `window.grill` alias remains supported. State is a JSON object within 12,000 characters. The bridge accepts state only from the matching frame/token. Only state, scroll positions and validated region geometry cross the boundary.

`createComments` accepts a preview map, a value with `comments`, the shared Notes context, optional preview `labels`, `readOnly`, and `onChange`. It returns `{box,add}`. `add(key,region,state)` opens the editor and captures the prototype state with the comment. Save commits; cancel restores the prior comment; delete removes it. Comments use `{preview,region,state,notes,images?}`. A comment's state is independent of the preview's latest state. The caller owns interpretation and schema validation.

## Saving and submission

`createFeedback({form,controls,snapshot,ready?,api?,restored?})` attaches listeners and returns `{changed,save,refresh,showError}`. Call `changed()` when workflow state changes. `api` defaults to `window.fungi`; it must provide `saveDraft`, `submit`, `cancel`.

`snapshot(submitted)` returns `{data,attachments}` synchronously and throws for invalid feedback. The workflow decides whether untouched/partial answers are valid, validates its schema and enforces advertised payload limits. `ready()` can wait for image preparation; default true. `restored:true` displays the restored-draft status.

The controller debounces draft saving, waits for previous saves before submission, prevents duplicate submissions and restores controls after submission failure. It displays actionable errors and actual draft status. Session delivery and agent continuation remain the responsibility of the shared Fungi skill.

## Themes and tokens

`ui.css` puts components in the `fungi-base` cascade layer and themes in `fungi-theme`. Unlayered workflow CSS overrides both, whatever its specificity. The theme is the `data-theme` attribute on `<html>`; a nested element can carry another theme for side-by-side comparison.

| Theme | Character |
| --- | --- |
| `classic` | Default. Warm charcoal, one ochre accent, IBM Plex Sans |
| `paper` | Reading column set like Wikipedia: its Linux Libertine/Georgia headings over the system sans-serif, ruled rows, booktabs tables |
| `paper-dark` | Paper's type and structure on a warm dark ground; `paper.css` holds the shared rules |

Write workflow CSS against tokens so every theme applies: `color:var(--ui-text-3)` rather than a literal colour, and sizes relative to tokens such as `calc(var(--ui-title-size)*1.1)`. A literal value fixes that property in every theme.

| Group | Tokens |
| --- | --- |
| Surfaces | `--ui-bg`, `--ui-surface`, `--ui-surface-2`, `--ui-code-bg`, `--ui-hover` |
| Text and lines | `--ui-text`, `--ui-text-2`, `--ui-text-3`, `--ui-border`, `--ui-border-2` |
| Accent | `--ui-accent`, `--ui-accent-text`, `--ui-accent-soft`, `--ui-selected-text`, `--ui-focus`, `--ui-link` |
| Buttons | `--ui-primary-bg`, `--ui-primary-text`, `--ui-secondary-bg`, `--ui-secondary-text`, `--ui-secondary-border`, `--ui-button-padding` |
| Image chips | `--ui-chip-bg`, `--ui-chip-hover`, `--ui-chip-border`, `--ui-chip-text` |
| Feedback and overlays | `--ui-danger`, `--ui-status`, `--ui-backdrop`, `--ui-scrim`, `--ui-shadow` |
| Families | `--ui-font`, `--ui-font-heading`, `--ui-font-control`, `--ui-font-mono` |
| Sizes | `--ui-font-size`, `--ui-line-height`, `--ui-page-width`, `--ui-reading-size`, `--ui-reading-line`, `--ui-reading-width`, `--ui-title-size`, `--ui-title-weight`, `--ui-title-tracking`, `--ui-legend-size`, `--ui-subhead-size`, `--ui-heading-weight`, `--ui-control-size`, `--ui-small-size`, `--ui-code-size` |
| Shape | `--ui-radius-sm`, `--ui-radius`, `--ui-radius-lg` |

The reading tokens suit report-style pages: set `--ui-font-size:var(--ui-reading-size)` and the matching line and width tokens on `body`, as show-outcome does. Diagrams receive the theme through Pele's `--pele-*` variables. Sandboxed previews are never themed; they show the design under review.

To add a theme, create `assets/themes/NAME.css` with a `[data-theme=NAME]` block that sets `color-scheme` and every token, then add any structural rules under the same selector. Import it in `ui.css` with `layer(fungi-theme)`. Bundled fonts go in `vendor/fonts` and `fonts.css`. Validate with `scripts/ui-theme-smoke.mjs`, which fails on text contrast below 4.5:1 (including code on its background), a focus ring below 3:1, missing fonts or narrow-layout overflow.
