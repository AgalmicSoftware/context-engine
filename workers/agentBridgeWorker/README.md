# Agent Bridge Worker

`workers/agentBridgeWorker/` is the private Telegram demo bridge worker. It is separate from `workers/sessionCorsWorker/` and must stay publicly stripped while the demo lane is private.

## Boundary

- `/api/agent/*` remains the canonical Context Engine agent contract.
- `agentApiCatalog.mjs` is the Telegram-facing capability registry for
  canonical `/api/agent/*` requests, required fields, safe lanes, and handoff
  status.
- Telegram group chats are public lobbies for safe session/question/doc summaries.
- Private chat or Mini App surfaces are the account/action lane.
- Callback data, deep-link payloads, CloudStorage, Mini App payloads, and persistent chat state use opaque action IDs or safe display text only.
- Smart-contract broadcast is enabled by default for deterministic managed
  Telegram demo accounts, but still requires session policy to allow
  managed-account submit plus live worker/RPC/Surveys config or the OP Sepolia
  Surveys default. Set
  `AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED=false` or `BROADCAST_ENABLED=false` to
  force canonical submit-request records instead of broadcasting.

## Managed Demo Accounts

Managed Telegram demo accounts are deterministic by Telegram principal plus worker deployment. Signing happens through the `ManagedDemoSignerDurableObject` boundary and returns a testnet/demo signed envelope. The normal account metadata never serializes raw key material.

`export_demo_key` and `recover_demo_key` are explicit private-only demo actions. They reject passkey, Porto, CE-CC local, linked external wallet, and production modes.

## Agent API Catalog

The bridge exposes a scaffolded Telegram agent surface through
`agentApiCatalog.mjs`. New Telegram/Web UX capabilities should be added by
registering a catalog entry, then wiring a command or Mini App control to that
entry. The worker should create or forward canonical request envelopes; it
should not reimplement web UX business logic.

Initial Telegram-facing capabilities:

| Capability | Canonical request | Safe Telegram lanes | Status |
| --- | --- | --- | --- |
| Action menu | `GET /api/agent/actions` | group, private, Mini App | catalog scaffold |
| Managed demo account setup | `POST /api/agent/accounts/create` | private, Mini App | implemented canonical handoff |
| Account summary | `GET /api/agent/accounts/me` | private, Mini App | worker-local until canonical |
| Settings overview | `GET /api/agent/settings` | private, Mini App | planned contract-only |
| Settings update | `POST /api/agent/settings/update-request` | private, Mini App | pending canonical handoff |
| Questions | `GET /api/agent/questions` | group, private, Mini App | worker-local index until canonical |
| Response submit request | `POST /api/agent/responses/submit-request` | private, Mini App | direct on-chain when enabled; otherwise pending canonical handoff |
| SBT claim/create, decrypt, storage access, OpenClaw events | existing `/api/agent/*` routes in the catalog | private or Mini App unless explicitly group-safe | planned or contract-only |

Settings updates currently accept only safe structured fields such as
`draftStyle` (`concise`, `balanced`, `detailed`) and `telegramReminders`.
Freeform profile text, credentials, grants, keys, JWTs, gated content, and other
private inputs must stay behind opaque refs collected in private chat or the
Mini App.

## Telegram Screens

Every `telegram_screen_state` carries launch metadata: a command, an opaque callback, or the `t.me/<bot>?start=<opaque-action-id>` deep link template.

| State | Launch |
| --- | --- |
| `setup_welcome`, `test_checklist` | `/start` |
| `agent_action_menu` | `/actions`, `/agent`, or `callback:<opaque-action-id>` |
| `agent_account_create` | hidden `/create_agent` compatibility command, `callback:<opaque-action-id>`, or `t.me/<bot>?start=<opaque-action-id>` |
| `agent_settings_overview` | `/settings`, `callback:<opaque-action-id>`, or `t.me/<bot>?start=<opaque-action-id>` |
| `agent_settings_edit` | `/settings` edit callback or Mini App |
| `group_session_card`, `account_created` | `/join` |
| `private_start` | `/start <opaque-action-id>` or `t.me/<bot>?start=<opaque-action-id>` |
| `question_list` | `/questions` |
| `pose_question` | `/pose_question`, `/q`, deprecated `/drop_question`, or `callback:<pose_question_action>` |
| `generated_question_candidates` | `/generate_questions` |
| `my_account`, `joined_sbts` | `/me` or `/account` |
| SBT join/create states | `/sbt <sbt-address-or-group-id-or-link>`, `/join_sbt <sbt-address-or-invite-code-or-link>`, `/create_sbt_group [session-slug]` |
| `onboarding` | `/onboarding` |
| question cards | `/questions` |
| `doc_library`, `doc_detail` | `/attachments`; alias `/docs` |
| `generate_questions` | `/generate_questions` |
| `account_recovered` | `/recover_key` |
| confirmation, submitted, draft, retry states | opaque callback actions |

