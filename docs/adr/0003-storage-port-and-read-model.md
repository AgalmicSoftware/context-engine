# ADR-0003: Storage Port and Read Model

## Status

Accepted.

## Context

On 2026-07-02, and reaffirmed on 2026-07-05, the project chose stable
session-storage route names for uploaded metadata and payload reads. Earlier
earlier planning used read/list wording, but the implemented route
contract now uses upload, fetch, and query names.

## Decision

Canonical storage routes are:

- `/storage/upload`
- `/storage/fetch`
- `/storage/query`

The Phase 8 read/list naming is superseded. Backend portability remains deferred;
this ADR records the route contract only and does not require code changes.

## Consequences

Docs and future storage adapters should describe the upload/fetch/query route
contract. Any future backend portability work must preserve these route names or
ship an explicit migration plan.
