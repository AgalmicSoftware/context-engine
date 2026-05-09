# PRD 553: Telegram Bot Bridge and OpenClaw Thread

## Current State - 2026-05-09

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
- Live Telegram setup scaffolding is present with safe `.dev.vars`, `.env`,
  deploy-plan/apply helpers, and Wrangler fallback examples plus a
  secret-token-gated `/telegram/webhook` acknowledgement route.
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
  - `workers/agentBridgeWorker` deploy planning is offline by default. It can
    opt in to a single live Cloudflare account lookup with
    `--live-account-lookup` or `AGENT_BRIDGE_LIVE_ACCOUNT_LOOKUP=1`; tests keep
    this mocked and no token is printed.
  - `workers/agentBridgeWorker` now has a dry-run-by-default `deploy:apply`
    helper. Live mode requires `--apply`, reads untracked `.dev.vars` directly,
    creates or reuses KV, uploads the module Worker, writes Worker secrets
    through the Cloudflare API, enables workers.dev, sets the Telegram webhook,
    and verifies `/health`. Bridge-owned R2/D1 demo storage is explicitly
    opt-in with `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` or
    `--enable-doc-storage`; the default Telegram smoke no longer requires
    Cloudflare R2 account enablement.
  - The Worker upload uses Cloudflare's direct multipart metadata shape for
    SQLite-backed Durable Object migrations and retries without migrations when
    the `v1` migration has already been applied.
  - Live network deploys remain disabled/mocked in tests unless explicitly run
    with `--apply`; real secrets remain untracked.
  - First live apply completed for
    `https://ce-agent-bridge-worker.agalmic.workers.dev`: KV was reused,
    R2/D1 were skipped, Worker secrets were written through Cloudflare API,
    `/health` returned `agent-bridge-worker-private-v1`, and Telegram
    `getWebhookInfo` confirmed the webhook URL with zero pending errors.
  - Live Telegram callback navigation follow-up acknowledges callback queries
    before edits so Telegram inline buttons stop loading, and `Pose Question`
    without a selector opens the question picker instead of silently posing the
    first available question.
  - `GET /mock/telegram/preview` now provides a browser-only Telegram preview
    lane backed by the same command/callback builder and no Telegram Bot API
    network calls. Use it to tune copy, keyboards, callback flows, and future
    Mini App payload boundaries before live webhook smoke.
  - The callback/preview Worker update was deployed to the same Workers.dev
    URL. The apply helper reused KV, skipped R2/D1, rewrote Worker secrets
    through Cloudflare, kept the existing Telegram webhook, verified `/health`,
    and live preview POST returned the fixed question-picker response for
    `/ce_pose_question`.
  - Still mocked/contract-only before live smoke: `/telegram-demo-setup` does
    not itself deploy or set webhook, `deploy:plan` does not create Cloudflare
    resources, live `deploy:apply` is not run by tests, demo questions/docs are
    fixture-backed unless canonical `/api/agent/*` session routes are wired for
    that call, OpenClaw/MCP forwarding sends no real external transport,
    broadcast remains disabled, and Cloudflare `lit_encrypted` envelope
    producer/reader work is later storage hardening.

## Next Queue Head

1. Smoke the live Telegram bot from Telegram after the callback/preview deploy:
   private `/start`, group `/ce_join <session>`, `/ce_sessions`, `/ce_questions`,
   `/q <question-id-or-text>`, `/ce_docs`, and private `/ce_me`. Confirm
   replies expose only safe summaries and opaque `cecb_*` / `cetg_*` action IDs,
   callback buttons stop loading, and `Pose Question` opens the picker.
2. Use `/mock/telegram/preview` as the fast local/browser lane for copy,
   callback keyboard, and Mini App handoff iteration before pushing new webhook
   behavior live.
3. After the transport smoke, replace fixture-backed Telegram question/doc/session
   reads with canonical `/api/agent/*` calls where the contract is ready, then
   continue setup UX convergence so `/telegram-demo-setup` can invoke the same
   apply path without exposing Cloudflare/Wrangler details.
4. Later storage hardening: implement the Cloudflare `lit_encrypted` envelope
   producer/reader path for docs/context, private questions, private responses,
   surveys, and generated artifacts without routing those payloads through
   Lit-Arweave.
