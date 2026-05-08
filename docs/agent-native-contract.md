# Agent-Native Contract

Context Engine's agent-native surface is a canonical HTTP/JSON contract first.
MCP and delivery bridges must wrap this contract instead of creating parallel
business-logic paths.

## Canonical Endpoint Families

| Family | Canonical route | Legacy CE-CC equivalent | Status |
| --- | --- | --- | --- |
| Identity | `GET /api/agent/me` | `GET /api/me` | Read adapter with capability metadata |
| Sessions | `GET /api/agent/sessions` | `GET /api/sessions` | Read adapter |
| Questions | `GET /api/agent/questions?session=<slug>` | `GET /api/questions?session=<slug>` | Read adapter with `question` and `questions[]` |
| Inbox | `GET /api/agent/inbox` | `GET /api/responses/pending?session=<slug>` | Summary adapter |
| Draft responses | `POST /api/agent/responses/draft` | `POST /api/respond` | Draft-only local save |
| Draft listing | `GET /api/agent/responses/drafts?session=<slug>` | `GET /api/responses/pending?session=<slug>` | Pending-response adapter |
| Submit request | `POST /api/agent/responses/submit-request` | `POST /api/responses/submit-onchain` | Approval-gated request |
| Delegated response execution | `POST /api/agent/responses/delegated-execute` | `POST /api/responses/submit-onchain` | Scoped-grant validation and audit record only |
| Request status | `GET /api/agent/requests/:id[?session=<slug>]` | None | Agent-native request read |
| Connect request | `POST /api/agent/connect-requests` | None | Approval-required scoped grant request |
| Connect request read | `GET /api/agent/connect-requests/:id` | None | Side-effect-free scoped grant request read |
| Connect request approve | `POST /api/agent/connect-requests/approve` | None | Local human approval creates the scoped grant |
| Connect request deny | `POST /api/agent/connect-requests/deny` | None | Local human denial closes the request |
| Grant list | `GET /api/agent/grants[?session=<slug>]` | None | Wallet-scoped grant read |
| Grant read | `GET /api/agent/grants/:id[?session=<slug>]` | None | Wallet-scoped grant read |
| Grant revoke | `POST /api/agent/grants/revoke` | None | Wallet-scoped grant revocation |
| Managed account create/recover | `POST /api/agent/accounts/create` | None | Contract-only managed demo account metadata |
| Managed account link request | `POST /api/agent/accounts/link-request` | None | Approval-gated link request metadata |

Legacy routes remain supported. The canonical routes require the same local JWT
auth as their CE-CC equivalents and do not weaken worker-token or trusted-local
checks.

Session identity is explicit on the public agent contract. Browser/client
internals may still use an empty string for the general/default session, but
`/api/agent/*` callers must send `general` for that public session name. Empty
agent session values such as `session: ""` or `?session=` are invalid and return
`400`.
Request status reads are wallet-scoped by the local JWT. When a `session` query
is provided, the request must also belong to that public session slug or the
route returns the same not-found envelope used for unknown request ids.

## Contract Shapes

Agent contract helpers under `contextEngine-cc/lib/agent/` define stable
versioned shapes for:

- `AgentQuestion`: canonical question ids, question type, prompt, options, tags,
  and provenance fields.
- `AgentDraftResponse`: local draft metadata. Answer text is omitted from summary
  shapes unless an explicit local caller asks for it.
- `AgentRequest`: approval-gated request records with status, request id,
  approval URL, requester, session, question ids, optional idempotency key, and
  stable fingerprint.
- `AgentGrant`: scoped grant metadata that never grants signing authority or
  worker-token authority.
- `AgentConnectRequest`: human-approved connect/approval handoff metadata for
  scoped grants. Connect requests bind the human principal, agent identity,
  explicit session slugs, requested scopes, allowed action ids, risk ceiling,
  expiry, execution policy, audit requirement, idempotency key, and stable
  fingerprint. They still do not carry signing authority or worker-token
  authority.
- `AgentBridgeWorker` primitives: contract-only principal summaries,
  preference profiles, opaque action records, idempotency records, bridge
  events, grant cache summaries, and agent-created account metadata.
- `TelegramBridge` records: group bindings, private-start actions,
  server-side action resolutions, managed account summaries, and answer action
  records. Deep-link payloads carry only opaque action ids.
- `WorkerSetup` records: private `/worker-setup` route inventory, setup-state
  checkpoints, onboarding config defaults, and safe event summaries.

