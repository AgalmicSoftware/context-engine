# Telegram Agent Village Wrapped Prompt

This is the stable paste-ready prompt for running Agent Village Wrapped from
Hermes. The forwarded text is intentionally short; detailed behavior lives in
the dedicated wrapped-only runtime skill so agents do not fall into the broader
Context Engine skill, Geo, Index Network, or local credential-discovery paths.

The GitHub-facing attachment/source file is
`docs/agent-village-wrapped-prompt.txt`.

## Current Prompt

```text
Use the Agent Village Wrapped runtime skill:
https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/agent-village-wrapped/skill?v=1

Run Agent Village Wrapped for me.

EdgeOS Read Permission: Yes

Do not use the broader Context Engine skill, Geo, Index Network, local reference
docs, filesystem searches, broad credential scans, or setup discovery. The
skill URL above is the complete procedure. Use the current Telegram/Hermes auth
context privately. If `memory/context-engine-state.json` is the known Context
Engine state file, you may read only that file for the private CE credential.
Do not ask me to paste a token. If no active Context Engine agent credential is
available, stop with the exact credential-needed sentence from the skill.
```

Change only the `EdgeOS Read Permission` line to `No` for a no-profile run.
