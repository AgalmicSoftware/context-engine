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
| Request status | `GET /api/agent/requests/:id` | None | Agent-native request read |

Legacy routes remain supported. The canonical routes require the same local JWT
auth as their CE-CC equivalents and do not weaken worker-token or trusted-local
checks.

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

Request ids use opaque `agent_req_...` values. Client-supplied idempotency keys
are optional, lowercased, bounded, and matched only inside the authenticated
wallet scope.

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
- `get_inbox`
- `get_request_status`

Planned descriptors are present for `create_question_request`,
`request_decrypt`, and `revoke_agent_grant`, but no SDK dependency or second
runtime path has been added.

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

## Telegram Compatibility

Telegram is a delivery and interaction surface, not a signer or authority
boundary. V1 targets private DM and Mini App flows first; groups and topics are
future work unless they only need parsing or docs.

Rules:

- `callback_data` uses opaque short action IDs, not full payloads or secrets.
- Mini App `initData` must be validated server-side before trusting Telegram
  identity. The helper follows Telegram's official Mini App HMAC validation
  flow: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
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
