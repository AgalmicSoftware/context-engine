# ADR-0003: Storage Port and Read Model

## Status

Accepted.

## Context

On 2026-07-02, and reaffirmed on 2026-07-05, the project chose stable
session-storage route names for uploaded metadata and payload reads. Earlier
planning used fetch/query wording, but the implemented route contract uses
upload/read/list names. The encrypted-envelope export route was added later as
a ciphertext-only portability surface.

## Decision

Canonical storage routes are:

- `/storage/upload`
- `/storage/read`
- `/storage/list`
- `/storage/export-envelopes`

The earlier fetch/query naming is superseded. Backend portability remains
deferred; this ADR records the route contract only and does not require code
changes.

## Consequences

Docs and future storage adapters should describe the upload/read/list route
contract. `/storage/export-envelopes` exports encrypted payload envelopes and
metadata without decrypting them or returning session key material. Any future
backend portability work must preserve these route names or ship an explicit
migration plan.
