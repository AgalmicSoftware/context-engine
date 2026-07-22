# ADR-0002: Worker Auth Revalidation

## Status

Accepted; amended 2026-07-21 to fail closed on missing or empty `jti` and to
revalidate route authorization against current policy.

## Context

The session CORS worker previously minted signed login tokens with `{ sub, slug,
scopes, exp }` and a 24-hour lifetime. Authenticated routes validated signature,
shape, expiration, and session-slug binding, but did not re-check a server-side
token record after login. That left stale scopes usable until token expiration
when gates changed or a token needed to be revoked.

The later auth-state amendment also moved nonce issue/consume and route counters
behind the existing `CE_SESSION_COORDINATOR` Durable Object. KV markers remain
diagnostic mirrors rather than the consume or counter authority.

## Decision

Use KV claim tokens plus shorter login tokens and current-policy route checks:

- New login tokens carry `{ sub, slug, authzEpoch, scopes, exp, jti }`.
- `jti` is crypto-random, preferring `crypto.randomUUID()` when available and
  falling back to 16 random bytes encoded as base64url.
- Login persists `authToken:{slug}:{sub}:{jti}` in `GROUP_KV` before returning
  `{ token, exp }`.
- The KV marker TTL is aligned to the token lifetime.
- `TOKEN_TTL_SECONDS` is 14,400 seconds (4 hours).
- Token verification rejects missing, empty, or whitespace-only `jti` claims.
- Authenticated routes reject tokens when the KV marker is absent or aged
  out, using the existing `401 { error: "Invalid token." }` response shape.
- The former legacy no-`jti` compatibility window is closed. The worker neither
  mints nor accepts no-`jti` tokens.
- Session config owns a server-managed non-negative `authzEpoch`. Effective
  signed `set-config` writes increment it; rejected and idempotent writes do
  not. Authenticated routes reject a token whose epoch differs from current
  config before route dispatch.
- Each protected route re-evaluates the current default gate and only the
  route-specific resource gate required by that scope. The signed scope and
  the current scope must both allow the route. Policy-read errors fail closed.
- A legacy config and token with no epoch are interpreted as epoch zero. The
  first effective config change advances the config to epoch one and
  invalidates those tokens.

The existing nonce, used-nonce, rate-window, and token TTLs remain unchanged.
SIWE origin/freshness validation and current-policy scope computation keep their
existing contracts.

## Consequences

Config changes invalidate earlier tokens immediately through the authorization
epoch. Registry gate and membership changes take effect on the next protected
request through live route-specific revalidation, so authorization freshness no
longer depends on the four-hour token lifetime. A token can also be invalidated
directly by deleting its `authToken:{slug}:{sub}:{jti}` KV record.

ADR-0004 records the earlier risk acceptance and its 2026-07-21 supersession by
the Durable Object authority.

## Tests

Worker tests cover:

- Token payloads include `jti` and login fails closed when marker persistence
  fails.
- Token payloads bind the current `authzEpoch`; stale or malformed epochs fail
  before protected route dispatch.
- Protected routes require both their signed scope and a successful current
  route-specific policy check, including a regression where a gate is disabled
  after login.
- Effective config mutation increments the epoch exactly once, while rejected,
  idempotent, limit-only, and Lit-credential writes do not.
- Verification rejects missing or blank `jti` claims.
- Every authenticated token requires a live KV marker.
- Revoking or aging out the marker invalidates the token.
- `jti` payload type validation.
- The 4-hour top-level token TTL.
- Existing same-isolate nonce redemption and fixed-window nonce-rate behavior,
  including a burst pin, remain unchanged at the response boundary.
- Parallel coordinator requests prove one successful nonce consume and exactly
  the configured count of successful rate admissions.

## Rollback

Rollback must not silently restore no-`jti` acceptance, disable the KV marker
check, remove epoch binding, or trust signed scopes without current-policy
revalidation. Any of those changes would expand stale-token exposure and
requires an explicit security decision plus a separately reviewed rollback.
