# Agent Bridge Worker

`workers/agentBridgeWorker/` serves Context Engine Agent HTTP and Session
Wrapped. It is separate from `workers/sessionCorsWorker/` and ships as part of
the public worker surface.

## Runtime boundary

- `/api/agent/*` is the canonical API. `/telegram/agent/api/*` remains an HTTP
  compatibility alias for existing credentials and clients.
- `/health` reports the protocol and exact deployment-pinned Session Worker.
  `/session-wrapped` redirects to the dedicated runtime skill.
- Bot webhooks, chat commands, callbacks, previews, photo delivery, Mini App
  pages/APIs, onboarding, launch links, group approval actions, and question
  posing routes are removed. Old enablement flags cannot reactivate them.
- `sessionModeProfile.surfaces.agentHttp` controls access. An explicit false
  overrides legacy enablement. Reserved `surfaces.telegram` and
  `surfaces.miniApp` remain readable for compatibility; new configurations
  should write them false.
- For profile-less legacy policies, `agentHttpEnabled` takes precedence over
  the `agentHttp` alias, including when explicitly false. The alias is a fallback
  only when the current field is absent or null.
- Hosted groups, proposals, and child sessions require
  `authority.mode=worker_canonical` and Agent HTTP. Question storage follows
  explicit authority before legacy flags. Public metadata includes
  `agentHttpEnabled`, `authorityMode`, and `clientSubmitReady`.
- Hosted & Fast is the default/recommended profile and uses Cloudflare storage.
  Trustless & Slower uses Arweave. Compatible legacy/custom drafts can retain an
  Arweave fallback when no explicit storage profile exists. The Session Worker
  chooses storage and enforces its authentication, membership, and gate policy.

## Credentials and accounts

A `ceagt_` credential binds an opaque principal, session, audience, scopes,
expiry, and rotation slot. Keep bearer values private and send them through
`Authorization: Bearer ...`, never URL query parameters.

`POST /api/agent/invite/onboard` accepts a configured one-time invite in JSON
and creates an opaque user principal. Caller-supplied transport identity or
init data cannot claim another user's account or change historical bindings.
The `AGENT_INVITE_COORDINATOR` Durable Object reserves and finalizes redemption
by token hash. Concurrent requests cannot issue two credentials. Missing
coordinator authority fails closed. Uncertain issuance/finalization keeps the
invite reserved; only failures known to precede issuance release it. Legacy KV
redemption records remain readable and continue to deny replay.

`POST /api/agent/credentials/service` lets an operator issue a named, scoped
service credential. `AGENT_BRIDGE_AGENT_API_TOKEN` is root/bootstrap authority;
ordinary integrations should use their own scoped credentials.

`POST /api/agent/client-login/exchange` exchanges a source user/service
credential for a short-lived Bridge browser credential and a separate Session
Worker JWT. A person's own `user` credential retains this behavior. A `service`
credential needs the explicit `session_login` scope, which is never a default:
it authorizes the managed account's full Session Worker policy, including any
permitted storage and AI operations. Bridge capability flags do not restrict
that JWT. Without this scope, exchange returns 403
`agent_credential_session_login_denied`; the web client requires both credentials.

The Worker currently issues fixed four-hour tokens. If its returned token would
outlive the source credential, exchange returns 403
`agent_credential_expiry_too_short` without exposing either child credential.
Bridge browser credentials last at most one hour and never outlive the source.
Revoking the source does not revoke already-issued child credentials; the Worker
JWT remains usable until its expiry or separate Worker revocation. Shorter
Worker lifetimes require a login API change. Child credentials cannot be
exchanged again. Each credential must
be sent only to its intended origin and audience. Same-slug session or Worker
replacement invalidates credentials bound to the old identity.

`POST /api/agent/wrapped/member-exchange` verifies an existing Session Worker
credential through the pinned Worker's `/groups/my-memberships` endpoint. It
issues a session-bound `agent_autofill` member credential for worker-canonical
or registry-canonical sessions. Its lifetime is no longer than 24 hours or the
remaining Worker credential lifetime, whichever is shorter. The Bridge does
not replace the Worker's SIWE, membership, or SBT gate verification.

Credential rotation publishes the replacement before retiring the old record.
Missing `DEMO_SIGNER_ROOT_SECRET` fails closed. Managed accounts remain
deterministic by principal and deployment; raw key material is never included
in metadata or API responses. Worker-side signing is limited to managed demo
accounts on configured testnets. OP Sepolia (`11155420`) is the default.

## Agent instructions

The deployed `/api/agent/skill` and `/api/agent/skill-version` routes identify
the current [Agent HTTP runtime skill](skills/ce-agent-access/SKILL.md).
The [old handoff URL](skills/ce-telegram-agent-handoff/SKILL.md) remains a
compatibility entry to the same workflow. The
[Session Wrapped skill](skills/ce-session-wrapped/SKILL.md) is available at
`/session-wrapped` and `/api/agent/session-wrapped/skill`.

For a source-pinned install:

