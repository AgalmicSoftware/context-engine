# Telegram Cloudflare 500-User Scale PRD

## Status

Draft for implementation. Initial code support adds optional queued submit
ingestion while preserving the current simple synchronous smoke path.

Related PRDs:

- [Telegram Response Export Scope](./telegram-response-export-scope-prd.md)

## Problem

Telegram sessions should support events where up to 500 participants open the
bot or Mini App and submit responses in a short time window. The current demo
deployment works for smoke testing, but the submit path can synchronously do
too much work: auth, storage upload, faucet, RPC broadcast, KV writes, result
reads, Telegram media upload, and AI/transcription calls can all compete inside
request-response paths.

The target behavior is that participant submissions are accepted quickly and
durably, while slower work runs asynchronously.

## Goals

- Support 500 simultaneous participants for a single Telegram-enabled session.
- Return submit acknowledgements quickly even when chain/RPC/AI systems are
slow.
- Keep response records durable before background settlement starts.
- Keep `/results` responsive by reading accepted response records or
materialized aggregates instead of performing expensive full recomputation.
- Preserve the existing smoke deployment mode for simple testing.
- Avoid hot-key writes and single global coordinators.

## Non-Goals

- Guarantee 500 simultaneous on-chain transactions. Chain settlement remains a
background process and depends on RPC, funding, nonce handling, and network
capacity.
- Add production billing controls or spend caps.
- Replace the session worker storage model.
- Make AI search/transcription unlimited; those remain rate-limited downstream
services.

## Cloudflare Constraints

- Workers Paid has no general requests-per-second limit, but each invocation
still has CPU, memory, subrequest, and simultaneous outgoing connection limits.
- Workers KV allows high fanout over different keys, but writes to the same key
are limited to one write per second. Session-wide counters or aggregates must
not be updated as a single KV hot key.
- A single Durable Object is appropriate for one session-sized coordinator, but
Cloudflare guidance puts a simple Durable Object around 500-1,000 req/sec and
less for storage-heavy work. Any global coordinator must be sharded.
- Queues are the intended burst buffer. A queue can absorb submit events and
process them in batches with retry/backoff behavior.
- D1 can be used for relational indexes, but a single D1 database is
single-threaded. It must use indexed, short queries or be sharded by session or
tenant.

Primary references:

- Cloudflare Workers limits:
  https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare KV limits:
  https://developers.cloudflare.com/kv/platform/limits/
- Cloudflare Durable Object throughput guidance:
  https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Cloudflare Queues limits:
  https://developers.cloudflare.com/queues/platform/limits/
- Cloudflare D1 limits:
  https://developers.cloudflare.com/d1/platform/limits/

## Operating Modes

### Telegram-Only Session Mode

Telegram-only mode is the Cloudflare-native mode for near-term event scale.
Session setup writes `telegramOnly = true` and `sessionMode = "telegram_only"`.
The Telegram bridge lists only these sessions and loads questions from the
preloaded session policy or Cloudflare session-worker storage list/read routes,
not from chain event scans. The CE web client shows a `Telegram-only session`
notice for these routes until public-session parity is restored.

This mode keeps blockchain/Arweave out of the hot participant path. Future
parity work can add an asynchronous export/anchor lane without changing
Telegram response UX.

### Smoke Mode

Smoke mode is the current simple deployment:

- `AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED=false`
- no `AGENT_RESPONSE_QUEUE` binding required
- standard sessions may run direct on-chain work synchronously when policy allows
- telegram-only sessions should store accepted responses in Cloudflare first
  and may skip chain settlement entirely during smoke testing
- suitable for low-concurrency manual testing

### Event Mode

Event mode is the 500-user target:

- `AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED=true`
- `AGENT_RESPONSE_QUEUE` bound as a Queue producer and consumer
- submit request stores an immutable KV record with status `submit_queued`
- request returns after the record is stored and queued
- queue consumer performs direct on-chain settlement and updates status to
  `direct_submitted` or `direct_submit_failed`
- `/results` treats `submit_queued`, `submit_request_created`, and
  `direct_submitted` as accepted response records

### Production Mode

Production mode extends event mode:

- materialized per-session aggregate records
- queue-backed Telegram outbound sending
- per-session or per-session-shard Durable Object aggregation
- D1 response/export indexes for admin operations
- explicit per-session rate limits and spend controls

## Data Model

`telegram:submit-request:<requestId>` remains the canonical accepted-response
record in the bridge KV namespace.

Accepted statuses:

- `submit_queued`: accepted, queued for background settlement
- `submit_request_created`: accepted, canonical handoff pending
- `direct_submitted`: accepted and settled on-chain

Failure statuses:

- `direct_submit_failed`: accepted attempt failed during settlement; the record
  remains available for export and diagnostics

Queued records include:

- stable `requestId`
- `idempotencyKey`
- `telegramUserId`
- `sessionSlug`
- `questionId`
- display `answer`
- normalized `onChainAnswer`
- safe `sessionSnapshot`
- `canonicalApiRequest.status = queued_direct_onchain`

## Submit Flow

Event mode submit flow:

1. Validate Telegram/Mini App auth.
2. Validate session and question references.
3. Build an idempotent request id from user, session, question, and answer.
4. If a record already exists, return it.
5. Write `submit_queued` to KV.
6. Send the record to `AGENT_RESPONSE_QUEUE`.
7. Return acknowledgement.
8. Queue consumer performs session-worker auth, response payload upload,
   optional faucet, and chain broadcast.
9. Queue consumer updates the same KV record with settlement result.

## Results Flow

Current implementation reads accepted KV submit records and renders result
cards. This is acceptable for 500-user events if the record limit is bounded and
the result image is compact.

Next production step:

- queue consumer or session aggregate Durable Object updates
  `telegram:results:<sessionSlug>:snapshot`
- `/results` reads the snapshot first
- full KV scan remains an admin/debug fallback only

## Deployment Requirements

For event mode:

```toml
[[queues.producers]]
binding = "AGENT_RESPONSE_QUEUE"
queue = "ce-agent-bridge-response-submit"

[[queues.consumers]]
queue = "ce-agent-bridge-response-submit"
max_batch_size = 25
max_batch_timeout = 5

[vars]
AGENT_BRIDGE_ASYNC_SUBMIT_ENABLED = "true"
```

The queue should use a dead-letter policy before production usage.

## Acceptance Criteria

- Smoke mode keeps existing direct submit behavior and tests.
- Event mode stores a `submit_queued` record before returning.
- Event mode sends one queue message per newly accepted submit.
- Queue consumer updates the submit record after processing.
- `/results consensus` and `/results group` include queued accepted records.
- Result PNGs stay below 1 MB for Telegram delivery.
- Regression tests cover queue persistence, queue consumer updates, and result
  image size.

## Open Follow-Ups

- Add a per-session aggregate Durable Object for result snapshots.
- Add queue-backed Telegram outbound send retries.
- Add D1 response/export indexes for large admin exports.
- Add load-test script that simulates 500 participants over 60 seconds.
- Decide whether direct chain settlement should be disabled by default in event
  mode or just moved to the queue.