`AgentGrant` is the private contract for explicit delegation. A grant must be
bound to all of:

- `humanPrincipal`: the human wallet/principal that owns the grant.
- `agentId`: the delegated agent identity.
- `sessions`: explicit public session slugs; `general` is the public general
  session alias.
- `allowedActions`: canonical agent action ids such as
  `agent.response.delegated_execute`.
- `riskCeiling`: one of `read`, `low`, `medium`, `high`, or `critical`.
- `executionPolicy`: `approval_required`, `scoped_delegated_execute`, or
  `trusted_local_auto_submit`.
- `expiresAt`, `status`, and `revokedAt`: expiry and revocation state.
- `auditRequired`: whether CE must record an audit lifecycle record before the
  action is considered accepted.

`scoped_delegated_execute` is the only remote delegation mode that can allow a
risky action without a fresh human approval prompt. It is still narrower than
`trusted_local_auto_submit`: the grant must match the authenticated wallet,
agent identity, session, action id, risk ceiling, expiry, and revocation state.
It does not carry private keys, CE-CC JWTs, worker tokens, long-lived bearer
tokens, deployment secrets, or any equivalent signing authority.

Agent request payload snapshots redact sensitive keys and secret-shaped values
recursively before local storage.

Request ids use opaque `agent_req_...` values. Client-supplied idempotency keys
are optional, lowercased, bounded, and matched only inside the authenticated
wallet scope. A repeated key is treated as a retry only when the stored request
fingerprint also matches the current request and the stored request is still
pending approval. A different session or question set with the same key returns
a conflict instead of the older approval request. A matching key for an expired,
revoked, rejected, submitted, denied, or failed request returns a conflict with
the normalized request summary instead of a new approval-required response.

Grant and request lifecycle helpers keep denial reasons explicit. Expired and
revoked grants are denied before scope/session checks; mismatched scopes and
sessions are reported as `scope_mismatch` or `session_mismatch`. Request status
reads normalize expired and revoked records before summarizing them. Terminal
request states are not reported as approval-required, so adapters cannot confuse
stale records with actionable approval prompts. These helpers are pure contract
guards only; wiring them to a richer client approval UI remains deferred.
Inbox responses include request status counts across pending, approved, denied,
expired, revoked, submitted, and failed records after lifecycle normalization.
Capability decisions keep risky remote modes, such as submit requests, in the
approval-required state. Trusted local auto-submit remains local-only even when
local worker readiness is true.
`scoped_delegated_execute` is advertised as grant-required and is disabled by
default in the general capability response until a route validates an explicit
grant for the exact action.

Agent route errors use JSON-first envelopes with `ok: false`, `status`, `code`,
and `error`. Current route-level codes include `agent_auth_required`,
`agent_auth_failed`, `invalid_session`, `invalid_question_id`,
`invalid_question_ids`, `invalid_response_draft`, `invalid_answer`,
`invalid_request_id`, `invalid_grant_id`, `agent_request_not_found`,
`agent_grant_not_found`, `agent_grant_denied`, and `agent_internal_error`.

## Draft vs Submit Request

Agents may draft locally through `POST /api/agent/responses/draft`. This stores
the response as local pending state and never attempts worker auth, signing, or
on-chain submission.

Agents may ask for submission through
`POST /api/agent/responses/submit-request`. This creates an approval request and
returns an approval-required response. It does not call the on-chain submit path
and does not reuse the local JWT as worker or signing authority.

Approval-required responses use this shape:

```json
{
  "ok": false,
  "requiresApproval": true,
  "requestId": "agent_req_...",
  "approvalUrl": "http://localhost:7391/agent/requests/agent_req_...",
  "status": "pending_approval"
}
```

The local approval URL is a stable handoff target for human-facing surfaces.
Adding a real client approval route is a separate product decision.

## Scoped Delegated Execution

Delegated execution is opt-in and scoped. Remote agents may execute only by
calling canonical CE `/api/agent/*` routes with a valid grant; Telegram,
OpenClaw, and MCP are adapter clients, not grant stores or authority stores.

`POST /api/agent/responses/delegated-execute` currently validates the scoped
grant and writes an auditable lifecycle record, but it does not perform on-chain
submission. The success envelope is intentionally contract-only:

```json
{
  "ok": true,
  "status": "delegated_execution_deferred",
  "executed": false,
  "execution": {
    "status": "contract_only_deferred",
    "reason": "delegated_execution_validated",
    "productDecisionRequired": true
  }
}
```