The group session-linked card says `Session: <session>` and exposes `Join Session`, `View Questions`, `Attachments`, and policy-allowed `Pose Question`. `View Questions` is the group-lobby default action. `Join Session` opens private chat and routes participants without a configured account to private account setup. Group messages remain safe public summaries only and never include account state, private answers, keys, grants, or gated/private document contents.

`View Questions` reads the linked session through the bridge's worker-local
materialized question index for now. Canonical `GET /api/agent/questions`
remains the target contract once a reachable agent API base is deployed for the
bridge.
`Pose Question` uses `/pose_question` or `/q` to pose one existing or
generated question to the group. If no selector is provided, the action opens a
choose-question menu instead of silently posing the first question. Anyone in
the linked group may pose a question; the worker still enforces session
linkage, opaque action ids, idempotent action refs, and public-safe output. The
old `/drop_question` command is only a deprecated compatibility alias.
Private or gated question text is never posed to the group; group output shows a
locked/encrypted state, carries any public SBT gate requirements, and routes
eligible accounts to private chat or Mini App.

The Telegram question list keeps full prompt text in the message body and uses
compact `Pose <number>` buttons so Telegram does not truncate the prompts. It
starts with `Questions (<shown>/<total>)` and omits extra instruction copy. A
posed public question starts with the prompt text, omits redundant
option/instruction text, and labels its return action `Other Questions`. Binary
question buttons render `Agree` / `Disagree` on the first row and `Unsure`
underneath.

`/me` shows an abbreviated managed address as an inline chain-explorer link and
renders known chains by name, for example `OP Sepolia Testnet (11155420)`.

Account-created screens do not include `Open in CE`. Optional onboarding uses: `Enter startup info so I can suggest answers for you.` Confirmation copy is `Submit this response?` with `Save draft` and `Edit`.

## Bot Commands

Core Telegram commands:

- `/start` opens the concise help entry point and shows only the `Mini App`
  control when configured. `Questions` and `Sessions` remain available as
  commands rather than welcome-screen buttons. If the user has not selected a
  private session yet, the Mini App launch opens the session picker first.
- `/sessions`, `/questions`, `/q <number>`,
  `/results`, `/results consensus`, `/results group`, `/attachments`, `/docs`,
  `/me`, and `/account` keep their existing session/question/document/account
  behavior. Plain `/results` explains the `consensus` and `group` views and
  renders buttons for both modes; mode-specific results attempt to upload a
  rendered PNG card with a beeswarm view for consensus and a participant graph
  for group results, using demo data until enough live overlap exists. The
  beeswarm view pages through the top three differentiating questions at a
  time, and the participant graph exposes per-group analysis buttons that use
  the selected session worker's sponsored AI route when available.
- `/export_all [session]` is private-chat only and sends a zip archive of
  Cloudflare-backed response payloads for the selected session. The caller's
  managed Telegram ETH address must be allowlisted with
  `AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES` or the session policy fields
  `responseExportAllowedAddresses` / `telegramResponseExportAllowedAddresses`.
  Allowlisted accounts also see an `export_all` inline button in private bot
  surfaces such as `/start` and `/me`. If the selected session has Telegram
  submit records but the session worker cannot list Cloudflare payload bytes
  because it resolves to a non-Cloudflare tenant, the export still sends a
  partial zip with `responses.json` synthesized from the Cloudflare KV submit
  records, `telegram-submit-records.json`, and a manifest entry for the
  storage-list error. Each synthesized response keeps its submit status,
  answer, question id, account/storage refs, and timestamp so failed and
  direct-submitted attempts are distinguishable.
- `/export_access [session]`, `/export_allow 0xAddress [session]`, and
  `/export_revoke 0xAddress [session]` are private-chat only admin commands for
  response export access. Only addresses configured in the Worker env or session
  policy are root export admins; admins can add or remove additional exporters
  in Worker KV without redeploying. Added exporters can run `/export_all` but
  cannot add other exporters.
- `/actions`, `/settings`, and `/join <session>` remain accepted for backward
  compatibility, but `/start` and the registered Telegram command menu no
  longer advertise them. Session selection is through `/sessions`.

