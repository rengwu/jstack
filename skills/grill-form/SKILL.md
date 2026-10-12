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

2. **Present and poll.** Open the returned `url` with the OS's default browser (macOS: `open URL`; do not name a browser), or the browser the user explicitly requested. If unavailable, link the `html` path. Briefly say you will check automatically and that “done” requests an immediate check. Run `next.command` through ordinary shell execution. While `next.when` is `now`, continue running the returned command. The CLI owns the waits, schedule, and saved progress; do not add timers, sleep tools, or background watchers.
3. **Collect and stop polling.** When the user says “done,” run `next.immediate.command` once (or `next.command` if already waiting for `user_done`). This stops polling and checks immediately. On `received`, run its `next.command` to save answers and clean up. On `waiting`, follow the returned next action. When `next.when` is `user_done`, report that no download was found and end the turn; check again only on user request. On `stopped`, the session was already finished or discarded; stop running commands. On `error`, read the returned `help` file. Do not restart polling.
4. **Continue.** Read the returned `record` and use those answers to continue grill-me.

Temporary transcripts stay outside the project; plan applies the project's rules when recording decisions. For interrupted or cancelled rounds, see [recovery](references/usage.md).
