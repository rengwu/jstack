# Transports

A transport opens the implementor, delivers one-line notices to it and, where possible, shows its screen. Messages themselves always travel through the mail files.

## Implementor file

`.agents/jstack/orchestrate/implementor.json`, written after asking the user:

```json
{
  "agent": "Codex",
  "interactive": ["codex", "-m", "MODEL"],
  "headless": {
    "run": ["codex", "exec", "--json", "{prompt}"],
    "resume": ["codex", "exec", "resume", "{session}", "{prompt}"]
  },
  "transport": "rex",
  "handle": "a3271c"
}
```

`interactive` launches the agent's TUI and takes the starting prompt as its last argument. `headless` is needed only for the headless transport: `{prompt}` and `{session}` are placeholders. Ask the user how their CLI runs non-interactively and resumes a conversation; don't guess flags. `transport` and `handle` (pane, block or session ID) record the running implementor; update them on every start.

## Rex

Use when `REX_SESSION` and `REX_BLOCK` are set and `rex whoami` succeeds. Read `rex skill show` for current syntax.

- **Open:** `rex split -s "$REX_SESSION" -b "$REX_BLOCK" --split=right --focus=false --label implementor -c PROJECT --json -- COMMAND... "STARTING PROMPT"`. Record the new block ID.
- **Notify:** `rex send -s "$REX_SESSION" -b BLOCK 'NOTICE'`, then `rex send-key -s "$REX_SESSION" -b BLOCK enter`. Many TUIs treat fast input as a paste and need a second `enter`; capture the screen and send one if the notice is still in the composer. While the implementor is mid-turn, some TUIs queue input on `tab` instead.
- **Read:** `rex capture -s "$REX_SESSION" -b BLOCK --trim | tail -n 40`.
- **Check:** `rex block ls -s "$REX_SESSION"` lists the block while it lives.

## tmux

Use when `tmux` is installed, whether or not the orchestrator runs inside it. tmux owns the implementor's terminal, so any process can reach it by target.

- **Open, orchestrator inside tmux** (`TMUX` set): `tmux split-window -h -d -c PROJECT -P -F '#{pane_id}' COMMAND...`. Record the pane ID as `handle`.
- **Open, anywhere else:** print a command for the user to run in a new tab of any terminal (Terminal.app, WezTerm, chartr and so on): `tmux new-session -s NAME -c PROJECT 'COMMAND... "STARTING PROMPT"'`, with a name unique to the project, such as `orchestrate-PROJECT`. It looks like an ordinary tab running the agent. Record `NAME` as `handle`, and confirm with `tmux has-session -t NAME` before sending work.
- **Notify:** `tmux send-keys -t HANDLE -l 'NOTICE'`, then `tmux send-keys -t HANDLE Enter`, with the same paste caveat as Rex.
- **Read:** `tmux capture-pane -p -t HANDLE | tail -n 40`.
- **Check:** `tmux has-session -t HANDLE` for a session, or `tmux list-panes -a -F '#{pane_id}'` contains the pane.

## Headless

For when tmux isn't installed and the user chooses it. The orchestrator starts each implementor turn itself, so no notice is needed.

- **Start:** run `headless.run` with the starting prompt, in the background, appending output to `.agents/jstack/orchestrate/implementor.log`. Record the session ID the CLI reports as `handle`.
- **Each message:** after appending to `to-implementor.md`, run `headless.resume` with the notice as the prompt, in the background, appending to the log. The run's exit wakes the orchestrator; its reply is in `to-orchestrator.md`.
- The user can follow along with `tail -f .agents/jstack/orchestrate/implementor.log`. They can't type to the implementor; their requests go through the orchestrator.

## Tab with manual notices

Last resort, for when tmux isn't installed and the user wants a live tab rather than headless. Mention that installing tmux removes the manual step.

- **Open:** print the exact launch command, with the starting prompt, for the user to run in a new tab in the project folder. They run it once.
- **Notify:** for each new message, ask the user to type the notice into the implementor's tab. Replies still arrive through `wait-for-message.mjs` without the user.