`/create_agent` remains accepted as a compatibility command, but the bot and
Mini App no longer advertise a `Create Agent` button. Joining a session derives
the managed demo account when needed.

Legacy `/ce_*` command names are still accepted as hidden aliases during the
bot-v1 transition, but help text and launch metadata use the unprefixed command
names above.

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

SBT commands accept explicit public targets: `/sbt <sbt-address-or-group-id-or-link>`,
`/join_sbt <sbt-address-or-invite-code-or-link>`, and
`/create_sbt_group [session-slug]`. Public SBT addresses, group ids, and share
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

## Attachments

The worker contract models R2 document bytes, D1 metadata/index status, and KV short-lived action records. The default live Telegram smoke binds only KV plus the Worker/Durable Object runtime; bridge-owned R2/D1 resources are opt-in with `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` or `--enable-doc-storage`. Supported file types are:

- Markdown: `md`
- PDF: `pdf`
- Images: `png`, `jpg`, `jpeg`, `webp`

Public summaries include titles, file types, visibility, and index status.
Private or SBT-gated contents are never included in group-safe summaries.

The attachment button copy is `Attachments`. `/attachments` is the preferred
command; `/docs` remains an alias during bot-v1 smoke. Selected files
are recorded as inputs for `Generate Questions` and as future `Use as Answer
Context` candidates. Private or gated files should open through the Mini App
once that surface is wired. Generating questions without selected files returns
`Select or upload attachments before generating questions.`

Storage profile selection belongs to session config, not Telegram.
`arweave` remains the default profile. `cloudflare` is an explicit session
storage profile where the session/general worker can enforce SBT gates before
issuing upload permissions, snippets, short-lived reads, or download bytes. Lit
is required only when the session profile selects `lit_encrypted` and the
payload itself is intentionally Lit/client encrypted. The default Cloudflare
payload access mode is `worker_sbt_gate`, which is worker-enforced access
control and not end-to-end encryption. `public_read` keeps canonical payloads
in Cloudflare but serves read/list requests without wallet auth; writes still
require the session worker. This is the intended mode for public Telegram
question prompts that should behave the same in the bot, Mini App, and CE
client.
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
| Optional question cache tuning | `AGENT_BRIDGE_RPC_TIMEOUT_MS`, `AGENT_BRIDGE_QUESTION_PAYLOAD_TIMEOUT_MS`, `AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS`, `AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY`, `AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS`, and explicit `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK` tune the Telegram worker-local index. Defaults are sufficient when session metadata includes `blockLimits.start` or the registry exposes `SessionCreated` for the slug. `AGENT_BRIDGE_QUESTION_STORAGE_BACKEND=cloudflare` is a debug override; normal deployments derive Cloudflare question reads from the session storage profile |
| Optional response export allowlist | `AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES` is a comma-separated or JSON-array list of managed Telegram ETH addresses allowed to use `/export_all` and manage added exporters. Session policy can also use `responseExportAllowedAddresses` or `telegramResponseExportAllowedAddresses` for per-session root admin allowlists. Root admins can grant additional session-scoped exporters through `/export_allow` without changing config |
| Cloudflare account ID | Do not ask the operator to paste this in product setup. `/telegram-demo-setup` and `deploy:plan` derive the account from `CLOUDFLARE_API_TOKEN`; if multiple accounts are visible, setup blocks because account selection is not implemented yet. `CLOUDFLARE_ACCOUNT_ID` is a developer fallback only |
| Cloudflare API token | Put in untracked local env as `CLOUDFLARE_API_TOKEN`; never commit it. The planning helper validates presence and prints only redacted status |
| KV namespace | `deploy:apply -- --apply` creates or reuses and binds as `AGENT_ACTION_KV` for opaque callback/action IDs and replay cache |
| R2 bucket | Optional. `deploy:apply -- --apply --enable-doc-storage` or `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` creates or reuses and binds `AGENT_DOCS_R2` for bridge-owned demo artifacts/doc bytes |
| D1 database | Optional. `deploy:apply -- --apply --enable-doc-storage` or `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` creates or reuses and binds `AGENT_DOCS_D1` for bridge-owned event/audit/index records |
| Durable Object binding | `deploy:apply -- --apply` binds `MANAGED_DEMO_SIGNER` and includes the SQLite-backed `ManagedDemoSignerDurableObject` migration |
| Draft-generation AI policy | `AGENT_AI_PROVIDER=ce_session_policy`; use sponsored/session AI through allowed session policy and do not duplicate canonical session secrets in this worker |

