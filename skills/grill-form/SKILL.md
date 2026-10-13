---
name: grill-form
description: Supplement grill-me with an HTML questionnaire for presenting questions and collecting answers.
---
# Grill form

Follow [grill-me](../grill-me/SKILL.md) for the interview. Descriptions (`context`) may use Markdown, tables, code blocks, and Mermaid when useful; for rich content, read [authoring](references/authoring.md). Present each round through this form:

1. **Create.** Replace `SKILL_DIR` with this skill's absolute directory, `PROJECT_DIR` with the existing target project, and the example below with the round's questions. The form shows the project folder's name above the round title. Add `--temporary` unless the project already uses jstack wiki at `docs/wiki/`, or when project records are prohibited, as in jstack development.

   ```sh
   node "SKILL_DIR/scripts/grill-form.mjs" create --project "PROJECT_DIR" <<'JSON'
   {"title":"Project decisions","questions":[{
     "number":1,
     "prompt":"Who edits the site?",
     "recommendation":"Start with one owner to keep editing simple.",
     "options":["One owner","A team"]
   }]}
   JSON
   ```

2. **Present and wait.** Open the returned `url` with the OS's default browser, or the browser the user requested. If unavailable, link the `html` path. Use the returned `wait` or `completion` command following [completion and waiting](../../references/stack-contract.md#completion-and-waiting). Tell the user to submit.
3. **Collect.** On a submission notice or “done,” run `next.command` once. If a completed wait already returned answers, use its result directly. On `received`, run the returned `next.command` to save answers and clean up. On `waiting`, end the turn. On `stopped`, the session was already finished or discarded. On `error`, consult the returned `help`.
4. **Continue.** Read the returned `record` and use those answers to continue grill-me.

Temporary transcripts stay outside the project; plan applies the project's rules when recording decisions. For interrupted or cancelled rounds, see [recovery](references/usage.md).
