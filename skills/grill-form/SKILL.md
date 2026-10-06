---
name: grill-form
description: Supplement grill-me with an HTML questionnaire for presenting questions and collecting answers.
---
# Grill form

Follow [grill-me](../grill-me/SKILL.md) for the interview. Descriptions (`context`) may use Markdown, tables, code blocks, and Mermaid when useful; for rich content, read [authoring](references/authoring.md). Present each round through this form:

1. **Create.** Replace `SKILL_DIR` with this skill's absolute directory, `PROJECT_DIR` with the existing target project, and the example below with the round's questions.

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

2. **Present and stop.** Open the returned `url` with the OS's default browser (macOS: `open URL`; do not name a browser), or the browser the user explicitly requested. If unavailable, link the `html` path. End the turn. Do not poll or leave a running process. Keep the handoff brief; explain mechanics only if asked.
3. **Collect on “done.”** When the user says they have submitted, run the saved `next.command` once. On `received`, run its `next.command` to save answers and clean up. On `waiting`, report that the download was not found and end the turn; retry only on user request.
4. **Continue.** Read the returned `record` and use those answers to continue grill-me.

On `error`, read the returned `help` file. For interrupted or cancelled rounds, see [recovery](references/usage.md).