`deploy:apply -- --apply` sets the webhook and Telegram slash-command menu
automatically. The visible command menu advertises the active
session/question/result/account commands and omits legacy `actions`, `settings`,
and `join`. For manual webhook diagnosis, the equivalent Telegram API call is:

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
`callback_query` updates, handles `/start`, `/actions`, `/agent`,
hidden `/create_agent` compatibility commands, `/settings`, `/join <session>`, `/sessions`,
`/questions`, `/pose_question`, `/q`, `/results`, `/results consensus`, `/results group`,
`/attachments` or alias `/docs`, and `/me`, answers callback queries to clear Telegram's
inline-button loading state, and sends replies through an injected Telegram Bot
API adapter. Unit tests use mocked `fetch` and fake bot tokens; real
`TELEGRAM_BOT_TOKEN` is needed only for live Telegram smoke.

Callback data and private deep-link start payloads are opaque `cecb_*` or
`cetg_*` identifiers. Private payloads, JWTs, worker tokens, account material,
private keys, and Cloudflare credentials must never be placed in Telegram
callback data.

The command handler uses `AGENT_BRIDGE_SESSION_POLICY_JSON` as an explicit
demo/session-policy override when it is configured. Without that override, the
live Worker reads the real OP Sepolia `SessionRegistry` over `DEFAULT_RPC_URL`
plus optional `ADDITIONAL_RPC_URL` fallback and uses the returned slugs for
`/sessions` and `/join`. Those commands force a fresh registry read so new
sessions are not hidden behind the short-lived Worker cache; capped registry
lists use the newest session window. `/sessions` displays only
Telegram-enabled sessions (`telegramBridgeEnabled=true`), hides `e2e`-named
smoke-test sessions as a temporary cleanup heuristic, and paginates tall
inline-keyboard lists with `Load Next`. Group session selection through
`/sessions` or `/join <session>` persists the chat's selected session in
`AGENT_ACTION_KV`, so later `/questions`, `/q <number>`, `/results`, and
`/attachments` use that session without repeating the slug. It also stores that
selected session for the Telegram user who made the selection, so their private
bot and Mini App flows start from the same session. Private `/join <session>`
persists the selected session for that Telegram user as well, so private
`/questions`, `/q <number>`, and `/results` use the same session unless a
command supplies an explicit slug. When a participant answers a posed group
question before opening a private chat, the worker derives or reuses their
managed Telegram demo account on demand and binds that question's session to
the user. If a session cannot direct-submit because policy, gate, faucet, or
worker auth is missing, the worker still stores the draft/submit request and
routes follow-up setup through private chat or the Mini App.
`/docs` remains a compatibility alias.

Question lists default to live mode. Bot messages show at most five question
rows at a time, separate displayed rows with a blank line, keep safe prompt or
status text in the message body, use compact `Pose <number>` buttons, add a
`Load Next` button when additional rows are available, and hide question IDs
from user-facing copy. Payload-unavailable rows say that the question prompt
failed to load, SBT/worker-gated rows say `Requires session access`, and
Lit-encrypted rows say `Encrypted question`. The first `/start` screen links to
the Mini App session picker; `/questions` itself stays focused on posing
questions. The presentation order keeps answerable public questions ahead of
true locked rows, and keeps payload-unavailable placeholders last so broken
recent payloads do not hide usable questions. The
Telegram worker owns a worker-local
materialized question index for Telegram/agent delivery: it scans scoped
`QuestionsAdded` logs, reads question payload pointers, stores Telegram-usable
question records in memory plus `AGENT_ACTION_KV`, and resumes from the indexed
block range instead of rescanning the whole session on every command. Registry
reads fall through empty/stale RPC tuple responses to the additive fallback RPC,
Arweave metadata/payload reads try multiple gateways, and Cloudflare-backed
question pointers are read through the configured session worker `/storage/read`
route with a managed demo account when the session storage profile selects
Cloudflare. On a cold session it
returns the first available question records as soon as they are loaded, then
uses the Worker background task lane to finish indexing the full session block
window. When a loaded question payload explicitly names a different session
slug, the Worker skips it instead of materializing it under the selected
session. If a question ID and payload pointer are visible on-chain but the
payload gateway is unavailable, the bot shows an unavailable/retryable row
instead of a private/encrypted lock. That state is an availability signal, not
proof that the question was encrypted. When the payload is reachable but masked
by Lit/SBT encryption, the bot and Mini App label it as encrypted and surface
the public SBT addresses required to decrypt without exposing plaintext.
Payload-unavailable cache records are retried from the on-chain pointer on
refresh, and unavailable caches are refreshed before the bot returns them even
when the cache TTL has not expired.
RPC/log/hash failures are reported as source errors instead of cached as empty
lists. Session scans prefer metadata
`blockLimits.start`; when metadata is unavailable, the Worker derives a scoped
start block from that slug's `SessionCreated` event. Explicit scan bounds are
still available for debug/repair runs, and unscoped recent-block fallback
requires `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN=1`. The index is a Telegram
performance/materialized-view layer only; `sessionCorsWorker` and canonical
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
| `AGENT_BRIDGE_RPC_TIMEOUT_MS` | Per-RPC timeout before trying the next configured RPC URL; default `5000` |
| `AGENT_BRIDGE_QUESTION_PAYLOAD_TIMEOUT_MS` | Per-gateway timeout for question payload JSON reads; default `2500`. If all gateways miss but an on-chain pointer exists, Telegram shows an unavailable/retryable row instead of inventing a prompt |
| `AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS` | Freshness TTL before a cached Telegram question index schedules a background refresh; default `300` |
| `AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY` | Concurrent payload reads while materializing question records; default `4` |
| `AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS` | Maximum log chunks scanned before replying on a cold Telegram request; default `1`, with the rest completed through Worker background indexing |
| `AGENT_BRIDGE_QUESTION_STORAGE_BACKEND` | Optional debug override for question payload pointers. Leave unset in normal deployments so session metadata selects Arweave or Cloudflare |
| `AGENT_BRIDGE_QUESTION_SCAN_BLOCKS` | Recent-block fallback window used only when `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN=1`; default `130000` |
| `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK` | Optional manual scan bounds for faster live smoke runs |
| `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_SCAN` | Emergency/debug only. Allows recent-block fallback when neither metadata nor `SessionCreated` can scope the session; leave unset for normal live smoke |
| `AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW` | Local/operator debug only. Enables `/mock/telegram/preview` and `/mock/telegram/preview-update`; leave unset in live deployments |

