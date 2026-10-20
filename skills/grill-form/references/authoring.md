# Authoring a review

Choose the shape that helps the user respond: an open critique, a visual comparison, an interactive prototype, or a focused question. A round can mix these. Keep recommendations useful and specific. Render and inspect the form before presenting it when browser tools are available; disclose when inspection was unavailable. Never submit synthetic answers to a real review.

The CLI accepts JSON on stdin: `{"title":"Review","questions":[...]}`. Each item can have a `prompt`, Markdown `context`, `preview`, `recommendation`, and `options`. All are optional individually; provide a prompt, context, or preview. Options may be strings or `{id,label,preview}` objects. Notes are always available. Partial feedback is accepted; use `required:true` only for an answer needed to proceed. Blank items remain unresolved.

## Content

| Content | Authoring |
| --- | --- |
| Prose, tables, code | Markdown in `context`; Marked + DOMPurify. Raw HTML is shown as text. |
| Diagrams | Fenced `mermaid` blocks in `context`; bundled Pele. Flowcharts, sequences, states, classes, ER diagrams, pie charts, and other Pele-supported types. No configuration directives/frontmatter, links, external images, or custom icon callbacks. |
| Icons, images, styled layouts | `preview.html` containing native SVG, embedded raster data URLs, HTML, and CSS. |
| Interactive prototypes | The same preview with inline JavaScript; use the state API below for meaningful adjustments. |

Every preview, including option previews, is a separate sandboxed iframe. Its styles never enter the form or another preview; form styles never enter it. Include the preview's own styles. Scripts cannot access the parent document. External styles, scripts, fonts, images, network requests, nested frames, and form submissions are blocked. Embed assets; no CDN, packages, server, or per-round build. The prepared template and CLI handle the review UI.

`preview` accepts `html`, optional `height` (64–1200 pixels, default 280), and `state` (initial JSON object). Use responsive HTML; the frame scrolls when content exceeds its height. Include accessible text labels for visual choices.

## Open critique

Omit choices when the useful response is subjective.

```json
{
  "title": "Menu layout",
  "questions": [{
    "prompt": "What feels unclear in this menu?",
    "recommendation": "Keep the account name prominent and the countdown secondary.",
    "preview": {
      "height": 180,
      "html": "<style>body{margin:24px;font:16px system-ui;background:#202023;color:#eee}small{color:#aaa}</style><h3>Work</h3><small>62% · 2h 14m</small>"
    }
  }]
}
```

## Visual choices

Reuse the same preview format in options. Show the actual icon, layout, or sample in context rather than only naming it.

```json
{
  "title": "Waiting indicator",
  "questions": [{
    "prompt": "Which waiting indicator reads better?",
    "recommendation": "The hourglass conveys waiting more directly.",
    "options": [
      {"id":"hourglass","label":"Hourglass","preview":{"height":80,"html":"<style>body{margin:20px;font:16px system-ui}</style><svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' aria-label='Hourglass'><path d='M6 2h12M6 22h12M7 2v5l10 10v5M17 2v5L7 17v5'/></svg> Waiting"}},
      {"id":"dots","label":"Three dots","preview":{"height":80,"html":"<style>body{margin:20px;font:16px system-ui}</style><svg width='20' height='20' viewBox='0 0 24 24' aria-label='Three dots'><circle cx='5' cy='12' r='1.5'/><circle cx='12' cy='12' r='1.5'/><circle cx='19' cy='12' r='1.5'/></svg> Waiting"}}
    ]
  }]
}
```

## Interactive review and comments

Open-ended previews offer **Comment on preview**: drag a rectangle anywhere, then write a comment. No target markup is needed. Saved comments reopen the selected area with its prototype state, viewport, and scroll positions. Keyboard users can move the rectangle with arrows, resize with Shift + arrows, and press Enter to comment. Choice questions use selection and shared Notes, without region-comment controls. Clicking anywhere in an option card selects it, including its interactive preview. Notes and comments accept inline clipboard images.

Read `window.grill.state` to restore the initial or saved state. Call `window.grill.setState({...})` with a complete JSON object when a meaningful control changes. DOM changes alone are not captured. Area previews replay the saved source and state; they are not screenshots. Avoid clocks, randomness, and external dependencies when reproducing a submitted view matters.

For example, use `state:{"size":16}` with this `preview.html`:

```html
<style>body{margin:24px;font:16px system-ui}</style>
<h3>Work</h3>
<label>Heading size <input type="range" min="12" max="28"></label>
<script>
const control = document.querySelector('input');
const draw = () => {
  control.value = grill.state.size;
  document.querySelector('h3').style.fontSize = grill.state.size + 'px';
};
control.oninput = () => { grill.setState({size:Number(control.value)}); draw(); };
draw();
</script>
```

The collector saves the original preview source, the submitted state, and comments in a reopenable offline review returned as `preview`. Wiki transcripts link a JSON source/state record, since the existing wiki reader does not accept HTML attachments. Feedback records what the user submitted; the agent still interprets accepted decisions.

Limits: 1–10 items, up to 8 choices per item, 12,000 characters per Markdown context or state object, 150 diagram edges, 20 comments per item. Preview HTML allows 4 million characters, with 16 million across the input JSON. Other field and image limits are in [usage](usage.md).
