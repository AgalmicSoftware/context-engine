# Agent Bridge Worker

`workers/agentBridgeWorker/` is the Context Engine Telegram bridge worker. It is separate from `workers/sessionCorsWorker/` and ships as part of the public worker surface.

## Boundary

- `/api/agent/*` remains the canonical Context Engine agent contract.
- `/telegram/agent/api/*` remains a transition alias for existing Telegram
  installs; new docs, skills, and clients should use `/api/agent/*`.
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
- For larger events, `AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED=true` plus an
  `AGENT_RESPONSE_QUEUE` binding accepts submit records into KV with
  `submit_queued` status and settles them through the Worker queue consumer.
  The queue mode is intended for deployments that need asynchronous submit processing.

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
| Client session metadata | `GET /api/agent/session-meta` | web client, private | implemented telegram-first classification |
| Client token exchange | `POST /api/agent/client-login/exchange` | web client, private | implemented short-lived browser credential exchange |
| Response submit request | `POST /api/agent/responses/submit-request` | private, Mini App | direct on-chain when enabled; otherwise pending canonical handoff |
| SBT claim/create, decrypt, storage access, OpenClaw events | existing `/api/agent/*` routes in the catalog | private or Mini App unless explicitly group-safe | planned or contract-only |

Settings updates currently accept only safe structured fields such as
`draftStyle` (`concise`, `balanced`, `detailed`).
Freeform profile text, credentials, grants, keys, JWTs, gated content, and other
private inputs must stay behind opaque refs collected in private chat or the
Mini App.

### Agent Skill Install

Once this repo is public, a Hermes agent can install the packaged CE Telegram
handoff skill with:

```bash
hermes skills install https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md
```

For local skill hosts, choose a user-owned skill directory and use:

```bash
CE_SKILL_REF="${CE_SKILL_REF:-main}" CE_SKILL_HOME="${CE_SKILL_HOME:?Set CE_SKILL_HOME to your skill directory}" sh -c 'mkdir -p "$CE_SKILL_HOME" && curl -fsSL "https://raw.githubusercontent.com/AgalmicSoftware/context-engine/${CE_SKILL_REF}/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md" -o "$CE_SKILL_HOME/SKILL.md" && printf "Installed CE Telegram Agent Handoff skill to %s\n" "$CE_SKILL_HOME/SKILL.md"'
```

After install, the agent should use the `ce-telegram-agent-handoff` skill and
ask the user to tap `Onboard Agent` from the CE bot `/start` screen, then paste
the copied 28-day install info into the agent.

### Agent Only Mode

`agent_only_mode` is a sidecar research/evaluation lane for trusted Geo/Hermes
invites. It predicts a principal's answers and token allocations without
writing normal CE drafts, submits, question votes, posed questions, results, or
report data.

Agent-only onboarding reuses `POST /api/agent/invite/onboard` with
`"mode": "agent_only"`. The worker mints a short-lived scoped delegation token
with `agent_autofill` only, stores it under the separate
`telegram:agent-only-token:user:` pointer namespace, and leaves the normal
28-day agent token pointer untouched. Agent-only tokens default to 7 days; set
`AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS` to override.

The public start payload is `GET /api/agent/agent-only/start`. Scoped
agent-only tokens can read the current window snapshot at
`GET /api/agent/agent-only/statements`, submit predicted answers at
`POST /api/agent/agent-only/answers/bulk`, and submit linear or
quadratic allocations at
`POST /api/agent/agent-only/token-votes/bulk`. Normal delegation
tokens do not include `agent_autofill` and receive 403 on these write lanes;
agent-only tokens do not include normal read, draft, vote, or question-write
scopes. Even if an agent-only token record carries an additional read scope,
the handoff layer rejects it on non-agent-only routes and enforces the token's
minted `sessionSlug`.

Every agent-only answer, token-vote, and wrapped-image POST requires a caller
supplied `run_id`. Events remain append-only, while materialized answer/vote
state and wrapped image generation are scoped to the latest matching run id.
This lets a principal rerun Session Wrapped in the same active window
without overwriting earlier research events or accidentally reusing a prior
poster. The worker computes the active window from server-side time; public
`createdAt` query/body values are ignored for agent-only window selection.

The wrapped-image endpoint supports the standard `wrapped` PNG poster and the
optional `political_compass` PNG. MP4 story/video output is not enabled in the
current runtime skill. The old `wrapped_story` SVG storyboard path is
experimental-only and is not advertised to Hermes runs; adding real video output
requires a separate media encoder service.

Agents that only need Session Wrapped should use the dedicated narrow
skill URL instead of the broader Context Engine runtime skill:
`/api/agent/session-wrapped/skill`. That unversioned URL is the
stable QR/forwarding target; the worker redirects it to the current raw skill
with a cache-busting version parameter. That skill omits normal
question/draft/admin lanes and is intended to keep Hermes-style agents on the
prediction, allocation, and Wrapped image flow. `/agent-only/start` also returns
`visualDefaults` so operators can switch default image modes without changing
the skill: `AGENT_BRIDGE_AGENT_WRAPPED_POSTER_DEFAULT` defaults on,
`wrapped_story` is forced off until real video output exists, and
`AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT` defaults off.

