# Telegram Response Export Scope PRD

## Problem

Telegram response export currently has two different discovery paths:

- Cloudflare-backed sessions can use the session worker `/storage/list` and
  `/storage/read` routes to export response payloads.
- Arweave-backed sessions can only export Telegram bridge submit records unless
  the bot already knows exact Arweave transaction ids.

That makes `export_all` ambiguous. Operators need a standard distinction
between a Telegram-only pilot session and a normal session whose export should
include every discoverable response submitted through Context Engine.

## Goals

- Preserve the current Telegram-only export behavior for sessions that are
  configured as Telegram-only or do not opt into broader response discovery.
- Add a standard all-session export mode that can include non-Telegram client
  submissions when the payloads are discoverable for the selected storage mode.
- Make `/session/new` expose the choice when Telegram support is enabled.
- Keep encrypted Arweave/Lit payload export bounded to encrypted envelopes unless
  a later PRD adds explicit decrypt authority for the exporter.
- Avoid smart contract ABI changes.

## Non-Goals

- Implementing this PRD in the current checkpoint.
- Decrypting Lit-encrypted responses inside the Telegram bot.
- Migrating existing sessions between Cloudflare and Arweave storage.
- Making private or gated responses public.
- Changing who can run `/export_all`; export remains allowlist/admin-gated.

## Canonical Terms

- `telegram_only`: export records created through the Telegram bot or Mini App
  path. This is the compatibility mode.
- `all_session`: export all responses discoverable for the session, including
  client submissions outside Telegram.
- `auto`: compatibility behavior for legacy sessions with no explicit scope.
  Cloudflare sessions may use `/storage/list`; non-Cloudflare sessions fall back
  to Telegram submit records unless explicitly configured otherwise.

## Config Contract

Session metadata and bridge policy should converge on this canonical shape:

```json
{
  "telegram": {
    "bridgeEnabled": true,
    "responseExportScope": "telegram_only"
  }
}
```

Supported `responseExportScope` values:

- `telegram_only`
- `all_session`
- `auto` for legacy compatibility only

Compatibility aliases may be accepted on read:

- `telegramOnlySession: true` maps to `telegram.responseExportScope =
  "telegram_only"`.
- `telegramResponseExportScope` maps to `telegram.responseExportScope`.
- `responseExportScope` maps to `telegram.responseExportScope` when scoped in a
  Telegram-enabled session policy.

New `/session/new` sessions should write the canonical `telegram` object. Agent
bridge `AGENT_BRIDGE_SESSION_POLICY_JSON` entries may mirror the same field so
bot deployments do not have to fetch full metadata before resolving export
behavior.

## `/session/new` UX

When Telegram support is enabled for a session, the wizard should show a
Telegram settings section with:

- `Enable Telegram support`
- `Telegram-only session`

`Telegram-only session` should default to checked to preserve existing pilot
behavior. Unchecking it sets `telegram.responseExportScope = "all_session"`.

Copy guidance:

- Telegram-only: exports use Telegram bot/Mini App submit records.
- All session responses: exports include client and Telegram responses that can
  be discovered from the selected session storage and on-chain response events.

## Export Behavior Matrix

| Storage profile | `telegram_only` | `all_session` |
| --- | --- | --- |
| Cloudflare | Export Telegram submit records and known storage refs. Optionally read those exact refs through `/storage/read`. | Use session worker `/storage/list?resource=responses`, then `/storage/read` for each listed response. |
| Arweave | Export Telegram submit records. If a submit record has a known Arweave tx id, include the raw payload when fetch succeeds. | Scan `ResponsesSubmitted`, filter to session question ids, call `getResponse(responder, questionId)`, derive Arweave tx ids from stored `bytes32` pointers, and fetch payloads from gateways. |
| Lit-Arweave | Export Telegram submit records and any known encrypted envelopes. | Same as Arweave, but exported files are encrypted envelopes/ciphertext unless a later decrypt-authority flow exists. |
| Cloudflare `worker_sbt_gate` | Same as Cloudflare, but read/list requires authenticated session-worker access. | Same as Cloudflare, with worker gate enforcement before bytes are exposed. |
| Cloudflare `lit_encrypted` | Export submit records and encrypted refs only unless exact encrypted payload reads are allowed. | Export encrypted envelopes only; do not decrypt in Telegram without a later decrypt PRD. |

