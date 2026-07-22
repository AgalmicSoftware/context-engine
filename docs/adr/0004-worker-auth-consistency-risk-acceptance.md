# ADR-0004: Worker Auth Consistency Risk Acceptance

## Status

Superseded on 2026-07-21. The accepted KV consistency risk is closed by the
mandatory `CE_SESSION_COORDINATOR` Durable Object authority described below.

## Context

Nonce single-use and auth nonce rate limiting are strongly consistent only inside
one Worker isolate. `workers/sessionCorsWorker/nonceLifecycle.js` uses an
in-isolate `nonceConsumeLocks` map to serialize nonce consumption for the same
`slug:address:nonce` key, then records used nonces in KV. The same file uses a
fixed-window KV counter for nonce request rate limiting.

Cloudflare KV remains eventually consistent across isolates, so the same-isolate
lock does not make nonce use or rate counters globally linearizable.

## Historical Decision

Accept this residual consistency risk as of 2026-07-05.

This is bounded by the existing worker auth limits:

- SIWE login max age is 5 minutes.
- Auth nonces expire after 5 minutes.
- Used nonce markers expire after 10 minutes.
- Login tokens expire after 14,400 seconds (4 hours).
- `jti` token markers are checked in KV and can be revoked by deleting
  `authToken:{slug}:{sub}:{jti}`.

Revisit this decision if abuse is observed or if nonce/rate-limit consistency
becomes a stronger security requirement.

## Superseding Decision

Nonce issue/consume and nonce, authenticated, anonymous, and faucet route
counters now use the existing SQLite-backed `SessionWriteCoordinator` Durable
Object binding. Object identity is a SHA-256 digest of the session, route, and
principal boundary; persisted counter records do not contain the slug, wallet,
anonymous identifier, or route name. KV nonce/used markers remain diagnostic
compatibility mirrors and are not authorization authority.

Missing or unreachable coordination fails closed. One-click deploys already
install the binding and migration; manual deploys must bind
`CE_SESSION_COORDINATOR` before auth or rate-limited routes can operate.

Concurrency tests issue parallel requests to one object and prove exactly one
nonce consumption plus exactly the configured number of admitted requests. The
four-hour JTI/KV token-marker decision and current-policy revalidation remain in
ADR-0002.
