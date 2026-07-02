# Worker Auth Phase 7 Options

This document records the implementation choice for making worker login nonce
redemption, nonce-rate limiting, and token lifetime harder to race across
Cloudflare isolates. It is a decision artifact only; no worker code or deployment
configuration changes are made here.

## Current State

- Login and signed-admin nonce redemption share `consumeNonce`; login calls it
  after SIWE address/origin validation and before scope computation
  (`workers/sessionCorsWorker/authLoginRequestAuthority.js:127-140`), and admin
  signed requests call the same dependency before admin authorization
  (`workers/sessionCorsWorker/adminRequestAuthority.js:305-325`).
- `consumeNonce` serializes same-isolate redemption with a process-local `Map`
  (`workers/sessionCorsWorker/nonceLifecycle.js:5-24`) and writes a per-redemption
  claim marker before checking the active nonce (`workers/sessionCorsWorker/nonceLifecycle.js:51-84`).
  The unit coverage explicitly scopes that serialization to one isolate
  (`workers/sessionCorsWorker/nonceLifecycle.test.mjs:118-171`).
- Nonce request rate limiting is a fixed-window KV counter keyed by session,
  caller identity, and window start; it reads, increments, and writes the counter
  with a TTL (`workers/sessionCorsWorker/nonceLifecycle.js:88-128`). Coverage pins
  the fixed-window counter and caller-identity keying
  (`workers/sessionCorsWorker/nonceLifecycle.test.mjs:173-248`).
- Runtime constants are currently token TTL 24h, nonce TTL 5m, nonce-rate limit
  5 per 60s, used-nonce TTL 10m, SIWE max age 5m, and future skew 60s
  (`workers/sessionCorsWorker/workerTopLevelBinding.js:23-30`). Those constants
  flow through the route runtime input (`workers/sessionCorsWorker/workerRouteRuntimeInputResolution.js:78-85`)
  and worker auth bindings (`workers/sessionCorsWorker/authRequestBinding.js:40-43`,
  `workers/sessionCorsWorker/authRequestBinding.js:85-87`).
- Login tokens currently carry only `sub`, `slug`, `scopes`, and `exp` before HMAC
  signing (`workers/sessionCorsWorker/authLoginRequestDispatch.js:58-68`), and
  verification validates `exp`, `sub`, `scopes`, and `slug`
  (`workers/sessionCorsWorker/tokenSigning.js:114-131`).
- The worker docs still describe the KV nonce, used-nonce, and rate keys as the
  persisted auth state (`docs/session-cors-worker.md:638-640`).

## Option A: Durable Object Auth Authority

Use a Durable Object as the single writer for nonce issuance, nonce redemption,
and login-rate accounting per session or per session+identity shard.

Security bound achieved:

- Gives linearizable nonce redemption and rate-limit updates for requests routed
  to the same Durable Object instance, removing the cross-isolate window left by
  the current process-local lock (`workers/sessionCorsWorker/nonceLifecycle.js:5-24`)
  and KV read/increment/write counter (`workers/sessionCorsWorker/nonceLifecycle.js:112-120`).

Blast radius:

- Adds a new Cloudflare stateful service boundary to `/auth/nonce`, `/auth/login`,
  and signed admin requests, which currently share the KV-backed nonce consumer
  (`workers/sessionCorsWorker/authLoginRequestAuthority.js:135-140`,
  `workers/sessionCorsWorker/adminRequestAuthority.js:321-325`).
- Requires a deployment/config update because the current top-level worker
  binding passes constants and dependency bundles only; no Durable Object binding
  is part of the current auth runtime input (`workers/sessionCorsWorker/workerTopLevelBinding.js:46-80`,
  `workers/sessionCorsWorker/workerRuntimeDepResolution.js:180-200`).

Human-approval items:

- Add a Durable Object class and binding to the Cloudflare deployment path.
- Decide shard key: session slug alone versus session slug plus normalized caller
  identity.
- Decide migration policy for in-flight KV nonces during rollout.

Migration and rollback:

- Dual-read during rollout: new nonces are issued by the Durable Object, while
  legacy KV nonces can be redeemed through `consumeNonce` until `NONCE_TTL_SECONDS`
  has elapsed (`workers/sessionCorsWorker/workerTopLevelBinding.js:23-30`).
- Rollback switches issuance/redemption back to KV and leaves the Durable Object
  state to expire naturally.

Test plan:

- Unit-test concurrent redemption through the Durable Object actor, including two
  simultaneous `/auth/login` requests for one nonce.