The dedicated runtime skill uses adaptive low-output execution rather than a
separate reduced question deck. Small or output-limited agents still fetch and
answer every statement served by the worker, but they should keep intermediate
prediction JSON, retries, and image responses in local helper files or memory
instead of writing them into chat. Local image paths such as `clocal:` or
`/opt/data/...` are not valid delivery; agents must attach the decoded image or
display the worker `image_url`.

Rating snapshots preserve the authored scale in the proposed question record.
For example, a 1-5 rating is served to agents as a 1-5 rating schema and rejects
out-of-scale values such as `0`; 0-10 ratings continue to serve 0-10 schemas.

Operators configure flagged statements with the worker service token or a
`ceagt_...` token whose managed account is an admin for the session:

```http
GET  /api/agent/admin/agent-only/config
POST /api/agent/admin/agent-only/config
POST /api/agent/admin/agent-only/window/open
GET  /api/agent/admin/agent-only/export?view=summary&format=json
GET  /api/agent/admin/agent-only/export?view=answers&format=jsonl
GET  /api/agent/admin/agent-only/export?view=attempts&format=jsonl
```

The config is stored in `AGENT_ACTION_KV`. The active window snapshot syncs to
the current enabled `ceq_...` ids whenever the window is materialized, so newly
enabled questions can be added and archived/deleted questions can be hidden
without waiting for the next window. Existing answer/vote events remain
append-only. Historical snapshots remain stable once their window is no longer
active. The launch window defaults to `2026-06-12T08:00:00-07:00` through
`2026-06-15T08:00:00-07:00`; regular windows start Mondays at 08:00
America/Los_Angeles and use ids such as `w-2026-06-15`.

The `attempts` export is intentionally lightweight failure telemetry for
answer, vote, and wrapped-image POSTs. It records stage, status, reason,
request id, run id, mode, and counts using the pseudonymous principal id, so
operators can distinguish failed, partial, and successful runs without reading
Hermes transcripts or exposing raw Telegram ids.
The `summary` export aggregates that same attempts stream into high-level
principal and run counts, including first/latest attempt timestamps, completed
answer runs, and wrapped-image runs. It does not read answer bodies or image
records.

`POST /api/agent/admin/questions/delete` accepts the worker service
token or a `ceagt_...` token whose managed account is an admin for the session.
It manages Telegram proposed questions created under
`telegram:proposed-question:`. By default it archives `ceq_...` records with
`status: "archived"`; send `mode: "delete"` to hard-delete them from KV. Both
modes remove processed ids from the agent-only config for future snapshots, but
the currently active agent-only snapshot hides those ids on the next
materialization while preserving old research events.

```http
POST /api/agent/admin/questions/delete
Authorization: Bearer <service-or-session-admin-token>
Content-Type: application/json

{
  "sessionSlug": "session-wrapped",
  "questionIds": ["ceq_..."],
  "mode": "archive"
}
```

`questionId` may be sent instead of `questionIds` for a single question.
`mode` defaults to `archive`; use `delete` only when the proposed-question KV
record should be removed permanently.

Agent-only exports use a built-in worker pseudonym salt for `principal_id`
values, so operators do not need to configure a separate export secret. Admin
metrics count agent-only answers, privacy skips, vote state, principals, and
windows from KV metadata only, behind the existing metrics cache.

`POST /api/agent/result-view-cache` is service-token-only. Participant
and copied `ceagt_...` tokens can read cache entries when their route scopes
allow it, but they cannot write or overwrite cached Polis/atlas analysis.

For staging load tests, deploy a separate worker and KV namespace with the
existing helper flags:

```bash
npm run deploy:plan -- --worker-name ce-agent-bridge-worker-staging
npm run deploy:apply -- --worker-name ce-agent-bridge-worker-staging --apply
```

The helper derives the default action KV title from the worker name; pass
`--action-kv-title` only when reusing or selecting an explicit staging
namespace.

After seeding and opening a staging window, run the load harness with:

```bash
AGENT_ONLY_LOAD_ORIGIN=https://ce-agent-bridge-worker-staging.<workers-subdomain>.workers.dev \
AGENT_ONLY_LOAD_INVITE_TOKEN=<staging-trusted-invite> \
AGENT_ONLY_LOAD_SESSION_SLUG=<session> \
npm run load:agent-only
```

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

The group session-linked card says `Session: <session>` and exposes `Join Session`, `View Questions`, `Groups`, and policy-allowed `Pose Question`. `View Questions` is the group-lobby default action. `Join Session` opens private chat and routes participants without a configured account to private account setup. Group messages remain safe public summaries only and never include account state, private answers, keys, grants, or gated/private document contents.

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

`/me` shows an abbreviated managed address as an inline chain-explorer link,
renders known chains by name, for example `OP Sepolia Testnet (11155420)`, and
offers private `Copy Agent Install Info` and `Activity` actions when the user
has a selectable Telegram session. The `/start` screen also exposes `Onboard
Agent` so the setup path is not buried under `/me`. The default user-scoped
agent token lifespan is 28 days, and the raw token is only included in the
private copy payload, never in message body text.

