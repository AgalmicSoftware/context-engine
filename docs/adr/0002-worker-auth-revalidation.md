# ADR-0002: Worker Auth Revalidation

## Status

Accepted.

## Context

The session CORS worker previously minted signed login tokens with `{ sub, slug,
scopes, exp }` and a 24-hour lifetime. Authenticated routes validated signature,
shape, expiration, and session-slug binding, but did not re-check a server-side
token record after login. That left stale scopes usable until token expiration
when gates changed or a token needed to be revoked.

Nonce redemption and nonce-rate limiting remain KV-backed. KV is eventually
consistent across isolates, so a no-infrastructure hardening pass can reduce
stale-token exposure but cannot make nonce redemption or rate counters
linearizable across all isolates.

## Decision

Use KV claim tokens plus shorter login tokens:

- New login tokens carry `{ sub, slug, scopes, exp, jti }`.
- `jti` is crypto-random, preferring `crypto.randomUUID()` when available and
  falling back to 16 random bytes encoded as base64url.
- Login persists `authToken:{slug}:{sub}:{jti}` in `GROUP_KV` before returning
  `{ token, exp }`.
- The KV marker TTL is aligned to the token lifetime.
- `TOKEN_TTL_SECONDS` is 14,400 seconds (4 hours).
- Authenticated routes reject `jti` tokens when the KV marker is absent or aged
  out, using the existing `401 { error: "Invalid token." }` response shape.
- Legacy no-`jti` tokens remain accepted by signature, payload shape, expiration,
  and slug binding until their natural old 24-hour expiration. The worker no
  longer mints no-`jti` tokens.

No Durable Object binding, production config, SIWE validation, origin check,
scope computation, nonce TTL, nonce-rate limit, or used-nonce TTL changes are
part of this decision.

## Consequences

Stale-scope exposure is reduced from 24 hours to 4 hours for newly minted tokens,
and a token can be invalidated by deleting its `authToken:{slug}:{sub}:{jti}` KV
record. A small revocation helper exists for that marker, but no gate-change call
site currently performs token revocation automatically.

The residual cross-isolate KV race remains for nonce redemption and nonce-rate
counter updates. Option A from the design note, a Durable Object authority, is
the future upgrade path if the project needs linearizable nonce and rate-limit
state.

## Tests

Worker tests cover:

- Token payloads include `jti` and login fails closed when marker persistence
  fails.
- `jti` token verification requires a live KV marker.
- Legacy no-`jti` tokens skip the marker check during the compatibility window.
- Revoking or aging out the marker invalidates the token.
- `jti` payload type validation.
- The 4-hour top-level token TTL.
- Existing same-isolate nonce redemption and fixed-window nonce-rate behavior,
  including a burst pin, remain unchanged.

## Rollback

Rollback can keep accepting `jti` tokens as ordinary signed tokens by disabling
the KV marker check, or can revert token minting after all 4-hour `jti` tokens
have naturally expired. Restoring 24-hour tokens would expand stale-token
exposure and should be treated as a security rollback.
