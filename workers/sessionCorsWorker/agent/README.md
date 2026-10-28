# Session Worker Agent HTTP

New sessions serve `/api/agent/*`, ordinary participant routes and optional
Session Wrapped from one Session Worker origin. The implementation lives in
`workers/sessionCorsWorker/agent/`; the existing Worker owns session identity,
configuration, membership, storage, gates, rate limits and admin authority.

Enable `sessionModeProfile.surfaces.agentHttp` through the signed session
configuration flow. `/capabilities?slug=<slug>` advertises `agent_http_v1` and
current readiness. `/health` keeps its authenticated participant behavior.
Agent HTTP being off leaves ordinary web and MCP participation available.

## Setup

The Session Worker needs its existing `GROUP_KV`, `CE_SESSION_COORDINATOR` and
`TOKEN_HMAC_SECRET`, plus a fresh independent 32-byte `AGENT_MANAGED_ROOT_SECRET`
Worker secret. The deploy helper creates the latter and preserves it on retry.
For the native template, create this secret in Cloudflare before enabling agent
access; the wizard checks readiness after saving the canonical configuration.
No extra KV namespace, coordinator class or migration is needed for agents.

Managed accounts derive from this fresh secret, the canonical session ID and
an opaque principal. Never reuse an old Bridge root or deployment identity.
Signing supports configured OP Sepolia and best-effort Base Sepolia testnet
sessions only. Root, client, MCP and CE-CC remain on ethers v5; this Worker uses
its isolated ethers v6 package.

## Credentials and authority

An operator uses the existing signed Session Worker admin request to
`POST /api/agent/credentials/service`. A user redeems a session-bound invite at
`POST /api/agent/invite/onboard`; configure only its SHA-256 hash in
`agentHttp.invites`. Redemption is journaled atomically by the existing
`SessionWriteCoordinator`, separately for each session and invite.

User, service, member and browser credentials remain separate purposes. Each
credential binds the canonical session, exact origin, principal, authorization
epoch, scopes, expiry and active rotation slot. Operator writes retain signed
action/body/session/nonce checks; `httpMethod` is included in the signed body
and must match the request method. Auxiliary scoped-admin actions also require
current canonical admin authority. Caller-supplied principal fields never select
another identity.

Browser exchange requires a user credential or a service with `session_login`.
It returns distinct agent and participant credentials at the same origin; the
participant JWT cannot outlive its source and becomes unusable on source
revocation, rotation, session disablement or stale authority. Both exchanged
credentials stay in page memory. Reload requires a fresh exchange.

## Data and submission

Hosted & Fast uses canonical Cloudflare payload storage. Trustless & Slower
retains registry/Surveys authority and its configured storage backend (Arweave
by default). Research buckets and Wrapped predictions do not grant membership
or become ordinary responses.

Question reads are bounded and paginated. Follow `nextCursor` until `hasMore`
is false; cursors bind the caller, session, revision and current question set.
Locked or unavailable questions cannot be answered. Partial source reads fail
closed rather than presenting a complete empty collection. More than 2,000
proposals produce a capped question list with `complete: false` and
`questionSourceReason: "agent_proposals_capped"`; aggregates reject that partial
source with 503.

Current agent results and the participant's answered state select one answer per
session, participant and question: highest `answerRevision` (legacy records use
zero), then `createdAt`, then `requestId`, with deterministic content tie-breaking.
Selected answers are ordered chronologically by `createdAt`, then `requestId`;
revisions do not order different participants or questions. Consensus, difference,
groups, Polis and topic maps use this same selection; submission records retain history.

`/preferences` saves drafts unless an explicitly authorized submit is requested.
The coordinator retains an answer head per session, principal and question.
Resubmitting its current content reuses the same request; changing content claims
the next revision, including when changing back to a previous answer. Claims
serialize concurrent edits before direct or queued effects. Legacy answers have
revision zero; the first new claim starts at one. Answer heads and submission
journals are excluded from session backups, so restored sessions start fresh heads.
Hosted submission uses canonical upload receipts; retries replay one stored response. Direct-submission admission and outcomes live in the coordinator. Finished
outcomes project to KV once; a failed projection does not change a committed
success. A durable alarm repairs it at least one second after the last attempt,
without sleeping in the session lock. Reads consult the journal while KV is
pending. Draft and submission timestamps are server-owned, and invalid payloads
are rejected before admission. Optional registry submissions use `AGENT_RESPONSE_QUEUE` only
when `agentHttp.asyncSubmitEnabled` is enabled. Queue work rechecks current
source credentials, gates and config before new effects; known outcomes can be
persisted after revocation. A known queued success remains successful when its
KV projection is delayed and a persistence-only repair message has been accepted;
that repair waits at least one second and cannot repeat external effects.
Unknown broadcasts require reconciliation. KV is
not a distributed transaction lock and these operations do not promise exactly
once execution.

Optional Wrangler queue configuration (use an operator-created queue name):

```json
{
  "queues": {
    "producers": [{ "binding": "AGENT_RESPONSE_QUEUE", "queue": "session-agent-responses" }],
    "consumers": [{ "queue": "session-agent-responses", "max_batch_size": 1, "max_retries": 4, "retry_delay": 30 }]
  }
}
```

## AI and Wrapped

Each session has one continuous Wrapped space. There is no opening action,
weekly rotation, window ID or shared statement snapshot. Statement reads check
current per-question access and never write shared research data. Every answer
and vote supplies the returned `statement_version`; a question edit invalidates
that version and requires a fresh read. Saved research retains the exact
statement wording and answer schema it used. Later edits or selection changes
do not rewrite those records, and exports still filter current access.

Text AI uses the session's saved provider key, selected models and existing AI
request policy, with bounded requests, rate limits and concurrency. There is no
runtime test-key fallback. Wrapped posters are off by default. Local rendering
is available when enabled; paid rendering additionally requires
`agentHttp.wrapped.posterRenderer: "openai"` and the independent operator
secret `AGENT_POSTER_API_KEY`. Callers cannot select a more expensive provider
configuration. Provider requests have bounded bytes/deadlines and coordinated
daily budgets. Same-run requests coalesce within an isolate; cross-isolate
exactly-once provider charging is not guaranteed. Public image links expire in
seven days and support GET and HEAD.

## Backups and old deployments

Auxiliary state is fresh and namespaced under `ce-agent:<canonicalSessionId>:`
in `GROUP_KV`. Archives exclude credentials, rotation slots, drafts, proposals,
Wrapped records/images, caches, pending submissions, invite material/journals
and managed root secrets. Canonical responses and Worker groups retain their
normal backup coverage. Restore rejects targets containing agent or invite
state. Reissue credentials and create new invites after restore; archives
cannot recover managed signing keys.

There is no Bridge URL fallback, forwarding, migration, identity transfer or
invite transfer. Existing Bridge-backed sessions keep their old deployments
until separately retired by their owner. Updating this source does not deploy
code or delete existing resources.

## Runtime instructions and verification

Use [Agent access](skills/ce-agent-access/SKILL.md) or
[Session Wrapped](skills/ce-session-wrapped/SKILL.md). The route inventory is
[`routes.mjs`](routes.mjs). Agent tests run with `npm run test:worker:agent`;
the former `test:worker:agent-bridge` command invokes the same maintained tests.
See [the coverage map](testing.md) and the [Worker guide](../../../docs/session-cors-worker.md).
