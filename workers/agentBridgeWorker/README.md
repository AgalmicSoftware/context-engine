# Agent Bridge Worker

`workers/agentBridgeWorker/` is the private Telegram demo bridge worker. It is separate from `workers/sessionCorsWorker/` and must stay publicly stripped while the demo lane is private.

## Boundary

- `/api/agent/*` remains the canonical Context Engine agent contract.
- Telegram group chats are public lobbies for safe session/question/doc summaries.
- Private chat or Mini App surfaces are the account/action lane.
- Callback data, deep-link payloads, CloudStorage, Mini App payloads, and persistent chat state use opaque action IDs or safe display text only.
- Broadcast is intentionally disabled in this skeleton. The signer produces signed demo envelopes only.

## Managed Demo Accounts

Managed Telegram demo accounts are deterministic by Telegram principal plus worker deployment. Signing happens through the `ManagedDemoSignerDurableObject` boundary and returns a testnet/demo signed envelope. The normal account metadata never serializes raw key material.

`export_demo_key` and `recover_demo_key` are explicit private-only demo actions. They reject passkey, Porto, CE-CC local, linked external wallet, and production modes.

## Telegram Screens

Every `telegram_screen_state` carries launch metadata: a command, an opaque callback, or the `t.me/<bot>?start=<opaque-action-id>` deep link template.

| State | Launch |
| --- | --- |
| `setup_welcome`, `test_checklist` | `/start` |
| `group_session_card`, `account_created` | `/ce_join` |
| `private_start` | `/start <opaque-action-id>` or `t.me/<bot>?start=<opaque-action-id>` |
| `question_list` | `/ce_questions` |
| `pose_question` | `/ce_pose_question`, `/q`, deprecated `/ce_drop_question`, or `callback:<pose_question_action>` |
| `generated_question_candidates` | `/ce_generate_questions` |
| `my_account`, `joined_sbts` | `/ce_me` or `/ce_account` |
| SBT join/create states | `/ce_sbt <sbt-address-or-group-id-or-link>`, `/ce_join_sbt <sbt-address-or-invite-code-or-link>`, `/ce_create_sbt_group [session-slug]` |
| `onboarding` | `/ce_onboarding` |
| question cards | `/ce_questions` |
| `doc_library`, `doc_detail` | `/ce_docs` |
| `generate_questions` | `/ce_generate_questions` |
| `account_recovered` | `/ce_recover_key` |
| confirmation, submitted, draft, retry states | opaque callback actions |

The group session-linked card says `Session: <session>` and exposes `Join Session`, `View Questions`, `View / Add Docs`, and policy-allowed `Pose Question`. `View Questions` is the group-lobby default action. `Join Session` opens private chat and routes participants without a configured account to private account setup. Group messages remain safe public summaries only and never include account state, private answers, keys, grants, or gated/private document contents.

`View Questions` reads the linked session through the bridge's worker-local
question cache for now. Canonical `GET /api/agent/questions` remains the target
contract once a reachable agent API base is deployed for the bridge.
`Pose Question` uses `/ce_pose_question` or `/q` to pose one existing or
generated question to the group. If no selector is provided, the action opens a
choose-question menu instead of silently posing the first question. Anyone in
the linked group may pose a question; the worker still enforces session
linkage, opaque action ids, idempotent action refs, and public-safe output. The
old `/ce_drop_question` command is only a deprecated compatibility alias.
Private or gated question text is never posed to the group; group output shows a
locked state and routes eligible accounts to private chat or Mini App.

Account-created screens do not include `Open in CE`. Optional onboarding uses: `Enter startup info so I can suggest answers for you.` Confirmation copy is `Submit this response?` with `Save draft` and `Edit`.

## SBT and Account Screens

The SBT group card exposes `Join SBT`, `Details`, and `My Account` only. It does
not serialize holder lists, holder addresses, raw eligibility data, or private
member metadata.

Public/open SBT joins route to the planned canonical
`POST /api/agent/sbt-groups/claim-request` contract when session policy allows a
managed Telegram account to join. Password SBT joins collect the credential only
in private chat or Mini App and pass an opaque private-input ref to the planned
canonical request shape. Create SBT Group is Mini App first and targets the
planned `POST /api/agent/sbt-groups/create-request` contract.