The web client login path never places a raw `ceagt_` token in a URL, durable
browser storage, Redux state, or logs. For Telegram-first sessions, users paste
the token or copied install info into the login modal; the client calls
`POST /api/agent/client-login/exchange` once, clears the pasted token from
component state after exchange, and stores only the returned short-lived browser
envelope in tab-scoped `sessionStorage`. The
`GET /api/agent/session-meta?sessionSlug=<slug>` endpoint returns public
session metadata, including `clientSubmitReady`, which tells the client whether
direct answer submit is deploy-ready for that session.

Account-created screens do not include `Open in CE`. Optional onboarding uses: `Enter startup info so I can suggest answers for you.` Confirmation copy is `Submit this response?` with `Save draft` and `Edit`.

Mini App question links can carry a prefilled editable draft and an ordered
question series. If the Mini App microphone path is unavailable, the user can
send a native Telegram voice message in the private bot DM after opening the
link; the worker transcribes it through the configured session worker and
applies it to that user's latest Mini App draft under the same rate-limit
settings used for Mini App transcription.

## Bot Commands

Core Telegram commands:

- `/start` opens the concise help entry point and shows only the `Mini App`
  control when configured. `Questions` and `Sessions` remain available as
  commands rather than welcome-screen buttons. If the user has not selected a
  private session yet, the Mini App launch opens the session picker first.
- `/sessions`, `/questions`, `/q <number>`,
  `/results`, `/results consensus`, `/results group`, `/results topic`,
  `/me`, `/account`, and `/agent_token` keep their existing
  session/question/account behavior. Plain `/results` explains the `consensus`
  `group`, and `topic map` views and
  renders buttons for those modes; mode-specific results attempt to upload a
  rendered PNG card with a compact white consensus view, participant graph
  for group results, or aggregate topic-map circles. The
  consensus view pages through the top three differentiating questions at a
  time and renders client-style agree/unsure/disagree distribution bars. The
  participant graph connects same-group participant dots and exposes per-group
  analysis buttons that use
  the selected session worker's sponsored AI route when available. Topic maps
  render only after enough answered questions exist, unless the caller requests
  demo preview data. The interactive client report can reuse worker-cached
  generated result views for report analysis plus demo circles and breakdown
  snapshots; cache keys include the session and client data-version key so new
  question/response data creates a fresh entry.
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
  in Worker KV without redeploying. For the Telegram-only demo lane, added
  addresses also unlock the Mini App admin panel so organizers can delegate
  exports, results settings, sponsored-question queues, and group invite-link
  creation without editing Worker env.
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

