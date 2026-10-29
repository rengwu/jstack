# Provenance and maintenance

The UI, model, notes editor, preview isolation and region-comment behavior derive from jstack's earlier browser implementation at `ff6ac0bd2abfd6255b01e196aa8bc783f15efe26`:

- `skills/grill-form/assets/form.template.html`
- `skills/grill-form/assets/notes-editor.js`
- `skills/grill-form/assets/review.js`
- `skills/grill-form/scripts/model.mjs`
- `skills/grill-form/assets/examples.json` and `assets/vendor/`

The bundled renderer versions/hashes/licenses are preserved in [the vendor inventory](../../fungi-ui/assets/vendor/README.md). The sibling [grill-me](../../grill-me/SKILL.md) supplies the interview workflow; its text is not duplicated here.

Fungi’s `examples/jstack-grill-form/adapt.mjs` and `bridge.js` at base `a94e3ffd5dd1625cca724f74f8f40b3db5e894e7` informed the mapping from inline images to artifacts. That source checkout had uncommitted work; the runtime trial uses installed `v0.1.0-alpha.2`, not a build of that checkout.

Changes in this skill:

- The workflow assembler packages the template and shared kit. Its composition reads `fungi.ready().input`; no per-round UI authoring is needed.
- The model’s answer validator uses browser-native bytes and receives a spec/answer array. Fungi owns session identity and input binding.
- `transport.mjs` maps data URLs to keyed Blob artifacts, validates submitted feedback, restores acknowledged drafts and checks advertised limits.
- The shared feedback controller debounces saves, orders persistence, prevents duplicate submission, preserves input after failure and provides explicit cancel.
- The main page permits its own packaged scripts/modules; each preview retains its stricter sandbox/network restrictions.

Run `node --test scripts/*.test.mjs` and `node scripts/native-smoke.mjs /absolute/path/to/fungi /absolute/path/to/evidence.json` from the jstack repository after transport/UI changes. See the repository's verification setup for other UI checks. Preserve evidence and source hashes in its development wiki. Tests and development records remain outside this portable skill directory.

Install this directory alongside `fungi` and `fungi-ui`. Reusable UI lives in the [shared kit](../../fungi-ui/SKILL.md); this skill owns its composition, question model and transport. Node.js 22+ runs the assembler. These resources are maintained together in jstack and require no other source checkout. The Fungi implementation replaces the earlier browser launcher and download collector.