```bash
CE_SKILL_REF="${CE_SKILL_REF:-main}"
hermes skills install "https://raw.githubusercontent.com/AgalmicSoftware/context-engine/${CE_SKILL_REF}/workers/agentBridgeWorker/skills/ce-agent-access/SKILL.md"
```

Cache instructions by Worker origin and version; refresh when the deployed
version changes. Current skill versions describe current behavior. Historical
recorded instruction versions and missing provenance retain their original
values on reads and exports.

## Retained API

| Operation | Route |
| --- | --- |
| Public session metadata | `GET /api/agent/session-meta` |
| Questions and tags | `GET /api/agent/questions`, `GET /api/agent/tags` |
| Preferences and authorized submit | `POST /api/agent/preferences` |
| Ordinary onboarding and settings | `GET/POST /api/agent/onboarding` |
| Create questions | `POST /api/agent/questions/create` |
| Activity | `GET /api/agent/actions` |
| Groups, proposals, child sessions | `GET /api/agent/groups`, `POST /api/agent/groups/propose`, `POST /api/agent/sessions/child` |
| Question queue | `GET/POST /api/agent/question-queue`, `POST /api/agent/question-queue/plan`, `POST /api/agent/question-queue/apply`, `GET/POST /api/agent/questions/next` |
| Importance votes | `POST /api/agent/question-votes/recommend`, `POST /api/agent/question-votes/apply` |
| Aggregates and images | `GET/POST /api/agent/results`, `GET /api/agent/results-image` |
| Cached analysis and Geo metadata | `/api/agent/result-view-cache`, `/api/agent/geo-backlink` |
| Admin status and metrics | `GET/POST /api/agent/admin/status`, `GET/POST /api/agent/admin/metrics` |
| Admin configuration | `/api/agent/admin/default-session`, `/api/agent/admin/skill-update`, `POST /api/agent/admin/questions/delete` |

These routes enforce credentials, scopes, session authority, and applicable
admin/group policy. A route being available does not grant permission to use
it. Registry discovery supports explicit read routes only; it cannot authorize
credential issuance, managed writes, or GET operations that cause effects.

Question reads expose submitted answers through `myAnswer`, `answeredByUser`,
`answeredAt`, and `answerStatus`. Typed answers retain their authoritative
rating bounds/step, ordered choices, quadratic budget, and optional comments.
Quadratic allocations contain one signed integer per option, with the sum of
squares no larger than `voiceCredits` (99 by default).

Preferences save drafts by default. A normal explicit submit requires
`submit: true` and `humanApproved: true` at the top level of the JSON request.
Question-vote approvals likewise record caller authorization; new Agent HTTP
vote records never claim verified human review. Historical review records remain readable.
The latter is a caller assertion of submission authorization; it is not proof
of human review and does not create human confirmation/edit events. A queued
request is pending until settlement. Confirm each intended request ID and
stored answer before reporting completion.

## Session Wrapped and historical evidence

`GET /api/agent/agent-only/start` returns the versioned runtime instructions and
same-origin endpoint paths. Authorized callers page statements, submit typed
predictions to `/agent-only/answers/bulk`, optionally submit explicitly
requested token allocations to `/agent-only/token-votes/bulk`, and generate an
image through `/agent-only/wrapped-image` (all below `/api/agent`). Wrapped
predictions do not submit normal CE responses.

Admin configuration, window opening, and research exports remain at
`/api/agent/admin/agent-only/config`, `/window/open`, and `/export` respectively.
Historic human confirmations, edits, and vote records remain readable and
exportable with their original evidence labels. Current routes cannot create
those human-review records, and agent-generated output is not relabeled as
human evidence. Public aggregate results remain thresholded and omit raw
participant identifiers and qualitative response text.

## Direct submissions and queue recovery

Direct submit requires session policy, a Session Worker URL, Surveys address,
and supported testnet configuration. The Worker authenticates at execution
time, uploads through `/storage/upload`, and submits the returned storage
reference to `Surveys.submitResponses`. Sponsored gas is requested only when
session policy permits it. `AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED=false` or
`BROADCAST_ENABLED=false` keeps a local canonical handoff record instead of
broadcasting; the handoff's `/api/agent/responses/submit-request` value is a
stored contract reference, not a served Bridge endpoint.

Set `AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED=true` and bind `AGENT_RESPONSE_QUEUE` to
accept requests as `submit_queued` and settle them through the queue consumer.
Snapshots retain canonical session IDs and the minimal authority/Agent HTTP
profile. Legacy profile-less queue records remain readable. Exact same-answer
replays reuse the request ID. A terminal failure explicitly marked
`safeToRetry` can be resubmitted after repair with its original answer timestamp.
Unknown or uncertain outcomes require reconciliation. If queue publication fails,
the response marks that skipped submission `retryable: true`, and an explicit
same-answer retry re-enqueues the saved pending record with the same
queue generation and timestamp. It does not rewrite a concurrent consumer's
intent or outcome, and it never falls through to a direct chain submission.
A second publication failure remains an error; completed or uncertain records
are replayed without another queue message.