The attachment/document handlers remain implemented, but document buttons and
registered bot commands are temporarily hidden while the Telegram-first UX is
simplified. `/attachments` and `/docs` remain private compatibility commands
for smoke testing. Selected files are recorded as inputs for `Generate
Questions` and as future `Use as Answer Context` candidates. Private or gated
files should open through the Mini App once that surface is re-enabled.
Generating questions without selected files returns
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
| Optional Telegram bot display name | Set `TELEGRAM_BOT_NAME` or `AGENT_BRIDGE_TELEGRAM_BOT_NAME` to override the default `Context Engine`; live apply calls Telegram `setMyName` |
| `TELEGRAM_WEBHOOK_SECRET` random high-entropy string | Paste into `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `TELEGRAM_WEBHOOK_SECRET`; Telegram sends it as `X-Telegram-Bot-Api-Secret-Token` |
| `DEMO_SIGNER_ROOT_SECRET` random high-entropy string | Paste into `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `DEMO_SIGNER_ROOT_SECRET` |
| `AGENT_BRIDGE_AGENT_API_TOKEN` random high-entropy string | Paste into `.dev.vars`; `deploy:apply -- --apply` writes deployed Worker secret `AGENT_BRIDGE_AGENT_API_TOKEN` for OpenClaw/agent handoff API authentication |
| Production web client origins | Set `AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS=https://contextengine.xyz,https://www.contextengine.xyz,https://contextengine.sh,https://www.contextengine.sh` so hosted clients can exchange Telegram tokens and read result-view cache entries during the current `.xyz` deployment and the planned `.sh` cutover. Result-view cache writes require the worker service token. Add Mini App origins to `AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS`; those origins are also accepted for client-login exchanges |
| Optional trusted Geo/Hermes onboarding invite | Store a SHA-256 hash in `AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES`, or use `AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON` records with `tokenHash`, `sessionSlug`, `label`, and `source`. The Geo node/link carries the plaintext invite token; Hermes supplies the Telegram user id it observes and receives a normal user-scoped `ceagt_...` token from `POST /api/agent/invite/onboard` |
| Optional OpenAI key for Telegram AI | Paste into untracked `.dev.vars` as `AGENT_BRIDGE_OPENAI_API_KEY` or `OPENAI_API_KEY`; `deploy:apply -- --apply` writes deployed Worker secret `AGENT_BRIDGE_OPENAI_API_KEY`. Telegram question generation, AI search, add-question formatting, group analysis, and transcription pass it as a request-local `apiKey` to the configured session worker when that session worker has no per-session `openaiKey` secret |
| Public deployed `agentBridgeWorker` URL | Paste or derive the Workers.dev base URL as `AGENT_BRIDGE_PUBLIC_URL`, for example `https://ce-agent-bridge-worker.<workers-subdomain>.workers.dev`; live apply can derive it when the token can read the account workers.dev subdomain |
| CE/session worker base URL | Paste into `CE_SESSION_WORKER_BASE_URL`, for example `https://<session-worker>.<workers-subdomain>.workers.dev` |
| Default chain and RPC URL | Use `DEFAULT_CHAIN_ID=11155420` and preserve `DEFAULT_RPC_URL=https://op-sepolia-testnet.api.pocket.network` unless the selected session resolves another supported chain |
| Optional extra RPC URL | Put an Infura or other OP Sepolia fallback in `ADDITIONAL_RPC_URL`; this is additive and does not replace the default POKT/PATH RPC. The Worker tries `DEFAULT_RPC_URL` first, then `ADDITIONAL_RPC_URL` for live SessionRegistry reads |
| Optional question source | Omit `AGENT_BRIDGE_QUESTION_SOURCE` for live question reads. Use `fixture` only for local preview/demo copy, or `live_or_fixture` when a temporary fixture fallback is intentional |
| Optional question cache tuning | `AGENT_BRIDGE_RPC_TIMEOUT_MS`, `AGENT_BRIDGE_QUESTION_PAYLOAD_TIMEOUT_MS`, `AGENT_BRIDGE_QUESTION_CACHE_TTL_SECONDS`, `AGENT_BRIDGE_QUESTION_PAYLOAD_CONCURRENCY`, `AGENT_BRIDGE_QUESTION_FOREGROUND_CHUNKS`, and explicit `AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK` / `AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK` tune the Telegram worker-local index. Defaults are sufficient when session metadata includes `blockLimits.start` or the registry exposes `SessionCreated` for the slug. `AGENT_BRIDGE_QUESTION_STORAGE_BACKEND=cloudflare` is a debug override; normal deployments derive Cloudflare question reads from the session storage profile |
| Optional Telegram session cutoff | `AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` filters `/start`, `/sessions`, and the Mini App session picker to Telegram-visible sessions with `createdAt`, `sessionCreatedAt`, `groupCreatedAt`, or a supported created timestamp at or after the cutoff. Accepts ISO timestamps or Unix seconds/milliseconds. Sessions missing creation metadata are hidden while this cutoff is set, except the configured default Telegram-only session remains selectable so a single active demo session can still boot. To hide only a test session, give that session a strictly earlier `createdAt` and set the cutoff between it and the real sessions |
| Optional per-session Telegram group allowlist | Add `approvedTelegramGroupChatIds` / `telegramApprovedGroupChatIds` / `approvedTelegramChats` to a session policy entry to restrict which Telegram groups can bind to that session. Set `telegramGroupApprovalRequired: true` when a session should require static approval or an admin-generated invite link even before any groups are listed. Run `/group_id` inside the target Telegram group to have the bot display the numeric `chat.id` to copy into the policy. Configured export admins can run `/group_link [session]` or use Admin Actions to create a one-use `https://t.me/<bot>?startgroup=<opaque>` link that approves the first group that opens it. Sessions without an allowlist or approval-required flag remain available to any group where the bot is present |
| Optional Telegram API timeout | `AGENT_BRIDGE_TELEGRAM_API_TIMEOUT_MS` bounds outbound Bot API calls before media sends fall back to document/text replies; default `8000` |
| Optional response export allowlist | `AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES` is a comma-separated or JSON-array list of managed Telegram ETH addresses allowed to use `/export_all` and manage added exporters. Session policy can also use `responseExportAllowedAddresses` or `telegramResponseExportAllowedAddresses` for per-session root admin allowlists. Root admins can grant additional session-scoped exporters through `/export_allow` without changing config |
| Optional agent-only token TTL | `AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS` overrides the default 7-day lifespan for `mode: "agent_only"` invite onboarding tokens |
| Cloudflare account ID | Do not ask the operator to paste this in product setup. `/telegram-demo-setup` and `deploy:plan` derive the account from `CLOUDFLARE_API_TOKEN`; if multiple accounts are visible, setup blocks because account selection is not implemented yet. `CLOUDFLARE_ACCOUNT_ID` is a developer fallback only |
| Cloudflare API token | Put in untracked local env as `CLOUDFLARE_API_TOKEN`; never commit it. The planning helper validates presence and prints only redacted status |
| KV namespace | `deploy:apply -- --apply` creates or reuses and binds as `AGENT_ACTION_KV` for opaque callback/action IDs and replay cache |
| R2 bucket | Optional. `deploy:apply -- --apply --enable-doc-storage` or `AGENT_BRIDGE_ENABLE_DOC_STORAGE=true` creates or reuses and binds `AGENT_DOCS_R2` for bridge-owned demo artifact and document bytes |
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
`/questions`, `/pose_question`, `/q`, `/results`, `/results consensus`, `/results group`, `/results topic`,
`/attachments` or alias `/docs`, and `/me`, answers callback queries to clear Telegram's
inline-button loading state, and sends replies through an injected Telegram Bot
API adapter. In live Cloudflare requests, Telegram sends are scheduled with
`ctx.waitUntil` after the command response is built so the webhook can return a
fast 200 instead of waiting on Telegram media upload or message delivery. Bot
API calls are bounded by `AGENT_BRIDGE_TELEGRAM_API_TIMEOUT_MS` so media sends
can fall back to document or text replies instead of hanging indefinitely. Unit
tests use mocked `fetch` and fake bot tokens; real
`TELEGRAM_BOT_TOKEN` is needed only for live Telegram smoke.

