---
name: ce-agent-access-legacy
description: Compatibility entry for older Context Engine agent skill installations; routes to the current Agent HTTP instructions.
---

# Context Engine Agent Access Compatibility Entry

Load the current [Context Engine Agent Runtime](https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/workers/agentBridgeWorker/skills/ce-agent-access/SKILL.md), or the paired Worker's `/api/agent/skill` route, and follow that retained HTTP workflow.

This URL remains available for older deployed redirects. Use `/api/agent/*` for new requests; `/telegram/agent/api/*` remains an HTTP compatibility alias. Credentials stay private and go in authorization headers. Bot commands, webhooks, Mini App launches, and human-review actions are no longer available. A consumed invite cannot be redeemed again.