## Interactive Preview

`GET /mock/telegram/preview` serves a small browser preview for the private demo
worker. It exercises the same command and callback builder as the Telegram
webhook through `POST /mock/telegram/preview-update`, but it never calls the
Telegram Bot API. Use it to tune group/private copy, inline keyboards, callback
navigation, and future Mini App payloads before setting or reusing the live
webhook.

The preview routes are disabled unless `AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW`
is set to `true`. Leave this unset in live deployments; preview callbacks can
create the same short-lived KV action records as real bot callbacks.
The product deploy helper intentionally omits this local-only flag from Worker
upload metadata and rejects configs that try to include it.

The preview is mock-only: it should render safe display text and opaque action
IDs, not raw grants, private answers, keys, Cloudflare credentials, or Telegram
bot tokens. Mini App work should keep using the same opaque action IDs and move
private form/input flows into the Mini App lane rather than Telegram group
messages.

## Mini App

The Worker serves a v0 Telegram Mini App at:

```text
GET  /telegram/mini-app
GET  /telegram/mini-app/api/state?launch=<opaque-cecb-id>
POST /telegram/mini-app/api/draft
POST /telegram/mini-app/api/clear-drafts
POST /telegram/mini-app/api/transcribe
POST /telegram/mini-app/api/search
POST /telegram/mini-app/api/settings
```

The bot opens the Mini App with Telegram inline `web_app` buttons in private
chat. Group chat buttons carry the same opaque launch through
`t.me/<bot>?start=<cecb_*>` and render the private `web_app` button after the
user opens the bot. Launch URLs carry only an opaque `cecb_*` action ID that
maps back to `AGENT_ACTION_KV`; raw question IDs, grants, answers, and private
session context stay server-side.
`AGENT_BRIDGE_MINI_APP_URL` may override the default
`$AGENT_BRIDGE_PUBLIC_URL/telegram/mini-app`. The URL must be HTTPS for live
Telegram, except localhost during local development.
When Telegram init data validates in live mode, the state and draft APIs require
a valid opaque launch action and will not fall back to a default session for
missing or expired launch parameters. Draft writes also verify that the launch
session, and question when scoped, matches the server-side question action.

The Mini App backend validates raw `Telegram.WebApp.initData` with the
configured `TELEGRAM_BOT_TOKEN` before generating stateful question actions or
trusting Telegram user/chat/session identity on write endpoints. Treat
`initDataUnsafe`, `web_app_data`, and all browser-submitted fields as untrusted
client input until validated server-side.
When `TELEGRAM_BOT_TOKEN` is absent, local tests/previews use a preview auth
principal. When the bot token is configured, Mini App init data is always
required; there is no deployable preview-auth bypass.
`AGENT_BRIDGE_MINI_APP_AUTH_MAX_AGE_SECONDS` controls accepted init-data age and
defaults to 24 hours.

