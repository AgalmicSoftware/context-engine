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
- Current branch: `agent-native-telegram-live`.
- Recent landed commits before this setup slice:
  - `56d6f157 feat(autocoder): add live Telegram bridge commands`
  - `e488aee2 chore(autocoder): narrow Cloudflare token setup scopes`
- Setup slice implemented in this branch:
  - Adds `/telegram-demo-setup` as the operator setup route for the private
    `agentBridgeWorker`.
  - `/telegram-demo-setup` selects a CE session, pulls the selected session
    worker URL and chain where possible, preserves OP Sepolia POKT/PATH as the
    default RPC, allows an optional additive extra RPC URL, derives the
    Workers.dev public URL, generates webhook/signer root secrets, and builds a
    mocked/redacted deploy plan.
  - `CLOUDFLARE_ACCOUNT_ID` is no longer a required pasted value. Setup derives
    exactly one Cloudflare account from `CLOUDFLARE_API_TOKEN` and blocks if the
    token can see multiple accounts because account selection is not implemented
    yet.
  - Real Telegram credentials and live network deploy remain disabled/mocked in
    tests until BotFather values and a private deploy token are available.

## Next Queue Head

1. After BotFather values are available, run the live end-to-end deploy path:
   paste `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `CLOUDFLARE_API_TOKEN`,
   optional extra OP Sepolia RPC, derive the Cloudflare account, upload generated
   `TELEGRAM_WEBHOOK_SECRET` and `DEMO_SIGNER_ROOT_SECRET` as Worker secrets,
   deploy `agentBridgeWorker`, set webhook, and smoke `/start`, `/ce_join`,
   `/ce_sessions`, `/ce_questions`, `/ce_docs`, and `/ce_me`.
2. Implement the Cloudflare `lit_encrypted` envelope producer/reader path for
   docs/context, private questions, private responses, surveys, and generated
   artifacts without routing those payloads through Lit-Arweave.