SBT commands accept explicit public targets: `/ce_sbt <sbt-address-or-group-id-or-link>`,
`/ce_join_sbt <sbt-address-or-invite-code-or-link>`, and
`/ce_create_sbt_group [session-slug]`. Public SBT addresses, group ids, and share
links can appear in group commands. Passwords, invite credentials, wallet proofs,
and private eligibility checks stay in private chat or Mini App and are represented
only by opaque private-input refs.

When `Join Session` encounters required SBT gates, the session-gate screen lists
the required SBT groups, prompts public/open joins through the managed Telegram
account when eligible, routes password/invite collection to private chat or Mini
App, routes wallet/passkey/non-public gates to full CE account linking, and exposes
`Retry Join Session` after the required gate is satisfied.

`My Account` shows the managed address, joined sessions, joined SBT summaries,
and private-only export/restore controls.

## Private Questions

Public questions may be summarized in group. Private, SBT-gated, or
Lit-encrypted questions use locked group states. Eligible managed accounts create
a contract-only `POST /api/agent/decrypt/request` through the canonical CE
agent/session API; the Telegram worker does not implement Lit decrypt logic.
Decrypted prompt/context text is private-chat or Mini App only.

## Doc Library

The worker contract models R2 document bytes, D1 metadata/index status, and KV short-lived action records. The default live Telegram smoke binds only KV plus the Worker/Durable Object runtime; bridge-owned R2/D1 resources are opt-in with `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` or `--enable-doc-storage`. Supported file types are:

- Markdown: `md`
- PDF: `pdf`
- Images: `png`, `jpg`, `jpeg`, `webp`

Public summaries include titles, file types, visibility, and index status. Private or SBT-gated contents are never included in group-safe summaries.

The doc-library button copy is `View / Add Docs`. Selected docs are recorded as inputs for `Generate Questions` and as future `Use as Answer Context` candidates. Generating questions without selected docs returns `Select or upload docs before generating questions.`

Storage profile selection belongs to session config, not Telegram.
`arweave` remains the default profile. `cloudflare` is an explicit session
storage profile where the session/general worker can enforce SBT gates before
issuing upload permissions, snippets, short-lived reads, or download bytes. Lit
is required only when the session profile selects `lit_encrypted` and the
payload itself is intentionally Lit/client encrypted. The default Cloudflare
payload access mode is `worker_sbt_gate`, which is worker-enforced access
control and not end-to-end encryption.
Cloudflare storage is for CE payloads such as session context, docs, media,
questions, surveys, responses, and generated artifacts; it is not Telegram,
user preference, or profile storage. Agent and Telegram-facing records should
prefer `storageRef` and keep `arweaveTxId` only as an Arweave compatibility
alias. If a Cloudflare-backed session needs to publish a Surveys contract
pointer, the normal session worker returns the opaque bytes32-compatible storage
ID; the bridge does not mint its own canonical payload IDs or own those bytes.
The bridge exposes no Cloudflare credentials, bucket names, long-lived signed
URLs, worker tokens, or raw storage paths. `/new` Advanced owns the selected
storage profile. `/worker-setup` may display that profile but does not edit
storage policy. Cloudflare profiles use R2 for bytes, D1 for queryable metadata
and audit/index records, KV for short-lived action/replay/start refs, and Durable
Objects for managed signer runtime and coordination locks.

## Live Telegram Setup

The first live demo uses the default Cloudflare Workers URL:

```text
https://<worker-name>.<workers-subdomain>.workers.dev
```

Set `AGENT_BRIDGE_PUBLIC_URL` to that base URL. The Telegram webhook endpoint is
always:

```text
$AGENT_BRIDGE_PUBLIC_URL/telegram/webhook
```

Custom domain routing is out of scope for the first Telegram demo.

Local dry-run:

```bash
cd workers/agentBridgeWorker
cp .dev.vars.example .dev.vars
npx wrangler dev --local --port 8787
```

Paste local test or live smoke values into untracked `.dev.vars`. The automated
deploy helper reads that file directly, so template placeholders such as
`<workers-subdomain>` are parsed as data instead of being sourced by the shell.
Never commit `.dev.vars` or `dev.vars`.

```bash
npm run deploy:apply
npm run deploy:apply -- --apply
```

