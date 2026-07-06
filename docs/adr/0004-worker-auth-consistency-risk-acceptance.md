# ADR-0004: Worker Auth Consistency Risk Acceptance

## Status

Accepted.

## Context

Nonce single-use and auth nonce rate limiting are strongly consistent only inside
one Worker isolate. `workers/sessionCorsWorker/nonceLifecycle.js` uses an
in-isolate `nonceConsumeLocks` map to serialize nonce consumption for the same
`slug:address:nonce` key, then records used nonces in KV. The same file uses a
fixed-window KV counter for nonce request rate limiting.

Cloudflare KV remains eventually consistent across isolates, so the same-isolate
lock does not make nonce use or rate counters globally linearizable.

## Decision

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

## Consequences

The project does not add a Durable Object or other linearizable authority for
nonce and rate-limit state in this lane. ADR-0002 remains the stale-token
revalidation decision; this ADR records the accepted nonce/rate-limit
consistency tradeoff.