- Async queue consumers authenticate at execution time; the stored answer keeps
  its original creation timestamp. Failed replay reads and rating metadata reads
  remain pending. Nonce/login transport failures (including interrupted response
  bodies), HTTP 408/429, and 5xx responses retry before upload. A definite upload
  admission rejection retries only for 429; other definite admission/validation
  rejections become terminal safe failures. Malformed successful auth responses,
  terminal auth 4xx responses, and invalid configuration do not automatically retry.
  Configuration and account derivation failures before submission effects are
  stored as terminal safe failures, so an explicit same-answer resubmission can
  proceed after configuration is repaired. Legacy failures without an explicit
  safety marker and uncertain outcomes remain blocked pending reconciliation.
  Queue retries wait at least 60 seconds (including nonce backpressure), double
  up to one hour, and honor a longer `Retry-After` up to 24 hours. The default
  fourth delivery stores `direct_submit_failed` with `retryExhausted` and
  `safeToRetry`, then acknowledges. It no longer remains `submit_queued`.
  After authentication and before side effects, a persisted in-progress marker
  prevents a visible duplicate from starting a second submission. Once upload
  or transaction submission may have started, ambiguous failures are
  stored as `direct_submit_reconciliation_required`, with known storage and
  transaction identifiers, and acknowledged without automatic resubmission.
  If result persistence fails, a persistence-only message in the same queue
  retains the outcome, original timestamp and known identifiers. That consumer
  writes only the existing record/index keys; it cannot authenticate, fund,
  upload, or broadcast. Request identity and queue generation checks prevent
  cross-request or stale-attempt overwrites. If persistence remains unavailable,
  these messages retry into the configured dead-letter queue for later replay.
  If both KV and recovery publication fail, structured diagnostics contain the
  public identifiers and `diagnosticsRetained` is false; logs alone are not a
  durable recovery guarantee. Existing success and reconciliation records suppress
  queue replay when visible in KV. KV is eventually consistent and its read/write
  pair is not a lock: simultaneous consumers or process termination before the
  outcome is retained can still leave uncertainty. This is not exactly-once
  submission or automatic transaction reconciliation.

Async deployments must configure a dead-letter queue and keep
`AGENT_BRIDGE_SUBMIT_MAX_ATTEMPTS <= queues.consumers.max_retries + 1`.
The example pins four application attempts to `max_retries = 3` and
`retry_delay = 60`; `AGENT_BRIDGE_SUBMIT_RETRY_DELAY_SECONDS` defaults to 60.
Raising only the application limit can leave a pending record when the platform
stops delivering earlier. Normal safe exhaustion is stored and acknowledged;
the DLQ retains persistence-only recovery messages and platform delivery failures.

## Deployment

A dedicated Bridge requires exactly one explicit policy session, a matching
default slug, `surfaces.agentHttp=true`, and a Session Worker origin matching
`CE_SESSION_WORKER_BASE_URL`. `/new` can provision the paired deployment;
`/admin` can check health, disable access, or redeploy. Activation publishes the
version-1 `agentSessionWrapped` capability only after resource upload, secrets,
bindings, pinned-authority health checks, and durable config persistence succeed.
Failures preserve the last verified origin/revision. The Cloudflare API token
is request-only and is not a deployed runtime secret.

The minimal runtime bindings are `AGENT_ACTION_KV` and
`AGENT_INVITE_COORDINATOR`; queue and analytics bindings are optional. No
Bridge-owned bot, document R2, or D1 resources are required. Examples live in
`.env.example`, `.dev.vars.example`, and `wrangler.example.toml`. They contain
placeholders only. `AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS` configures browser
origins; `AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS` is accepted only as a legacy
origin alias.

An operator retiring an existing bot must separately delete its webhook,
clear its command menu, revoke the bot token, and remove old bot/webhook
secrets from the deployed environment. Source cleanup does not perform those
live operations or delete historical data/resources.

## Compatibility and module map

`agentHttp.mjs` owns routing and credential authorization.
`agentSessionRuntime.mjs` owns shared question reads, drafts, submissions, and
results. `agentAnswerSchema.mjs` and `ratingScale.mjs` validate retained typed
answers. `agentSubmitQueue.mjs` owns durable submit/recovery behavior.
`agentOnlyMode.mjs` owns Wrapped predictions, images, and research exports.
`legacyCompatibility.mjs` and `legacyGroupAccess.mjs` contain historical
principal normalization and group authorization reads.

Existing `telegram:*` KV keys, record types, credential mappings,
`telegram:<subject>` principal derivation, on-chain source/account-mode values,
queue message types, idempotency inputs, pseudonym/HMAC inputs, legacy policy
fields, and old explicit group authorization remain unchanged. Retained new
code uses neutral module/function names. These persisted values are
compatibility identifiers and do not enable a chat transport.

## Local verification

```bash
npm run test:worker:agent-bridge
npm run test:wiring
npm run type-debt:check
npm run typecheck:client
npm run verify:public-release-surface
```
