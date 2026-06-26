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
https://ce-agent-bridge-worker.agalmic.workers.dev/wrapped

EdgeOS Read Permission: Yes
Agent Village Wrapped Invite Token: <private demo invite token, if needed>
```

Change only the `EdgeOS Read Permission` line to `No` for a no-profile run.
Keep the invite-token line private; it is optional for already-onboarded agents
and required for first-time demo agents. The agent should use the Telegram id
from its Telegram/Hermes runtime context; users should not paste a Telegram id.

Use the unversioned skill URL for QR codes and forwarded messages. The worker
redirects it to the current raw skill with a cache-busting version parameter, so
future wrapped skill versions can ship without changing the QR target.
