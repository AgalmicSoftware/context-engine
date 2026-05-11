# Arweave Upload Readiness And Gateway Propagation

## Integration Status - 2026-05-11

The storage-routing work is present in
`autocoder/integration-agent-storage-modernization`, but this PRD remains open
after the merge. The known gap is still operational reliability around fresh
Arweave upload readability: upload acceptance and gateway propagation need to be
modeled as separate states.

Do not treat this as a Telegram bot blocker unless a Telegram continuation needs
to read freshly uploaded Arweave-backed payloads. The first implementation slice
should be a focused upload/readiness state and retry/reporting change with
targeted tests, not a broad storage rewrite.

## Problem

Our live Chipotle document flow can upload a fresh encrypted Arweave payload successfully, but the follow-up read often fails for several minutes because the transaction is not yet readable through the gateway as the expected JSON envelope.

Observed behavior in the Lit migration worktree on April 30, 2026:

- upload returned a valid tx id immediately
- immediate decrypt retries saw `404 - Page not found` from the gateway
- reruns against older tx ids succeed once propagation has caught up

This means the Lit path is healthy, but the end-to-end document smoke test currently couples success to Arweave gateway readiness timing.

## Why it matters

- It makes live document tests flaky and slow.
- It obscures the difference between Lit failures and Arweave propagation delays.
- It hurts `/new` and document-library UX when a just-uploaded encrypted document cannot be reopened promptly.

## Goal

Make fresh Arweave uploads observable and readable in a predictable way without relying on manual “wait five minutes and retry” workflow knowledge.

## Proposed direction

1. Separate `upload accepted` from `gateway readable` in the upload/decrypt flow and in test reporting.
2. Add first-class polling/backoff tuned for Arweave propagation instead of generic short retries.
3. Persist the tx id plus upload timestamp so later retries can resume without re-uploading.
4. Consider probing more than one gateway before declaring the JSON envelope unreadable.
5. Surface a user-facing “uploaded, waiting for propagation” state instead of treating it like an immediate hard failure.

## Acceptance criteria

- Fresh encrypted document uploads no longer fail the live smoke test solely because the first gateway read returns 404.
- The report distinguishes upload success, propagation wait, and decrypt success.
- The document flow can resume from a previously uploaded tx id without repeating the upload.
- Retry windows and gateways are configurable from the existing E2E env surface.

## Notes

- This is not a Chipotle authorization problem.
- The existing reuse path already proves decrypt/deny behavior once the tx has propagated.