Current v0 scope:

- Agent/account/settings action surface backed by the catalog, including safe
  settings inputs for `draftStyle` and `telegramReminders`. The Mini App keeps
  `showUnansweredFirst` as a local filter preference behind the filter button.
- Start and joined-session launches expose the same session picker directly
  under the Mini App title. The picker
  lists Telegram-enabled sessions only, supports multi-select, keeps the joined
  session preselected when present, and then loads questions across the selected
  sessions with each question action still scoped to its server-side session
  context. If a launch points at a session that is no longer selectable by the
  deployed session policy, the Mini App falls back to the session picker rather
  than attempting a mismatched session-worker login. When the user continues
  with a selected session set, the picker collapses into a compact top summary;
  joined-session launches start in that collapsed state.
- Native freeform, binary, rating, and multichoice answer forms rendered inline
  on each displayed question card in one document-scroll question list. The Mini
  App does not render question IDs or a `Create Agent` launcher; filters and
  settings are opened from the top-right filter and gear buttons.
  Session question count text is intentionally a single answerable-question
  count rather than a split loaded/indexed diagnostic.
- The filter panel includes unanswered-first ordering, question type filters
  including freeform questions, and an AI-backed question search that ranks
  matching loaded prompts through the session worker `/ai` route when sponsored
  AI is available. It falls back to local semantic keyword matching when AI is
  unavailable, auto-applies as the user types, and only shows `Clear` when
  there is search text. The search field can also use the microphone icon;
  transcribed search text is applied to the loaded-question filter immediately.
- Additional comments include microphone/stop icon buttons. The Mini App first
  records with `MediaRecorder`, shows recording/transcription/error feedback in
  the comments textarea rather than duplicating it in the status bar, and sends
  the audio to
  `POST /telegram/mini-app/api/transcribe`, which validates Telegram init data,
  checks `sponsoredAiAllowed`, and forwards the audio to the session worker
  `/transcribe` route with the managed Telegram account. Comment dictation
  verifies the server-side question action; AI-search dictation can use a
  selected session slug without a question action. The final authenticated
  transcribe upload omits the browser `Origin` header because it is a
  server-to-server request and session worker CORS allowlists are for browser
  callers. If a single-tenant session
  worker rejects the Telegram session slug because its own
  `DEFAULT_SESSION_SLUG` differs, the bridge retries worker auth without an
  explicit slug so the worker can use its configured tenant. Operators can also
  set per-session `workerSessionSlug` / `sessionWorkerSlug` in
  `AGENT_BRIDGE_SESSION_POLICY_JSON`. Browser Web Speech remains a fallback for
  webviews without `MediaRecorder`.
- Previously saved draft answers are returned by state as
  `draftAnswersByQuestionKey` and hydrate the matching question cards on load.
  The gear/settings panel also lists saved draft response labels and can clear
  visible saved drafts through `POST /telegram/mini-app/api/clear-drafts`.
  Submitted-answer history is tracked separately from drafts, so clearing
  drafts only removes unsubmitted answers. The filter panel's
  `showUnansweredFirst` preference defaults to true and orders saved or
  submitted answered questions after unanswered questions on first load.
- The Mini App keeps polling state while no answerable questions are available
  and questions are still empty, the question source reports an error, or only
  payload-unavailable question rows are present. Mixed answerable/unavailable
  lists stay usable without a foreground retry loop.
- Draft saves through `POST /telegram/mini-app/api/draft`.
- Settings saves through `POST /telegram/mini-app/api/settings`, which creates a
  Worker-local `telegram:agent-request:*` record and a planned canonical
  `/api/agent/settings/update-request` envelope. It does not execute the live
  settings backend yet.
- `submit=true` attempts direct on-chain submit by default when the session has
  a worker URL and Surveys address, and session policy allows managed Telegram
  demo submit. The worker authenticates the managed account to the session
  worker, requests faucet gas when `sponsoredFaucetAllowed=true`,
  uploads the response payload through the session worker `/storage/upload`
  route, waits briefly for newly requested faucet gas to appear on the managed
  account, and calls `Surveys.submitResponses` with the returned
  bytes32-compatible storage reference. The session worker chooses Cloudflare or
  Arweave from the session storage profile. Transaction broadcast tries the
  configured default RPC first, then additive fallback RPC URLs such as
  `ADDITIONAL_RPC_URL`. If
  direct submit is not configured, it creates the same Worker-local submit
  request with an opaque request ID and canonical
  `/api/agent/responses/submit-request` handoff as before. Exact answer replays
  for the same Telegram user, session, and question reuse the same idempotent
  request ID; changed answers create distinct records. Failed direct-submit
  records are retried on the next identical submit instead of replaying a stale
  auth or broadcast failure.