`deploy:apply` is a dry-run by default. The explicit `--apply` mode creates or
reuses Cloudflare resources, uploads the worker through the Cloudflare API,
writes deployed Worker secrets, enables the workers.dev route, sets the Telegram
webhook, and verifies `/health`.

Required values:

| Value | Where it goes |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` from BotFather | Paste into untracked `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `TELEGRAM_BOT_TOKEN` |
| `TELEGRAM_BOT_USERNAME` from BotFather, without `@` | Paste into `.dev.vars`; deployed as plain Worker var |
| `TELEGRAM_WEBHOOK_SECRET` random high-entropy string | Paste into `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `TELEGRAM_WEBHOOK_SECRET`; Telegram sends it as `X-Telegram-Bot-Api-Secret-Token` |
| `DEMO_SIGNER_ROOT_SECRET` random high-entropy string | Paste into `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `DEMO_SIGNER_ROOT_SECRET` |
| Public deployed `agentBridgeWorker` URL | Paste or derive the Workers.dev base URL as `AGENT_BRIDGE_PUBLIC_URL`, for example `https://ce-agent-bridge-worker.<workers-subdomain>.workers.dev`; live apply can derive it when the token can read the account workers.dev subdomain |
| CE/session worker base URL | Paste into `CE_SESSION_WORKER_BASE_URL`, for example `https://<session-worker>.<workers-subdomain>.workers.dev` |
| Default chain and RPC URL | Use `DEFAULT_CHAIN_ID=11155420` and preserve `DEFAULT_RPC_URL=https://op-sepolia-testnet.api.pocket.network` unless the selected session resolves another supported chain |
| Optional extra RPC URL | Put an Infura or other OP Sepolia fallback in `ADDITIONAL_RPC_URL`; this is additive and does not replace the default POKT/PATH RPC. The Worker tries `DEFAULT_RPC_URL` first, then `ADDITIONAL_RPC_URL` for live SessionRegistry reads |
| Optional question source | Omit `AGENT_BRIDGE_QUESTION_SOURCE` for live question reads. Use `fixture` only for local preview/demo copy, or `live_or_fixture` when a temporary fixture fallback is intentional |
| Optional question cache tuning | `AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS`, `AGENT_BRIDGE_MAX_QUESTIONS_PER_SESSION`, and explicit `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK` tune the Telegram worker-local cache. Defaults are sufficient when session metadata includes `blockLimits.start` |
| Cloudflare account ID | Do not ask the operator to paste this in product setup. `/telegram-demo-setup` and `deploy:plan` derive the account from `CLOUDFLARE_API_TOKEN`; if multiple accounts are visible, setup blocks because account selection is not implemented yet. `CLOUDFLARE_ACCOUNT_ID` is a developer fallback only |
| Cloudflare API token | Put in untracked local env as `CLOUDFLARE_API_TOKEN`; never commit it. The planning helper validates presence and prints only redacted status |
| KV namespace | `deploy:apply -- --apply` creates or reuses and binds as `AGENT_ACTION_KV` for opaque callback/action IDs and replay cache |
| R2 bucket | Optional. `deploy:apply -- --apply --enable-doc-storage` or `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` creates or reuses and binds `AGENT_DOCS_R2` for bridge-owned demo artifacts/doc bytes |
| D1 database | Optional. `deploy:apply -- --apply --enable-doc-storage` or `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` creates or reuses and binds `AGENT_DOCS_D1` for bridge-owned event/audit/index records |
| Durable Object binding | `deploy:apply -- --apply` binds `MANAGED_DEMO_SIGNER` and includes the SQLite-backed `ManagedDemoSignerDurableObject` migration |
| Draft-generation AI policy | `AGENT_AI_PROVIDER=ce_session_policy`; use sponsored/session AI through allowed session policy and do not duplicate canonical session secrets in this worker |

`deploy:apply -- --apply` sets the webhook automatically. For manual diagnosis,
the equivalent Telegram API call is:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  --data '{
    "url": "<AGENT_BRIDGE_PUBLIC_URL>/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

The live webhook route is `/telegram/webhook`. It rejects requests unless
`TELEGRAM_BRIDGE_ENABLED=true`, a bot token is configured, and Telegram supplies
the configured webhook secret token. It parses real Telegram `message` and
`callback_query` updates, handles `/start`, `/ce_join <session>`,
`/ce_sessions`, `/ce_questions`, `/ce_pose_question`, `/q`, `/ce_docs`, and
`/ce_me`, answers callback queries to clear Telegram's inline-button loading
state, and sends replies through an injected Telegram Bot API adapter. Unit tests
use mocked `fetch` and fake bot tokens; real `TELEGRAM_BOT_TOKEN` is needed only
for live Telegram smoke.

