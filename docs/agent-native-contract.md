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
| Grant list | `GET /api/agent/grants[?session=<slug>]` | None | Wallet-scoped grant read |
| Grant read | `GET /api/agent/grants/:id[?session=<slug>]` | None | Wallet-scoped grant read |
| Grant revoke | `POST /api/agent/grants/revoke` | None | Wallet-scoped grant revocation |

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
- `AgentConnectRequest`: future connect/approval handoff metadata for scoped
  grants. Connect requests can request read, draft, submit-request, create
  question, decrypt, or revoke-grant scopes, but still do not carry signing
  authority or worker-token authority.

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
guards only; wiring them to real connect or approval UI remains deferred.
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

- `GET /api/agent/grants` lists grants for the authenticated wallet.
- `GET /api/agent/grants/:id` reads one wallet-scoped grant.
- `POST /api/agent/grants/revoke` revokes an existing grant.

Grant create/update routes are not exposed. They should be added only as
side-effect-free approval/connect requests that cannot bypass human
authorization.

## Action Inventory

`contextEngine-cc/lib/agent/actionInventory.mjs` is the canonical private action
inventory. It maps web UX action families to `/api/agent/*` implemented or
planned routes, required grant scopes, risk levels, approval/delegation
behavior, signing/worker authority requirements, and whether Telegram/OpenClaw
may call the route directly.

Implemented or contract-only families cover read identity/session/question,
draft response, submit request, delegated response execution, and grant revoke.
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
It uses dependency-free pure contract tests and router-level agent harness tests.
In the current checkout, `contextEngine-cc/server.mjs`,
`contextEngine-cc/package.json`, and
`contextEngine-cc/public/js/sessionSlugs.mjs` are absent from this branch and
local `dev` history. Do not recreate them just to gain app-server HTTP coverage;
restore or generate them only through an intentional CE-CC runtime packaging
workflow.

From the repo root, `npm run test:cc` is meaningful: when the runtime files are
absent, it runs marked private fallback tests for `contextEngine-cc/lib/agent/*`
and the router contract harness. True app-server HTTP tests for `/api/agent/*`
wait for an intentional CE-CC runtime packaging decision.

Private implementation and contract details stay under public-release strip
patterns: `contextEngine-cc/**` and `docs/agent-native*.md`. CE-CC local state,
secrets, dependency installs, logs, and caches remain ignored even though source
files are private-tracked.

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
