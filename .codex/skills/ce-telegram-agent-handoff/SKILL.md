---
name: ce-telegram-agent-handoff
description: Use when an OpenClaw or similar agent needs to onboard a Telegram user into Context Engine, read active CE Telegram questions, draft preference objects for review, or pose questions through the CE Cloudflare worker.
---

# CE Telegram Agent Handoff

This wrapper keeps the skill discoverable for Codex while the canonical,
repo-packaged instructions live with the Telegram bridge worker:

- `workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md`

Use the worker-packaged skill as the source of truth.