Actual signing or worker-mediated execution remains a product/security decision.
When enabled later, CE must validate the grant at execution time and execute only
through an approved CE-owned path such as local trusted execution,
worker-mediated execution, managed testnet infrastructure, passkey,
account-abstraction, or a future delegated session-key mechanism. The remote
agent still must not receive or store the private key, CE-CC JWT, worker token,
long-lived bearer token, private deployment config, or equivalent authority.

Grant management is intentionally low risk in this phase:

- `POST /api/agent/connect-requests` creates a pending scoped grant request.
- `GET /api/agent/connect-requests/:id` reads that request without side effects.
- `POST /api/agent/connect-requests/approve` creates an active scoped grant only
  after local human JWT auth and only from the stored request fields.
- `POST /api/agent/connect-requests/deny` closes the pending request without
  creating a grant.
- `GET /api/agent/grants` lists grants for the authenticated wallet.
- `GET /api/agent/grants/:id` reads one wallet-scoped grant.
- `POST /api/agent/grants/revoke` revokes an existing grant.

Connect request approval rejects scope-widening body fields. Reading a request
does not approve, deny, refresh, or create anything. Approval creates only grant
metadata; it does not execute a response, sign a transaction, mint an account,
store a worker token, or expose a private key.

Grant update routes are still not exposed. Any future grant expansion must go
through a fresh connect request and local human approval.

## Managed Demo Accounts

`POST /api/agent/accounts/create` creates or recovers deterministic managed
testnet account metadata for one Telegram principal per worker deployment. The
route returns address/account metadata and records either `account_created` or
`account_recovered`. It does not create a raw key export path, return seed
phrases, expose CE-CC JWTs, expose worker tokens, or enable production delegated
signing.

`POST /api/agent/accounts/link-request` creates an approval-required
`account_link_request` and records `link_requested`. It does not link the
managed account automatically and returns `linked: false`. Actual account
linking remains a local human approval path.

## AgentBridgeWorker Primitives

`contextEngine-cc/lib/agent/bridgePrimitives.mjs` models the private
agentBridgeWorker contract without real Telegram/OpenClaw transport:

- `AgentPrincipal`, `TelegramPrincipal`, and `OpenClawPrincipal` are safe
  summaries only.
- `AgentPreferenceProfile` supports by-value entries and by-ref preference
  bundle refs. Merging is additive; conflicting values become suggestions for
  human review, not silent overwrites.
- `AgentActionRecord` uses opaque `agent_action_...` ids and payload refs
  instead of embedding prompts, answers, callback data, tokens, or secrets.
- `AgentIdempotencyRecord` is scoped by CE account/principal, agent principal,
  integration principal, session, and grant; the same key with a different
  fingerprint is a conflict.
- `AgentBridgeEvent` supports group-card posted, private-start opened,
  account created/recovered, question delivered, response action created,
  draft saved, submit requested, delegated-execute deferred/executed, approved,
  submitted, failed, and grant revoked events. Events contain safe summaries and
  refs only.
- Grant cache summaries strip CE-CC JWTs, worker tokens, private keys,
  long-lived bearer tokens, and signing authority.
- Agent-created account metadata models V1 as a managed
  testnet/account-runtime identity. Outputs are metadata only. Durable Object
  isolated signer remains the preferred V1 signer boundary if real signing is
  later implemented.

The bridge primitives are private-by-default and scoped by CE account/principal,
integration principal, session, and grant. They do not implement webhooks, bot
tokens, OpenClaw transport, real signing, delegated session keys, or worker
authority.

`workers/agentBridgeWorker/` now contains the private deployable worker
skeleton. It is intentionally independent from `workers/sessionCorsWorker/`.
The skeleton includes dependency-free pure modules for:

- Telegram mock update normalization and group/private lane routing.
- Opaque action IDs for callbacks, private deep links, and server-side context
  refs.
- Managed Telegram demo account metadata and explicit `export_demo_key` /
  `recover_demo_key` actions.
- A `ManagedDemoSignerDurableObject` boundary that signs canonical testnet demo
  envelopes, records audit events, and keeps broadcast disabled.
- Doc-library records that model R2 bytes, D1 metadata/index state, and KV
  short-lived actions.
- Event logs, sanitized group-safe envelopes, session/SBT join policy,
  sponsored-resource policy, and Telegram question-card controls.