Callback data and private deep-link start payloads are opaque `cecb_*` or
`cetg_*` identifiers. Private payloads, JWTs, worker tokens, account material,
private keys, and Cloudflare credentials must never be placed in Telegram
callback data.

The command handler uses `AGENT_BRIDGE_SESSION_POLICY_JSON` as the explicit
Telegram session list when it is configured. Telegram-visible sessions must set
both `telegramBridgeEnabled=true` and `telegramOnly=true`; standard registry
sessions are not listed just because they exist on-chain. The policy can carry
preloaded `questions` for Cloudflare-native Telegram-only sessions, or point at
a Cloudflare-backed session worker through `sessionWorkerUrl` plus
`storageProfile.backend="cloudflare"` so the bridge can load
`/storage/list?resource=questions` and `/storage/read` directly instead of
scanning chain question events. `/sessions` hides `e2e`-named smoke-test
sessions as a temporary cleanup heuristic and paginates tall inline-keyboard
lists with `Load Next`. `AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` can be set
as a Cloudflare Worker plain-text var to hide older Telegram-only groups from
`/start`, `/sessions`, and the Mini App picker. When that cutoff is active,
policy entries need one of the normalized creation fields (`createdAt`,
`sessionCreatedAt`, `groupCreatedAt`, `createdTimestamp`, or the timestamp
aliases) or they are treated as older than the cutoff. The Edge City 2026 demo
policy should define `ee-26-test`, `ee-26-organizers`, and `ee-26-users` as
Telegram-only sessions, with `defaultSessionSchedule` selecting
`ee-26-organizers` until `2026-05-30T00:00:00Z` and `ee-26-users` from that
instant onward. To remove `ee-26-test` after smoke testing, set
`AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER` to a timestamp after the test
session's `createdAt` and before the public demo sessions' `createdAt`; any
non-default session without creation metadata is hidden while the cutoff is set.
Group session selection
through
`/sessions` or `/join <session>` persists the chat's selected session in
`AGENT_ACTION_KV`, so later `/questions`, `/q <number>`, `/results`, and
`/attachments` use that session without repeating the slug. It also stores that
selected session for the Telegram user who made the selection, so their private
bot and Mini App flows start from the same session. Private `/join <session>`
persists the selected session for that Telegram user as well, so private
`/questions`, `/q <number>`, and `/results` use the same session unless a
command supplies an explicit slug. If a session policy entry includes
`approvedTelegramGroupChatIds` or equivalent approved-chat fields, group
`/sessions`, `/join`, `/questions`, `/q`, `/results`, `/groups`, add-question,
and agent handoff calls that include `groupChatId` are limited to those
approved Telegram group IDs. If `telegramGroupApprovalRequired` is true, the
same checks apply even before a static list is populated. `/group_id` returns
the current group's `chat.id` so a session admin can copy it into policy.
Configured export admins can also generate a one-use Add Bot To Group link from
Admin Actions or `/group_link [session]`; the first group that opens the
`startgroup` link is stored in Worker KV as an approved group and bound to that
session. When a participant answers a posed group
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
fixtures only when live question reads return no records. Live read timeouts
and payload-unavailable rows stay visible as live-source loading/unavailable
states instead of being replaced by fixtures. Fixtures must remain
non-identifying and secret-free. When optional fixture/cache vars are present in
untracked `.dev.vars`, `deploy:apply -- --apply` uploads them as plain Worker
vars.

Question cache controls:

| Var | Purpose |
| --- | --- |
| `AGENT_BRIDGE_QUESTION_SOURCE` | Defaults to `live`; use `fixture` only for local preview/demo copy or `live_or_fixture` for explicit fallback |
| `AGENT_BRIDGE_QUESTION_LIVE_FALLBACK_TIMEOUT_MS` | In `live_or_fixture`, maximum live question wait before returning a loading state and continuing live indexing in the background; default `2500` |
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
POST /telegram/mini-app/api/questions/format
POST /telegram/mini-app/api/questions/add
GET  /telegram/mini-app/api/admin/access
POST /telegram/mini-app/api/admin/access
GET  /telegram/mini-app/api/admin/results-settings
POST /telegram/mini-app/api/admin/results-settings
GET  /telegram/mini-app/api/admin/question-queue
POST /telegram/mini-app/api/admin/question-queue
GET  /telegram/mini-app/api/admin/export
POST /telegram/mini-app/api/admin/group-link
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
The first-load shell defaults to the loading GIF. Operators can test the CSS
spinner variant with `/telegram/mini-app?loading=spinner` or set
`AGENT_BRIDGE_MINI_APP_LOADING_VISUAL=spinner` for a deployment.
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
  settings inputs for `draftStyle`. The Mini App keeps
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
- First state loads are intentionally paged. The shell starts with
  `questionLimit=1`; for worker-backed Cloudflare question storage the worker
  lists question storage once, reuses inline question payloads returned by that
  list when present, reads only the requested page of missing payloads, and
  reports the full discovered count so the UI can show `1/N` immediately while
  delaying the first background fetch. The Mini App automatically loads five
  more questions next, then continues page-size background loads until the full
  question set is hydrated.
  Sessions with `telegramOnly=true`, `sessionMode=telegram_only`, or Cloudflare
  question storage and no explicit on-chain question mode do not use
  SessionRegistry/RPC question indexing on this path.
- Native freeform, binary, rating, and multichoice answer forms rendered inline
  on each displayed question card in one document-scroll question list. The Mini
  App does not render question IDs or a `Create Agent` launcher; filters and
  settings are opened from the top-right filter and gear buttons.
  Session question count text is intentionally a single answerable-question
  count rather than a split loaded/indexed diagnostic.
- The filter panel includes unanswered-first ordering, question type filters
  including freeform questions, generated question tag filters, and an AI-backed
  question search that ranks matching loaded prompts/tags through the session
  worker `/ai` route when sponsored AI is available. It falls back to local
  semantic keyword matching when AI is unavailable, auto-applies as the user
  types, and only shows `Clear` when there is search text. The search field can
  also use the microphone icon; transcribed search text is applied to the
  loaded-question filter immediately.
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
  `AGENT_BRIDGE_SESSION_POLICY_JSON`. When `AGENT_BRIDGE_OPENAI_API_KEY`,
  `AGENT_BRIDGE_OPENAI_KEY`, `OPENAI_API_KEY`, or `E2E_OPENAI_KEY` is available
  on the Telegram bridge, the bridge appends it as a request-local session
  worker `apiKey`; this avoids requiring every new Telegram-only session worker
  to be separately seeded with `openaiKey` before transcription or AI question
  generation can run. Browser Web Speech remains a fallback for webviews without
  `MediaRecorder`.
- Previously saved draft answers are returned by state as
  `draftAnswersByQuestionKey` and hydrate the matching question cards on load.
  The gear/settings panel also lists saved draft response labels and can clear
  visible saved drafts through `POST /telegram/mini-app/api/clear-drafts`.
  Submitted-answer history is tracked separately from drafts, so clearing
  drafts only removes unsubmitted answers. The filter panel's
  `showUnansweredFirst` preference defaults to true and orders saved or
  submitted answered questions after unanswered questions on first load.
- Telegram-only question authoring stores generated tags with each proposed
  question. The Mini App Add Question panel has non-secret session-context and
  comma-tag fields; dictation formatting sends those values to the session
  worker `/ai` route so the returned prompt/options/tags fit the selected
  session. Microphone-generated question drafts request automatic question-type
  inference, so spoken requests can become binary, rating, multichoice, or
  freeform questions and can populate multichoice options when the choices are
  spoken. If AI is unavailable, the bridge still derives conservative type,
  option, and tag metadata from the prompt, selected session metadata, and
  session context.
- The Mini App keeps polling state while no answerable questions are available
  and questions are still empty, the question source reports an error, or only
  payload-unavailable question rows are present. Mixed answerable/unavailable
  lists stay usable without a foreground retry loop.
- Draft saves through `POST /telegram/mini-app/api/draft`.
- Settings saves through `POST /telegram/mini-app/api/settings`, which creates a
  Worker-local `telegram:agent-request:*` record and a planned canonical
  `/api/agent/settings/update-request` envelope. It does not execute the live
  settings backend yet.
- Admin actions are available inside the Mini App for managed Telegram accounts
  with configured or delegated export/admin access. The admin panel can download
  the response export zip, add or remove delegated admin addresses, update
  results exposure settings, set the sponsored question queue, and generate a
  one-use add-bot-to-group link. The permissions panel also shows equivalent bot
  commands such as `/export_allow 0x... <session>` and `/export_revoke 0x...
  <session>` for operators who prefer the bot.
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
- Configured admins can manage sponsored/default question queues from Admin
  Actions or with `/question_queue 1 3 4`. Queue config is stored under
  `telegram:question-queue-config:v1:<sessionSlug>` in `AGENT_ACTION_KV`.
  Agent next-question calls serve those question ids first when they match the
  user's criteria, then fall back to preference-ranked active questions. The
  same queue is available to operator agents through the raw service-token
  route
  `GET /api/agent/question-queue` and
  `POST /api/agent/question-queue`, but writes require the
  shared service token and a Telegram account whose managed wallet is a
  configured session admin; ordinary `ceagt_` user delegation tokens cannot
  change admin queues through that raw route. Admin `ceagt_` tokens can use
  `GET /api/agent/admin/status`,
  `POST /api/agent/question-queue/plan`, and
  `POST /api/agent/question-queue/apply` to resolve natural-language
  sponsored-question references, draft new sponsored questions, and persist the
  queue only after explicit admin approval.
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
- Browser calls that carry Telegram client tokens use the deployed
  `AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS` and
  `AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS` Worker vars. Keep the production web
  origins in that allow-list when running `deploy:apply -- --apply`; the helper
  uploads Worker metadata from its vars map on each script deploy.
