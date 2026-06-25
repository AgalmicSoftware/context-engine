# Telegram Agent Village Wrapped Prompt

This is the stable paste-ready prompt for running Agent Village Wrapped from
Hermes. The forwarded text is intentionally short; detailed behavior lives in
the dedicated wrapped-only runtime skill so agents do not fall into the broader
Context Engine skill, Geo, Index Network, or local credential-discovery paths.

The GitHub-facing attachment/source file is
`docs/agent-village-wrapped-prompt.txt`.

## Current Prompt

```text
Run Agent Village Wrapped (by Context Engine) for me using this skill:
https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/agent-village-wrapped/skill?v=1

EdgeOS Read Permission: Yes
```

Change only the `EdgeOS Read Permission` line to `No` for a no-profile run.