The signer currently creates signed demo envelopes only. It does not broadcast
transactions or touch production authority. Raw demo key export/recover is
private-only, testnet/demo-labeled, audited, and rejected for passkey, Porto,
CE-CC local, linked external wallet, and production account modes.

The worker doc-library contract supports Markdown (`md`), PDF (`pdf`), and
images (`png`, `jpg`, `jpeg`, `webp`). Group summaries may show public question
text, document titles, answer labels, aggregate counts, file type, visibility,
and index status. Private/session/SBT-gated document contents stay behind
private refs and are not included in group-safe summaries.

Telegram screen/message helpers expose launch metadata on every
`telegram_screen_state`: `/start`, `/ce_join`, `/ce_questions`, `/ce_docs`,
`/ce_generate_questions`, `/ce_onboarding`, `/ce_export_key`,
`/ce_recover_key`, opaque callback actions, or the
`t.me/<bot>?start=<opaque-action-id>` template. The group session-linked card
uses the safe public copy `Context Engine session linked: <session>` and the
buttons `Join Session`, `View Questions`, and `View / Add Docs`. It does not
include a default `Answer Privately` action. `View Questions` is the group-lobby
default, while `Join Session` opens private chat and routes participants without
a configured account to private account setup.

Telegram question-card helpers guard CE client parity for the demo lane:
binary/agree-style questions use `Agree`, `Unsure`, and `Disagree`; rating
questions render discrete `0` through `10` buttons; single-select multichoice
questions render single-select buttons; multi-select multichoice questions keep
per-option selected state; and freeform questions expose `Type` and `Voice`.
Every card includes additional comments, microphone input when supported, and a
docs/context action only when documents exist or are relevant.

The doc-library action copy is `View / Add Docs`. Selected docs feed
`Generate Questions` as request context and are also recorded as future
`Use as Answer Context` candidates. Generating questions with no selected docs
returns the prompt `Select or upload docs before generating questions.`
Account-created screens intentionally omit `Open in CE` for now, onboarding
copy is `Enter startup info so I can suggest answers for you.`, and confirm
submit copy is `Submit this response?` with `Save draft` and `Edit`.

## Telegram Group-To-Private Contract

`contextEngine-cc/lib/agent/telegramContracts.mjs` models the V1 bot-first
Telegram flow without real transport:

1. A group card stores `TelegramGroupBinding` server-side.
2. The group card deep link carries only a short opaque `cetg_...` action id.
3. Private chat resolves the group/session/question context server-side through
   `TelegramActionResolution`.
4. Unknown participants route to managed account setup.
5. Known participants can produce `TelegramAnswerAction` records that reference
   draft/submit requests without serializing answer text into group-safe output.

Group-safe summaries omit private account state and answers. Callback data,
deep-link payloads, CloudStorage, Mini App payloads, and chat state must not
contain session payloads, question payloads, answer text, grants, JWTs, private
keys, worker tokens, seed phrases, or account material.

## Worker Setup Contract

`contextEngine-cc/lib/agent/workerSetupContracts.mjs` defines the private
`/worker-setup` planning surface and pure setup-state helpers. The current
checkpoints cover worker reachability, Telegram webhook setup, `/start`
receipt, group deep-link resolution, Telegram principal normalization, managed
account create/recover, CE session fetch, question fetch, onboarding
skipped/completed, response action creation, draft/submit request creation, and
event-log update.

Onboarding is default-off. Config allows intro copy, 0-10 questions, normalized
question type, skippable/required behavior, predictive-answer enabled/disabled,
and a retention policy. Predictive answers are still allowed only after
onboarding/preferences are configured and completed, or when a preference bundle
is supplied.

## Action Inventory

`contextEngine-cc/lib/agent/actionInventory.mjs` is the canonical private action
inventory. It maps web UX action families to `/api/agent/*` implemented or
planned routes, required grant scopes, risk levels, approval/delegation
behavior, signing/worker authority requirements, and whether Telegram/OpenClaw
may call the route directly.

Implemented or contract-only families cover read identity/session/question,
draft response, submit request, delegated response execution, connect request
create/read/approve/deny, grant revoke, and contract-only account create/link
request metadata plus worker setup status/config contracts.
Deferred families cover decrypt request, question generation, survey/question
authoring, SBT group draft/create/share/claim requests, session
create/configure requests, and PRD 557 deliberative statement
signal/proposal/ranking requests.

Parity with the web UX is not complete. The agent API does not yet expose every
web action for survey authoring, SBT lifecycle management, session creation and
configuration, decrypt flows, or deliberative statement workflows.