- Payload-unavailable questions stay retryable/unanswered; true private or gated
  questions stay locked until the canonical private/gated decrypt path is
  available.

### Telegram Agent Handoff Question Relevance

The agent handoff skill is packaged with this worker at
[`skills/ce-telegram-agent-handoff/SKILL.md`](skills/ce-telegram-agent-handoff/SKILL.md).
Local discovery wrappers are not authoritative; this worker-packaged file is
the source of truth for compatible agent hosts.

OpenClaw-style agents can call:

```text
GET  /api/agent/questions?sessionSlug=<slug>&telegramUserId=<id>&groupChatId=<chat>
POST /api/agent/questions
POST /api/agent/questions/next
GET  /api/agent/tags
POST /api/agent/tags
POST /api/agent/questions/create
GET  /api/agent/admin/status
GET  /api/agent/admin/metrics
GET  /api/agent/question-queue
POST /api/agent/question-queue
POST /api/agent/question-queue/plan
POST /api/agent/question-queue/apply
POST /api/agent/group-approval-link
POST /api/agent/group-approval-revoke
GET  /api/agent/actions
GET  /api/agent/results
GET  /api/agent/results-image
POST /api/agent/preferences
POST /api/agent/questions/pose
POST /api/agent/question-votes/recommend
POST /api/agent/question-votes/apply
```

`/api/agent/questions` returns public, answerable question metadata
with normalized `tags`. `POST /api/agent/questions` accepts a
`preferences` object containing `tags`, `interests`, `topics`,
`sessionsAttended`, or `attendedSessions`; the worker infers relevance from
question tags, prompt text, and attended-session hints. The default mode returns
all questions ranked by relevance. Set `relevanceMode: "filter"` to return only
questions with a positive relevance score. `questions/pose` accepts `tags` and
`sessionContext` when an agent creates a new Telegram-only question.

`GET /api/agent/tags` returns active tag counts without question text.
If `sessionSlug` is omitted, the worker uses the current default session; an
explicit unrecognized `sessionSlug` returns `404` so agents can ask for the
correct session name instead of silently reading a different session. `POST
/api/agent/questions/create` lets an agent create approved proposed
questions in batch, attaching URL references and source-derived tags without
posing them into a chat.

`POST /api/agent/questions/next` is the queue-friendly cadence route.
It accepts `criteria` / `preferences`, optional `questionTypes`, `queueKey`,
`advance`, and `resetQueue`. The worker serves admin-sponsored question ids
first when `sponsoredFirst` / `includeSponsored` allow them and they match the criteria, advances a per-user cursor in
`AGENT_ACTION_KV`, and then falls back to the same preference-ranked active
question list used by `/api/agent/questions`.

`GET /api/agent/question-queue` returns the current sponsored queue
and the answerable question candidates for a session. `POST` accepts
`sponsoredQuestionIds` / `questionIds` (question IDs or 1-based candidate
numbers) and persists the sponsored queue; use `{"clear": true}` or
`{"operation": "clear"}` to empty it. This is an admin route: callers must use
the shared service token and include `telegramUserId` for a configured session
admin. User-scoped `ceagt_` tokens are intentionally rejected for this route.

`GET /api/agent/admin/status` can be called with a user-scoped
`ceagt_` token to check whether the token's managed wallet is a session admin.
When `capabilities.canManageSponsoredQuestions` is true, agents may use
`POST /api/agent/question-queue/plan` to resolve sponsored-question
requests like "make the pizza question sponsored" or "create a question about
organizer outcomes and make it sponsored." The plan route is read-only and
returns resolved existing questions, draft questions, skipped references, and
candidate questions. Agents must show that plan to the admin and call
`POST /api/agent/question-queue/apply` only after explicit approval
through `approved: true` or `approvalText`. Multiple existing references and
multiple new questions are supported; apply appends by default and replaces the
queue only when `replace: true` is supplied.

`GET /api/agent/admin/metrics` returns admin-only aggregate counts for
token mints, agent-created questions, submitted answer records, answer drafts,
group proposals, distinct respondents, and registry session count. Submit
metrics are counted from KV list metadata for current records, with a legacy
body-read fallback, so large Telegram-only sessions avoid one KV read per
response. `POST /api/agent/group-approval-link` and
`/group-approval-revoke` are worker-service-token operator routes for managing
approved Telegram groups; normal user-scoped admin tokens should use the
in-group approval flow instead.

## Draft Provenance And Research Metrics

Answer drafts are research artifacts: an agent drafts an answer, the user
reviews or edits it, and the final answer is submitted. The worker captures that
lifecycle so later research can measure how often and how much people edit
agent drafts before submission.

