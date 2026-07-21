# ADR-0002: Worker Auth Revalidation

## Status

Accepted; amended 2026-07-21 to fail closed on missing or empty `jti`.

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

The existing nonce, used-nonce, rate-window, and token TTLs remain unchanged.
SIWE origin/freshness validation and current-policy scope computation keep their
existing contracts.

## Consequences

Stale-scope exposure is bounded to 4 hours for minted tokens,
and a token can be invalidated by deleting its `authToken:{slug}:{sub}:{jti}` KV
record. A small revocation helper exists for that marker, but no gate-change call
site currently performs token revocation automatically.

ADR-0004 records the earlier risk acceptance and its 2026-07-21 supersession by
the Durable Object authority.

## Tests

Worker tests cover:

- Token payloads include `jti` and login fails closed when marker persistence
  fails.
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

Rollback must not silently restore no-`jti` acceptance or disable the KV marker
check. Either change would remove revocation and expand stale-token exposure, so
it requires an explicit security decision and a separately reviewed rollback.
