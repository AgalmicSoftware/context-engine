# PRD 553: Telegram Bot Bridge and OpenClaw Thread

## Current State - 2026-05-08

- `sessionCorsWorker` is the canonical session payload storage and access
  enforcement boundary for Cloudflare-backed docs/context, questions, surveys,
  responses, generated artifacts, media, and images.
- `/new` Cloudflare sessions default to `worker_sbt_gate`, which is
  worker-enforced SBT access control, not end-to-end encryption. The stronger
  `lit_encrypted` mode is scaffolded and rejects plaintext Cloudflare uploads
  until callers supply `payloadEncrypted=true` encrypted envelopes.
- `agentBridgeWorker` remains a private Telegram/demo layer. It may hold
  onboarding preferences, suggested drafts, opaque action IDs, event logs, and
  managed demo account state, but it must call canonical CE agent/session APIs
  for real session questions, responses, docs/context, and survey payloads.
- Live Telegram setup scaffolding is present with safe `.dev.vars`, `.env`, and
  Wrangler examples plus a secret-token-gated `/telegram/webhook`
  acknowledgement route.

## Next Queue Head

1. Implement the Cloudflare `lit_encrypted` envelope producer/reader path for
   docs/context, private questions, private responses, surveys, and generated
   artifacts without routing those payloads through Lit-Arweave.
2. Wire real Telegram command handling behind the existing webhook guard while
   keeping group chat payloads summary-only and routing canonical session data
   through `/api/agent/*` or `sessionCorsWorker`.
3. Add deployed-worker smoke coverage for Telegram webhook setup after real
   bot credentials and a private Cloudflare deployment are available.