- Draft records (`telegram:answer-draft:*`, version 2) preserve an `origin`
  block with the first revision's plaintext `answerLabel`/`answerValue`,
  `controlType`, writer `source`, optional agent metadata, fingerprint, and
  server-stamped `savedAt`. Later overwrites keep that origin and update
  `editCount`, `humanEditCount`, `lastEditSource`, and the latest
  `agentRevision` fingerprint. Legacy v1 drafts are backfilled as origin on the
  next save.
- Edit detection compares a canonical semantic form rather than raw strings, so
  binary, rating, multichoice, and freeform answers compare correctly across the
  bot, Mini App, and agent handoff lanes. Multichoice selections are sorted and
  deduped before comparison.
- Submit records carry a `draftProvenance` block with origin and final
  plaintext, raw and semantic fingerprints, edit counts, first view time,
  draft-to-submit latency, agent-draft flags, and a typed delta such as stance
  changes, rating shifts, choice additions/removals, or freeform length change.
- The Mini App stores `firstViewedAt` on a separate
  `telegram:answer-draft-view:*` key so view stamps cannot clobber draft
  content. Stale view stamps older than the current draft origin are ignored.
- If the optional `AGENT_BRIDGE_ANALYTICS` Workers Analytics Engine binding is
  present, the worker writes best-effort `draft_created`, `draft_edited`,
  `draft_submitted`, and `draft_discarded` events. The principal fingerprint is
  HMAC-SHA256 keyed by `AGENT_BRIDGE_ANALYTICS_SALT`; without the salt it is
  empty rather than an unsalted Telegram-id hash.
- Admin metrics add live `answerDraftsEdited` and `agentDraftedAnswers` counts
  from KV list metadata. These counts decay with the draft TTL; use Analytics
  Engine events for historical funnels.

`GET /api/agent/actions` returns mutation-oriented activity for the
resolved user: agent-created answer drafts, pending vote recommendations,
applied vote decisions, proposed questions, and group proposals. With a
`ceagt_` token, the worker scopes the response to that token's Telegram user and
session. The bot mirrors the same data through `/activity`: full details in
private chat and counts only in groups.

`GET /api/agent/results?view=topic-map` returns the aggregate
topic-map data contract used by the Mini App: topic circles, question bubbles,
counts, and cache status. It does not include raw response records, Telegram
user ids, wallet addresses, or individual answer text. The worker caches one
aggregate topic-map payload per session/filter variant in `AGENT_ACTION_KV` and
refreshes it only when question membership changes or enough new responses land
to materially change the map. `GET /api/agent/results-image?view=topic-map`
returns a PNG rendering of the same map. If there is not enough live data, the
JSON endpoint reports `available: false` and the image endpoint returns `409`;
pass `demo=1` for preview output.

Agents can also ask the worker for a meta-level importance view with
`POST /api/agent/question-votes/recommend`. The response returns a
`metaQuestion`, suggested up/down question votes, confidence/reason fields, and
an `agentNote` intended for user review. If the request includes
`autoApply: true`, the worker applies those votes only when the current
Telegram account/session Mini App setting `agentAutoApplyQuestionVotes` is
enabled. That setting is account/session-scoped and defaults to off.
`POST /api/agent/question-votes/apply` records human-approved,
rejected, or overridden decisions from explicit fields or natural-language
approval text. Applied votes use the same Cloudflare vote records read by the
Mini App question popularity UI, and every agent-mediated vote stores
non-secret `agentMetadata`, `actionMetadata`, the agent note, and whether the
human accepted or overrode the suggestion.

## Deploy Helper Plan And Apply

The product flow should not require manual Wrangler. The current
operator UX is `/telegram-demo-setup`: it selects a CE session, pulls
`CE_SESSION_WORKER_BASE_URL` and `DEFAULT_CHAIN_ID` from that session when
available, preserves the default OP Sepolia POKT/PATH RPC, accepts optional
additional RPC fallback input, generates `TELEGRAM_WEBHOOK_SECRET`,
`DEMO_SIGNER_ROOT_SECRET`, and `AGENT_BRIDGE_AGENT_API_TOKEN`, derives the
Workers.dev public URL, and creates a
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
  `DEMO_SIGNER_ROOT_SECRET`, `AGENT_BRIDGE_AGENT_API_TOKEN`.
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
`setWebhook`, `setMyName`, plus `setMyCommands`, and `/health` verification. Tests keep these network calls mocked
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
4. Populate an untracked `.dev.vars` file in the worker directory with the live values.
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
   `/q <number>`, `/results consensus`, `/results group`, `/results topic`, `/attachments`, and
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

Private `/join <session>` also schedules faucet gas for the managed Telegram
account when the session policy sets `sponsoredFaucetAllowed=true` and a session
worker URL is configured. Join replies do not wait on question prefetch or
faucet setup; those tasks run through `ctx.waitUntil` in live Cloudflare
requests. Faucet results are kept in response metadata and logs rather than
shown in Telegram copy. If policy or worker configuration does not allow faucet,
or the session worker lacks a usable faucet key/route, join still succeeds
without funding.

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