## All-Session Arweave Discovery

Because `ResponsesSubmitted` does not include the response hash directly, the
exporter must:

1. Resolve the session question index.
2. Resolve a bounded block window from session `blockLimits`, registry creation
   block, or explicit bridge config.
3. Scan `ResponsesSubmitted(address indexed responder, bytes32[] questionIds,
   bytes32 indexed surveyId)` logs on the Surveys contract.
4. Keep only events whose `questionIds` intersect the session question ids.
5. For each unique `responder + questionId`, call
   `getResponse(responder, questionId)`.
6. Ignore zero hashes.
7. Convert the `bytes32` response pointer to a 43-character Arweave tx id.
8. Fetch the payload from configured Arweave gateways.
9. Dedupe by `responder + questionId`, keeping the latest on-chain value.

Survey-level responses can be added later using the same `getResponse` pattern
for non-zero `surveyId`, but the first all-session export should prioritize
standalone question responses because those are what the current Telegram
question flow poses.

## Archive Manifest

Exports should include a manifest with:

- `responseExportScope`
- `storageBackend`
- `sessionSlug`
- `exportedPayloadCount`
- `submitRecordCount`
- `onChainDiscoveryCount`
- `partial`
- `encryptedPayloadCount`
- `storageListError`
- `readErrors`
- `gatewayErrors`
- `scanWindow`
- `questionCount`

For `all_session`, the zip should distinguish:

- `responses.json`: normalized payload entries.
- `telegram-submit-records.json`: Telegram bridge audit records.
- `on-chain-response-index.json`: responder/question/hash/tx id records.
- `storage-items.json`: Cloudflare list rows when Cloudflare is used.

## Privacy And Access Rules

- `/export_all` remains private-chat only.
- Export access remains controlled by configured admin/export addresses and the
  managed Telegram account mapping.
- All-session mode may include non-Telegram participants, so the UI must make
  the export scope explicit before download.
- Lit-encrypted payloads stay encrypted in the archive unless a future flow
  proves decrypt authority and records that proof in the manifest.
- Arweave public payloads are already public by storage design, but export still
  requires admin access because the archive aggregates participant data.

## Compatibility

- Existing sessions with no explicit scope use `auto`.
- `auto` preserves current behavior:
  - Cloudflare sessions use the worker storage list path.
  - Non-Cloudflare sessions fall back to Telegram submit records.
- New Telegram-enabled sessions created from `/session/new` should default to
  `telegram_only` until the operator opts into `all_session`.

## Test Plan

- Unit test scope normalization for canonical and compatibility fields.
- Worker test: `telegram_only` Arweave exports Telegram submit records without
  scanning RPC logs.
- Worker test: `all_session` Arweave scans response events, calls
  `getResponse`, fetches tx payloads, and includes non-Telegram responders.
- Worker test: `all_session` Lit-Arweave exports encrypted envelopes without
  attempting decrypt.
- Worker test: legacy `auto` keeps current Cloudflare and non-Cloudflare
  behavior.
- `/session/new` render test: enabling Telegram support shows the
  Telegram-only session setting and writes canonical metadata.

## Rollout

1. Add config normalization and PRD-linked docs.
2. Add `/session/new` metadata UI and tests.
3. Add Telegram worker scope handling.
4. Add all-session Arweave scan/fetch behind explicit `all_session`.
5. Deploy to a new smoke session before changing existing demo sessions.

## Open Questions

- Should `all_session` include survey-level responses in v1, or defer until the
  client result/export surfaces standardize survey response visibility?
- Should Telegram-only Cloudflare exports read known submit-record storage refs,
  or continue exporting only submit-record snapshots for maximum compatibility?
- Should the bot show the active export scope in `/export_access`, `/me`, or only
  in the `/export_all` response?