Callback data and private deep-link start payloads are opaque `cecb_*` or
`cetg_*` identifiers. Private payloads, JWTs, worker tokens, account material,
private keys, and Cloudflare credentials must never be placed in Telegram
callback data.

The command handler uses `AGENT_BRIDGE_SESSION_POLICY_JSON` as an explicit
demo/session-policy override when it is configured. Without that override, the
live Worker reads the real OP Sepolia `SessionRegistry` over `DEFAULT_RPC_URL`
plus optional `ADDITIONAL_RPC_URL` fallback and uses the returned slugs for
`/ce_sessions` and `/ce_join`. Group `/ce_join <session>` also persists the
chat's selected session in `AGENT_ACTION_KV`, so later `/ce_questions`,
`/q <number-or-id>`, and `/ce_docs` use that session without repeating the slug.

Question lists default to live mode. The Telegram worker scans public
`QuestionsAdded` logs, reads public question payload pointers, and caches safe
question summaries in memory plus `AGENT_ACTION_KV` for short periods. It only
caches successful, scoped reads. RPC/log/payload failures are reported as source
errors instead of cached as empty lists, and sessions without metadata
`blockLimits.start` need explicit scan bounds unless
`AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN=1` is set for a debug run. The cache
is a Telegram performance layer only; `sessionCorsWorker` and canonical
`/api/agent/*` remain the long-term storage/access boundary for real questions,
responses, docs, grants, and private session-context payloads.

Optional `AGENT_BRIDGE_DEMO_QUESTIONS_JSON` and
`AGENT_BRIDGE_DEMO_DOCS_JSON` fixtures are still available for local preview or
copy work. Set `AGENT_BRIDGE_QUESTION_SOURCE=fixture` to force fixture
questions, or `AGENT_BRIDGE_QUESTION_SOURCE=live_or_fixture` to fall back to
fixtures when live question reads return nothing. Fixtures must remain
non-identifying and secret-free. When optional fixture/cache vars are present in
untracked `.dev.vars`, `deploy:apply -- --apply` uploads them as plain Worker
vars.

Question cache controls:

| Var | Purpose |
| --- | --- |
| `AGENT_BRIDGE_QUESTION_SOURCE` | Defaults to `live`; use `fixture` only for local preview/demo copy or `live_or_fixture` for explicit fallback |
| `AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS` | KV/memory TTL for safe public question lists; default `300` |
| `AGENT_BRIDGE_MAX_QUESTIONS_PER_SESSION` | Max public questions returned to Telegram; default `20` |
| `AGENT_BRIDGE_QUESTION_SCAN_BLOCKS` | Recent-block fallback window used only when `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN=1`; default `130000` |
| `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK` | Optional manual scan bounds for faster live smoke runs |
| `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN` | Emergency/debug only. Allows recent-block fallback when session metadata has no `blockLimits.start`; leave unset for normal live smoke |

## Interactive Preview

`GET /mock/telegram/preview` serves a small browser preview for the private demo
worker. It exercises the same command and callback builder as the Telegram
webhook through `POST /mock/telegram/preview-update`, but it never calls the
Telegram Bot API. Use it to tune group/private copy, inline keyboards, callback
navigation, and future Mini App payloads before setting or reusing the live
webhook.

The preview is mock-only: it should render safe display text and opaque action
IDs, not raw grants, private answers, keys, Cloudflare credentials, or Telegram
bot tokens. Mini App work should keep using the same opaque action IDs and move
private form/input flows into the Mini App lane rather than Telegram group
messages.

## Deploy Helper Plan And Apply

The product flow should not require manual Wrangler. The current
operator UX is `/telegram-demo-setup`: it selects a CE session, pulls
`CE_SESSION_WORKER_BASE_URL` and `DEFAULT_CHAIN_ID` from that session when
available, preserves the default OP Sepolia POKT/PATH RPC, accepts optional
additional RPC fallback input, generates `TELEGRAM_WEBHOOK_SECRET` and
`DEMO_SIGNER_ROOT_SECRET`, derives the Workers.dev public URL, and creates a
redacted deploy plan. Wrangler remains a developer fallback only.

