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

The group session-linked card says `Context Engine session linked: <session>` and exposes `Join Session`, `View Questions`, `View / Add Docs`, and policy-allowed `Pose Question`. `View Questions` is the group-lobby default action. `Join Session` opens private chat and routes participants without a configured account to private account setup. Group messages remain safe public summaries only and never include account state, private answers, keys, grants, or gated/private document contents.

`View Questions` reads the linked session through `GET /api/agent/questions`.
`Pose Question` uses `/ce_pose_question` or `/q` to pose one existing or
generated question to the group. Anyone in the linked group may pose a question;
the worker still enforces session linkage, opaque action ids, idempotent action
refs, and public-safe output. The old `/ce_drop_question` command is only a
deprecated compatibility alias. Private or gated question text is never posed to
the group; group output shows a locked state and routes eligible accounts to
private chat or Mini App.

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

The worker contract models R2 document bytes, D1 metadata/index status, and KV short-lived action records. Supported file types are:

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

Paste only local test values into `.dev.vars`. Keep real deployed secrets in
Wrangler secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put DEMO_SIGNER_ROOT_SECRET
```

Required values:

| Value | Where it goes |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` from BotFather | Paste into local `.dev.vars` only for local smoke; set as deployed Worker secret `TELEGRAM_BOT_TOKEN` |
| `TELEGRAM_BOT_USERNAME` from BotFather, without `@` | Paste into `.dev.vars` and `[vars]` in copied `wrangler.toml` |
| `TELEGRAM_WEBHOOK_SECRET` random high-entropy string | Paste into local `.dev.vars` only for local smoke; set as deployed Worker secret `TELEGRAM_WEBHOOK_SECRET`; Telegram sends it as `X-Telegram-Bot-Api-Secret-Token` |
| `DEMO_SIGNER_ROOT_SECRET` random high-entropy string | Paste into local `.dev.vars` only for local smoke; set as deployed Worker secret `DEMO_SIGNER_ROOT_SECRET` |
| Public deployed `agentBridgeWorker` URL | Paste the Workers.dev base URL into `AGENT_BRIDGE_PUBLIC_URL`, for example `https://ce-agent-bridge-worker.<workers-subdomain>.workers.dev` |
| CE/session worker base URL | Paste into `CE_SESSION_WORKER_BASE_URL`, for example `https://<session-worker>.<workers-subdomain>.workers.dev` |
| Default chain and RPC URL | Use `DEFAULT_CHAIN_ID=11155420` and preserve `DEFAULT_RPC_URL=https://op-sepolia-testnet.api.pocket.network` unless the selected session resolves another supported chain |
| Optional extra RPC URL | Put an Infura or other OP Sepolia fallback in `ADDITIONAL_RPC_URL`; this is additive and does not replace the default POKT/PATH RPC |
| Cloudflare account ID | Do not ask the operator to paste this in product setup. `/telegram-demo-setup` and `deploy:plan` derive the account from `CLOUDFLARE_API_TOKEN`; if multiple accounts are visible, setup blocks because account selection is not implemented yet. `CLOUDFLARE_ACCOUNT_ID` is a developer fallback only |
| Cloudflare API token | Put in untracked local env as `CLOUDFLARE_API_TOKEN`; never commit it. The planning helper validates presence and prints only redacted status |
| KV namespace | Bind as `AGENT_ACTION_KV` for opaque callback/action IDs and replay cache |
| R2 bucket | Bind as `AGENT_DOCS_R2` for demo artifacts/doc bytes when enabled |
| D1 database | Bind as `AGENT_DOCS_D1` for event/audit/index records when enabled |
| Durable Object binding | Bind `MANAGED_DEMO_SIGNER` and include the `ManagedDemoSignerDurableObject` migration |
| Draft-generation AI policy | `AGENT_AI_PROVIDER=ce_session_policy`; use sponsored/session AI through allowed session policy and do not duplicate canonical session secrets in this worker |

Set the webhook after deploy with placeholders only:

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
`/ce_me`, and sends replies through an injected Telegram Bot API adapter. Unit
tests use mocked `fetch` and fake bot tokens; real `TELEGRAM_BOT_TOKEN` is
needed only for live Telegram smoke.

Callback data and private deep-link start payloads are opaque `cecb_*` or
`cetg_*` identifiers. Private payloads, JWTs, worker tokens, account material,
private keys, and Cloudflare credentials must never be placed in Telegram
callback data.

The current command handler uses configured demo fixtures from optional
`AGENT_BRIDGE_SESSION_POLICY_JSON`, `AGENT_BRIDGE_DEMO_QUESTIONS_JSON`, and
`AGENT_BRIDGE_DEMO_DOCS_JSON` vars. Canonical question, response, and
session-context payloads still go through the session worker or canonical agent
APIs as that contract is promoted from demo fixtures.

## Deploy Helper Plan

The long-term product flow should not require manual Wrangler. The current
operator UX is `/telegram-demo-setup`: it selects a CE session, pulls
`CE_SESSION_WORKER_BASE_URL` and `DEFAULT_CHAIN_ID` from that session when
available, preserves the default OP Sepolia POKT/PATH RPC, accepts optional
additional RPC fallback input, generates `TELEGRAM_WEBHOOK_SECRET` and
`DEMO_SIGNER_ROOT_SECRET`, derives the Workers.dev public URL, and creates a
redacted deploy plan. Wrangler remains a developer fallback.

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
- R2 bucket for demo artifacts when enabled.
- D1 database for event/audit/index records when enabled.
- Durable Object binding and migration for managed demo signer/runtime.
- Worker secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `DEMO_SIGNER_ROOT_SECRET`.
- Worker vars: `TELEGRAM_BOT_USERNAME`, `AGENT_BRIDGE_PUBLIC_URL`,
  `CE_SESSION_WORKER_BASE_URL`, `DEFAULT_CHAIN_ID`, `DEFAULT_RPC_URL`, and
  optional `ADDITIONAL_RPC_URL`.
- Script-level Workers.dev enablement for
  `https://<worker-name>.<workers-subdomain>.workers.dev`.

The generated Cloudflare token request needs Workers Scripts, Workers KV, R2,
D1, and Durable Objects edit scopes. `Account Settings: Edit` is needed only
when the helper must create or change the account-level workers.dev subdomain;
if the account already has a workers.dev subdomain, the first demo can omit that
broader scope and just enable the script on Workers.dev.

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