- Unit-test nonce-rate increments under burst concurrency for one caller identity.
- Existing tests that pin nonce failure contracts remain unchanged
  (`workers/sessionCorsWorker/authLoginRequestAuthority.test.mjs:171-264`,
  `workers/sessionCorsWorker/adminSignatureAuthority.test.mjs:156-183`).
- E2E: run worker-scope matrix plus one gate-flow smoke against a deployed worker.

Findings closed:

- Closes the nonce replay race finding by introducing a single redemption writer.
- Closes the fixed-window KV lost-update finding by moving the counter update into
  the same authority.
- Token lifetime remains unchanged unless paired with a TTL decision below.

## Option B: KV Claim Tokens Plus Shorter Auth Tokens

Keep KV as storage, but extend the current claim-marker pattern and token payload:
embed a per-login `jti` in the signed token, persist the active token id or a
revocation floor in KV, and shorten token TTL.

Security bound achieved:

- Retains the current claim-before-check rollback pattern
  (`workers/sessionCorsWorker/nonceLifecycle.js:66-80`) without new infrastructure.
- Adds token-level replay tracking for authenticated routes, which currently only
  check token signature/shape/expiration (`workers/sessionCorsWorker/tokenSigning.js:85-131`).
- Shortening `TOKEN_TTL_SECONDS` reduces stale-scope exposure; current login tokens
  are valid for 24h (`workers/sessionCorsWorker/workerTopLevelBinding.js:23-30`).

Blast radius:

- Touches token signing, token verification, authenticated route preflight, and
  login dispatch. Login dispatch currently signs `{ sub, slug, scopes, exp }`
  (`workers/sessionCorsWorker/authLoginRequestDispatch.js:58-68`); verification
  currently accepts no token id field (`workers/sessionCorsWorker/tokenSigning.js:114-131`).
- No Cloudflare config or production secret shape change is required.

Migration and rollback:

- Accept old tokens without `jti` until the old 24h TTL expires, but mint only
  short-TTL `jti` tokens after deploy.
- Store `authToken:{slug}:{sub}:{jti}` or `authTokenFloor:{slug}:{sub}` in KV
  with TTL aligned to the new token lifetime.
- Rollback can continue accepting `jti` tokens as ordinary signed tokens if the
  verifier treats unknown extra fields as non-authoritative, or can disable the
  KV token-id check after the new shorter TTL.

Test plan:

- Unit-test token payload shape, token verification with and without `jti`, expired
  token rejection, and missing/unknown token-id rejection after the compatibility
  window.
- Unit-test stale-scope behavior after gate revocation by invalidating or aging out
  the token id.
- Unit-test login bursts to verify the current fixed-window nonce-rate behavior is
  not weakened (`workers/sessionCorsWorker/nonceLifecycle.test.mjs:173-248`).
- E2E: worker-scope matrix and one gate-flow smoke.

Findings closed:

- Partially closes nonce replay risk by bounding accepted replayed credentials to
  shorter token lifetimes and token ids.
- Closes stale-scope duration by reducing token lifetime and enabling token-id
  invalidation.
- Does not fully close cross-isolate nonce/rate lost updates; it is an incremental
  no-infra mitigation.

## Option C: Risk Acceptance With Documented Bounds

Keep the current KV + in-isolate lock design and document the residual risk.

Security bound achieved:

- Preserves current behavior exactly: process-local lock for same-isolate nonce
  redemption (`workers/sessionCorsWorker/nonceLifecycle.js:5-24`), KV used-nonce
  marker (`workers/sessionCorsWorker/nonceLifecycle.js:58-84`), and fixed-window
  nonce-rate counter (`workers/sessionCorsWorker/nonceLifecycle.js:88-128`).

Blast radius:

- No code, config, or secret changes.
- Residual exposure remains bounded by the current TTLs: 5m nonce TTL, 10m
  used-nonce marker, 24h token TTL (`workers/sessionCorsWorker/workerTopLevelBinding.js:23-30`).

Migration and rollback:

- No migration.
- Rollback is not applicable.

Test plan:

- Keep the existing same-isolate nonce race test and nonce-rate tests
  (`workers/sessionCorsWorker/nonceLifecycle.test.mjs:118-248`).
- Add a docs-only audit note that cross-isolate races are accepted, not fixed.

Findings closed:

- None. This is an explicit risk-accept path for nonce/rate consistency and stale
  token lifetime findings.

## Recommendation

Choose Option B unless a human explicitly approves the Cloudflare Durable Object
config work for Option A. Option B gives a measurable reduction in stale-token
and replay blast radius without new infrastructure, preserves the existing KV
claim-marker pattern, and leaves Option A available for a later stronger
consistency boundary. Do not choose Option C unless the project accepts the
current 24h token lifetime and cross-isolate KV race window as documented risk.