This slice adds a planning/validation helper:

```bash
cd workers/agentBridgeWorker
npm run deploy:plan -- --worker-name ce-agent-bridge-worker --workers-subdomain <workers-subdomain>
```

The helper accepts `CLOUDFLARE_API_TOKEN` and the required Telegram/session vars
from local environment, prints only redacted secret presence, and models the
direct Cloudflare API calls still needed. `CLOUDFLARE_ACCOUNT_ID` is no longer a
required pasted value; the helper models account lookup as
`GET /accounts?per_page=2`, accepts exactly one visible account, and blocks if
multiple accounts are visible because account selection is not implemented yet:

- Workers script upload with vars and bindings.
- KV namespace for opaque action IDs and webhook replay cache.
- R2 bucket for demo artifacts only when `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true`
  or `--enable-doc-storage`.
- D1 database for event/audit/index records only when
  `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` or `--enable-doc-storage`.
- SQLite-backed Durable Object binding and migration for managed demo
  signer/runtime.
- Worker secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `DEMO_SIGNER_ROOT_SECRET`.
- Worker vars: `TELEGRAM_BOT_USERNAME`, `AGENT_BRIDGE_PUBLIC_URL`,
  `CE_SESSION_WORKER_BASE_URL`, `DEFAULT_CHAIN_ID`, `DEFAULT_RPC_URL`, and
  optional `ADDITIONAL_RPC_URL`.
- Script-level Workers.dev enablement for
  `https://<worker-name>.<workers-subdomain>.workers.dev`.

The default Telegram smoke token needs Workers Scripts, Workers KV, and Durable
Objects edit scopes. R2 and D1 edit scopes are needed only when bridge-owned
demo doc/artifact storage is explicitly enabled. `Account Settings: Edit` is
needed only when the helper must create or change the account-level workers.dev
subdomain; if the account already has a workers.dev subdomain, the first demo
can omit that broader scope and just enable the script on Workers.dev.

By default, `deploy:plan` is offline and does not call Cloudflare. To verify
account derivation immediately before a live smoke, opt in explicitly:

```bash
cd workers/agentBridgeWorker
AGENT_BRIDGE_LIVE_ACCOUNT_LOOKUP=1 npm run deploy:plan -- --workers-subdomain <workers-subdomain>
```

or:

```bash
npm run deploy:plan -- --workers-subdomain <workers-subdomain> --live-account-lookup
```

That opt-in performs only `GET /accounts?per_page=2` with the local
`CLOUDFLARE_API_TOKEN`. The token is never printed. Zero or multiple visible
accounts make validation fail; do not work around that for the first demo except
with the documented developer-only `CLOUDFLARE_ACCOUNT_ID` fallback.

The apply helper reads `.dev.vars` directly and is still safe to run without
deploying because dry-run is the default:

```bash
cd workers/agentBridgeWorker
npm run deploy:apply
```

The live path requires explicit opt-in:

```bash
npm run deploy:apply -- --apply
```

`--apply` performs the direct Cloudflare and Telegram calls modeled by
`deploy:plan`: account lookup when needed, workers.dev subdomain lookup, KV
create-or-reuse, optional R2/D1 create-or-reuse for doc storage, module worker
upload, Worker secret writes, workers.dev script enablement, Telegram
`setWebhook`, and `/health` verification. Tests keep these network calls mocked
unless the operator runs the command with `--apply`.

Useful guarded variants:

```bash
npm run deploy:apply -- --apply --skip-telegram-webhook
npm run deploy:apply -- --apply --skip-health-check
npm run deploy:apply -- --apply --enable-doc-storage
```

## Live Smoke Checklist

Everything below uses user-provided live values from untracked `.dev.vars` or a
temporary shell environment. Avoid passing secrets as command-line flags because
shells may persist history. Do not commit generated `.env`, `.dev.vars`,
`dev.vars`, `wrangler.toml`, real tokens, bot tokens, webhook secrets, signer
root secrets, account IDs, RPC URLs with private keys, or Cloudflare resource
IDs.

1. Create the Telegram bot in BotFather and record `TELEGRAM_BOT_TOKEN` plus
   `TELEGRAM_BOT_USERNAME` without `@`.
