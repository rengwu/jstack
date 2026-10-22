---
name: grill-form
description: Present offline visual reviews and questionnaires, including grill-me interviews, and collect feedback.
---
# Grill form

Use [grill-me](../grill-me/SKILL.md) for decision interviews. For design critique, lead with the design and invite open feedback; add choices where useful. Show the thing being judged when appearance or interaction matters, including visuals in options. Offer a recommendation whenever useful; it is encouraged, not mandatory. Read [authoring](references/authoring.md) for previews, diagrams, and examples.

1. **Create.** Use Node.js 22+ ([Windows and runtime setup](references/usage.md#invocation)). Replace `SKILL_DIR` with this skill's absolute directory, `PROJECT_DIR` with the existing target project, and the example below with the round's questions. The form shows the project folder's name above the round title. Add `--temporary` unless the project already uses jstack wiki at `docs/wiki/`, or when project records are prohibited. For jstack development, use `--temporary` for raw interview output and record relevant findings in its development wiki.

   ```sh
   node "SKILL_DIR/scripts/grill-form.mjs" create --project "PROJECT_DIR" --open <<'JSON'
   {"title":"Project decisions","questions":[{
     "number":1,
     "prompt":"Who edits the site?",
     "recommendation":"Start with one owner to keep editing simple.",
     "options":["One owner","A team"]
   }]}
   JSON
   ```

2. **Present and wait.** Creation requests the default browser with `--open`; add `--browser EXECUTABLE` for a requested browser. On launch fallback, link `html`. Execute returned `argv` arrays (shell `command` strings are POSIX-only). Use the returned `wait` or `completion` action following [completion and waiting](../../references/stack-contract.md#completion-and-waiting). Tell the user to submit.
3. **Collect.** On a submission notice or “done,” execute `next.argv` once. If a completed wait already returned answers, use its result directly. On `received`, read the feedback (use `collect --details` if geometry is needed), then execute the returned `next.argv` to save answers and clean up. On `waiting`, end the turn. On `stopped`, the session was already finished or discarded. On `error`, consult the returned `help`.
4. **Continue.** Read the feedback and returned `record`: `finalStates` are submitted settings, `stateAtComment` belongs to that comment. Inspect any `images` by their inline `[Image #N]` references. Untouched items are unresolved, not approval. Continue the review or interview; disclose any visuals you could not inspect.

Temporary transcripts stay outside the project; plan applies the project's rules when recording decisions. For interrupted or cancelled rounds, see [recovery](references/usage.md).