## Verification Status

This private lane tracks CE-CC source under private version control while public
release and public-history tooling continue to strip `contextEngine-cc/**`.
They also strip `docs/agent-native*.md` and the private
`client/public/skill.md` artifact until the agent API is explicitly public.
While the Telegram bridge worker is private, the same release tooling strips
`workers/agentBridgeWorker/**`.
It uses dependency-free pure contract tests and router-level agent harness tests.
The current private branch includes the local runtime files needed for
app-server `/api/agent/*` tests. From the repo root, `npm run test:cc` runs the
private agent contract, route inventory, router harness, and runtime tests that
are meaningful for this package shape.

The `contextengine.sh` domain cutover is planned separately from this lane.

Private implementation and contract details stay under public-release strip
patterns: `contextEngine-cc/**`, `docs/agent-native*.md`, private
`client/public/skill.md`, and `workers/agentBridgeWorker/**`. CE-CC and agent
bridge worker local state, secrets, dependency installs, logs, generated state,
and key-like artifacts remain ignored even though source files are
private-tracked.

## MCP Wrapper Status

`contextEngine-cc/lib/agent/mcpTools.mjs` defines dependency-free MCP tool
descriptors and HTTP wrapper functions. Implemented tools call only
`/api/agent/*` routes:

- `connect`
- `auth_status`
- `list_sessions`
- `get_session`
- `list_questions`
- `resolve_questions`
- `next_question`
- `draft_response`
- `submit_response_request`
- `delegated_response_execute`
- `create_connect_request`
- `get_connect_request`
- `get_inbox`
- `get_request_status`
- `revoke_agent_grant`

Planned descriptors are present for `create_question_request`,
and `request_decrypt`, but no SDK dependency or second runtime path has been
added.

Drift guards assert that every implemented MCP tool maps to an inventoried
canonical `/api/agent/*` route and to the route-equivalence table.

## OpenClaw Compatibility

OpenClaw compatibility means:

- Direct HTTP works without OpenClaw.
- MCP output mirrors HTTP response shapes.
- Approval URLs and request IDs are surfaced when approval is needed.
- Thread forwarding is optional and abstracted behind `OpenClawThreadAdapter`.
- No browser DOM scraping is required.
- No hard dependency on OpenClaw internals is introduced.

`contextEngine-cc/lib/agent/openclawContracts.mjs` contains only pure adapter
envelopes for approval and draft forwarding.
Envelope validation requires canonical `/api/agent/*` HTTP paths and rejects DOM
scraping hints such as `document.querySelector`. It also rejects traversal-shaped
agent paths so adapter envelopes cannot smuggle a non-canonical endpoint behind
the public prefix.
Thread event envelopes cover `delivered`, `drafted`, `submit_requested`,
`approved`, `submitted`, and `failed` states. Submit-request envelopes preserve
the canonical `requestId`, `approvalUrl`, status, and non-secret idempotency key
so OpenClaw can forward state without becoming a second authority boundary.
OpenClaw draft and event helpers preserve the public `general` session alias and
reject malformed public session slugs when a session is present.

## Telegram Compatibility

Telegram is a delivery and interaction surface, not a signer or authority
boundary. V1 targets private DM and Mini App flows first; groups and topics are
future work unless they only need parsing or docs.

Rules:

- `callback_data` uses opaque short action IDs, not full payloads or secrets.
- Mini App `initData` must be validated server-side before trusting Telegram
  identity. The helper follows Telegram's official Mini App HMAC validation
  flow: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
  and rejects stale or far-future `auth_date` values.
- SecureStorage may store only short-lived scoped grants or refresh handles
  when feature-detected.
- CloudStorage may store only non-sensitive preferences.
- Do not store CE-CC local JWTs, worker tokens, private keys, long-lived bearer
  tokens, or signing authority in chat state, callback data, CloudStorage, or
  Mini App handoff payloads.

`contextEngine-cc/lib/agent/telegramContracts.mjs` contains only pure
normalization, callback action, Mini App validation, storage payload, and draft
payload helpers. It does not implement webhooks, deployment config, bot token
storage, or production secrets.
Telegram draft helpers preserve the public `general` session alias and reject
empty or malformed public session slugs before constructing canonical draft
payloads.
SecureStorage grant helpers require an explicit `agent:*` scope and a bounded
future expiration. CloudStorage helpers reject nested secret-shaped keys and
values and remain limited to non-sensitive preferences.