2. Create a scoped Cloudflare token with Workers Scripts, Workers KV, and
   Durable Objects edit scopes. Add R2 and D1 edit scopes only when testing
   bridge-owned doc/artifact storage with `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true`
   or `--enable-doc-storage`. Add `Account Settings: Edit` only when the
   account-level workers.dev subdomain must be created or changed.
3. Open `/telegram-demo-setup`, select the CE session, paste the Telegram and
   Cloudflare values, keep the default OP Sepolia POKT/PATH RPC, optionally add
   a second OP Sepolia RPC fallback, enter the workers.dev subdomain, and build
   the redacted plan.
4. Populate untracked `workers/agentBridgeWorker/.dev.vars` with the live values.
   Run `npm run deploy:plan` once offline, then run `npm run deploy:apply` once
   as a dry-run. Use `--live-account-lookup` only when you want the plan command
   to make the account lookup call before applying.
5. Run `npm run deploy:apply -- --apply`. The helper creates or reuses KV,
   uploads the module worker, writes deployed Worker secrets, enables the
   workers.dev script route, sets the Telegram webhook with
   `secret_token=<TELEGRAM_WEBHOOK_SECRET>`, and verifies
   `$AGENT_BRIDGE_PUBLIC_URL/health`. It does not touch R2/D1 unless doc
   storage is explicitly enabled.
6. If the Cloudflare token cannot read the account workers.dev subdomain, paste
   `CLOUDFLARE_WORKERS_SUBDOMAIN` and `AGENT_BRIDGE_PUBLIC_URL` into `.dev.vars`
   and re-run the dry-run before applying.
7. Keep `--skip-telegram-webhook` or `--skip-health-check` only for diagnosis;
   the normal live smoke should run both.
8. Confirm the deployed `/health` output reports `worker: agentBridgeWorker`.
9. Smoke Telegram private chat `/start`, group `/ce_join <session>`,
   `/ce_sessions`, `/ce_questions`, `/q <number-or-id>`, `/ce_docs`, and
   private `/ce_me`.
10. Confirm replies contain only safe summaries and opaque `cecb_*` / `cetg_*`
    action IDs, no raw callback payloads, grants, JWTs, Cloudflare credentials,
    private keys, RPC secrets, document paths, or private/gated text.

Still mocked or contract-only for this first smoke:

- `/telegram-demo-setup` does not deploy the worker or set the Telegram webhook.
- `deploy:plan` creates no KV, R2, D1, Durable Object, Worker upload, secret, or
  webhook resources; the only optional live call is account lookup. Use
  `deploy:apply -- --apply` for the live resource and webhook path.
- Live public question reads use the Telegram worker-local cache for now; docs
  still use configured demo fixtures unless the canonical `/api/agent/*`
  session contract is wired for that route.
- OpenClaw/MCP forwarding is contract-only; no real external OpenClaw HTTP/MCP
  transport is sent from this worker.
- Broadcast remains disabled.
- Cloudflare `lit_encrypted` envelope production/reading is later storage
  hardening and is not part of the immediate Telegram smoke.

## Normal Session Submit

Managed Telegram demo accounts can submit to normal CE sessions when the linked
session is available, ordinary join/SBT gates pass, session policy allows
managed demo submit, and the scoped grant includes `direct_submit_response`. If
that direct path is denied, the worker creates a canonical submit request or
draft. Group summaries include only status/count refs; response text and account
state stay private.

## Mock OpenClaw Forwarding

`openclawForwarding.mjs` models contract-only forwarding for delivered questions,
drafts, submit requests, approvals, failures, and final status. Envelopes contain
safe summaries, opaque refs, and canonical `/api/agent/*` routes only. Real
OpenClaw HTTP/MCP transport is deferred.

## Question Cards

Telegram question cards follow CE control conventions:

- Binary/agree-style questions use `Agree`, `Unsure`, and `Disagree`.
- Rating questions render discrete `0` through `10` buttons.
- Single-select multichoice questions render single-select option buttons.
- Multi-select multichoice questions preserve per-option selected state.
- Freeform questions expose `Type` and `Voice`.
- Additional comments are always present, microphone is present when supported, and docs/context appears only when docs exist or are relevant.

## Local Checks

```bash
cd workers/agentBridgeWorker
node --test *.test.mjs
```