- `/export_all` authenticates the caller's managed Telegram wallet to the
  session worker, lists Cloudflare `responses` storage refs, reads each payload,
  joins the payloads with Worker-local `telegram:submit-request:*` metadata when
  available, and sends a zip archive containing `manifest.json`,
  `storage-items.json`, `telegram-submit-records.json`, `responses.json`, and
  per-response JSON/text files. The route is disabled for non-allowlisted
  managed ETH addresses and is useful only for sessions whose storage profile
  resolves to Cloudflare.
- Configured export admins can manage additional session-scoped exporters with
  `/export_allow` and `/export_revoke`. These managed grants are stored under
  `telegram:response-export-allowlist:v1:<sessionSlug>` in `AGENT_ACTION_KV`;
  they grant export only, not admin delegation.
- Worker login first honors per-session `workerLoginOrigin` /
  `sessionWorkerLoginOrigin` and `allowOrigins`, then tries
  `AGENT_BRIDGE_WORKER_LOGIN_ORIGIN`, `LOCAL_AUTH_ORIGIN`, and
  `AGENT_BRIDGE_PUBLIC_URL`. If a session worker rejects one candidate with
  `Origin not allowed` or a trusted-login origin error, the bridge retries with
  standard Context Engine origins such as `http://localhost:3000`,
  `https://contextengine.xyz`, and `http://localhost:7391`. Direct-submit auth
  failures return a stable reason plus the upstream worker stage/detail so
  deployment origin or gate mistakes are visible in the Mini App without
  exposing secrets. Deploy metadata includes the Cloudflare
  `global_fetch_strictly_public` compatibility flag because the live bridge
  authenticates to a session Worker over its public `workers.dev` URL.
- Payload-unavailable questions stay retryable/unanswered; true private or gated
  questions stay locked until the canonical private/gated decrypt path is
  available.

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
`setWebhook` plus `setMyCommands`, and `/health` verification. Tests keep these network calls mocked
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
9. Smoke Telegram private chat `/start`, `/actions`,
   `/settings`, group `/join <session>`, `/sessions`, `/questions`,
   `/q <number>`, `/results consensus`, `/results group`, `/attachments`, and
   private `/me`.
10. Confirm replies contain only safe summaries and opaque `cecb_*` / `cetg_*`
    action IDs, no raw callback payloads, grants, JWTs, Cloudflare credentials,
    private keys, RPC secrets, document paths, or private/gated text.

## Live Deploy Troubleshooting

- Manual `wrangler.toml` and `wrangler secret put` steps are not part of the
  product path. Keep them as developer fallback only; `deploy:apply -- --apply`
  reads untracked `.dev.vars`, writes Worker secrets through Cloudflare, uploads
  plain Worker vars, enables workers.dev, sets the Telegram webhook, and checks
  `/health`.
- After a deploy, old Telegram inline messages can still show old buttons or
  copy. Send a fresh `/questions` or `/q <number>` command instead of
  testing from an old edited message.
- If the bot receives no updates, check `getWebhookInfo`, then rerun
  `npm run deploy:apply -- --apply` so the helper resets the webhook URL and
  `secret_token`. Keep token-bearing diagnostic commands out of shell history.
- If a public question appears unavailable but the CE session is expected to be
  public, treat it first as a payload availability issue. Verify the
  question's Arweave payload pointer resolves through at least one configured
  gateway, then verify the session scan is scoped by metadata `blockLimits.start`,
  the slug's `SessionCreated` event, or explicit
  `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK`.
  New live question payloads must include canonical `sessionSlug`; no-slug
  payloads from global scans are treated as ambiguous unless
  `AGENT_BRIDGE_ALLOW_UNSCOPED_QUESTION_PAYLOADS=true` is explicitly set for a
  legacy recovery run.
- If questions from another session appear, confirm the group has a fresh
  `/join <session>` after the latest deploy and that the loaded question
  payload includes matching `sessionSlug`/`sessionName` metadata when available.
- Keep `AGENT_BRIDGE_QUESTION_SOURCE=fixture` for preview/copy work only. Live
  smoke should omit it, or use `live_or_fixture` only when a temporary fallback
  is intentional and clearly called out.

Still mocked or contract-only for this first smoke:

- `/telegram-demo-setup` does not deploy the worker or set the Telegram webhook.
- `deploy:plan` creates no KV, R2, D1, Durable Object, Worker upload, secret, or
  webhook resources; the only optional live call is account lookup. Use
  `deploy:apply -- --apply` for the live resource and webhook path.
- Live public question reads use the Telegram worker-local materialized cache
  for now; the cache can hydrate Arweave or Cloudflare-backed question payloads,
  but docs still use configured demo fixtures unless the canonical
  `/api/agent/*` session contract is wired for that route.
- Agent account/settings endpoints are scaffolded request envelopes except for
  managed account creation: `/api/agent/accounts/create` is implemented by
  CE-CC, while `/api/agent/accounts/me`, `/api/agent/settings`, and
  `/api/agent/settings/update-request` still need the canonical backend
  implementation.
- SBT command states can describe public/password join and create-group request
  envelopes, but the Mini App SBT inventory/group display and live claim/create
  execution are still planned work.
- OpenClaw/MCP forwarding is contract-only; no real external OpenClaw HTTP/MCP
  transport is sent from this worker.
- Broadcast remains testnet-managed-account only and can be disabled with
  `AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED=false` or `BROADCAST_ENABLED=false`.
- Cloudflare `lit_encrypted` envelope production/reading is later storage
  hardening and is not part of the immediate Telegram smoke.

## Normal Session Submit

Managed Telegram demo accounts can submit to normal CE sessions when the linked
session is available, ordinary join/SBT gates pass, session policy allows
managed demo submit, and the scoped grant includes `direct_submit_response`. If
that direct path is denied, the worker creates a canonical submit request or
draft. Group summaries include only status/count refs; response text and account
state stay private.

Bot v1 structured answer buttons now save a private Telegram answer draft and
then either broadcast directly or create a Worker-local submit request under
`telegram:submit-request:*` with a canonical
`/api/agent/responses/submit-request` handoff body. Older submit callbacks are
still accepted for compatibility, but new bot messages submit on answer tap. The
direct path uses only deterministic managed Telegram demo accounts on testnets;
passkey, Porto, CE-CC local, linked external wallet, and production modes remain
blocked from worker-side signing.

Private `/join <session>` also requests faucet gas for the managed Telegram
account when the session policy sets `sponsoredFaucetAllowed=true` and a session
worker URL is configured. Faucet results are kept in response metadata and logs
rather than shown in Telegram copy. If policy or worker configuration does not
allow faucet, or the session worker lacks a usable faucet key/route, join still
succeeds without funding.

Mini App direct-submit retries also request faucet gas and wait for a non-zero
managed-account balance before broadcasting the answer transaction. The wait is
tunable with `AGENT_BRIDGE_FAUCET_BALANCE_WAIT_ATTEMPTS` and
`AGENT_BRIDGE_FAUCET_BALANCE_WAIT_MS`; failed direct-submit records remain
retryable so a first-click funding race does not permanently poison the
idempotency key.

## Mock OpenClaw Forwarding

`openclawForwarding.mjs` models contract-only forwarding for delivered questions,
drafts, submit requests, approvals, failures, and final status. Envelopes contain
safe summaries, opaque refs, and canonical `/api/agent/*` routes only. Real
OpenClaw HTTP/MCP transport is deferred.

## Question Cards

Telegram question cards follow CE control conventions:

- Live CE metadata is normalized from `type`, `prompt`, `options`,
  `singleSelect`, `sessionName`, and canonical `sessionSlug`. `sessionName` is
  display metadata only; global live scans require `sessionSlug` to bind a
  question to the requested session.
- Binary/agree-style questions use `Agree`, `Unsure`, and `Disagree` answer
  buttons, matching the main client order and colors.
- Rating questions render discrete `0` through `10` answer buttons.
- Single-select multichoice questions render single-select option buttons.
- Multi-select multichoice questions preserve per-option selected state.
- Freeform questions expose `Type` and `Voice`.
- Button answers save a Telegram worker-local draft keyed by
  user/session/question and immediately attempt direct on-chain submit for
  managed Telegram demo accounts when session policy and worker configuration
  allow it. Otherwise the worker creates the canonical
  `/api/agent/responses/submit-request` handoff with an opaque request ID.
- Joining a session schedules an immediate background question fetch so the
  question list and Mini App can hydrate as soon as the session is selected.
- Additional comments are always present, microphone is present when supported,
  and docs/context appears only when docs exist or are relevant.

## Local Checks

```bash
cd workers/agentBridgeWorker
node --test *.test.mjs
```
