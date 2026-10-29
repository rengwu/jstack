# Provenance

The editor, rich-content renderer, interactive preview and region-comment code were extracted from the Fungi grill-form and outcome (now show-outcome) implementations on 2026-10-28 and imported into jstack on 2026-10-29. Their earlier UI derives from jstack `ff6ac0bd2abfd6255b01e196aa8bc783f15efe26`, including `notes-editor.js`, `review.js` and `form.template.html`. The original workflow model and transport adapters remain with their workflows.

The kit adds component interfaces, workflow-independent composition, a shared feedback controller and assembly helper. The preview's `window.grill` API remains as an alias for compatibility; new interfaces can use `window.fungiPreview`.

The [bundled renderers](../assets/vendor/README.md) retain their pinned versions, hashes and license files. Both workflows now use this single maintained vendor directory. Generated session bundles include these files so they run offline and remain stable through reopening.
