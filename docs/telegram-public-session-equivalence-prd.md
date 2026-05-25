# Telegram Public Session Equivalence PRD

Related PRD: [Telegram Response Export Scope](./telegram-response-export-scope-prd.md)
Related PRD: [Telegram Cloudflare 500-User Scale](./telegram-cloudflare-500-user-scale-prd.md)

## Problem

Publicly viewable sessions should behave consistently across the CE client,
Telegram bot, and Telegram Mini App. Today the same session can render normal
prompts in Telegram while the client shows `[encrypted]`, because storage
backend, payload access mode, and Telegram enablement are interpreted in
surface-specific paths.

## Goals

- Public sessions render the same public question prompts, public response
  summaries, counts, and availability states in the CE client, bot, and Mini
  App.
- Telegram enablement controls Telegram availability only. It must not change
  whether public content is visible in the CE client.
- `telegram_only` sessions are an explicit temporary exception: they are
  authored from `/session/new`, listed by the Telegram bridge, and intentionally
  blocked from the normal CE client session UI until the Cloudflare-native
  Telegram path has full client parity.
- Storage backend is not user-visible when the payload access mode is public.
  Arweave and Cloudflare `public_read` sessions should present equivalent
  content.
- Non-public sessions use explicit labels: `Requires session access`,
  `Encrypted`, or `Unavailable`, rather than overloading `[encrypted]`.
- Response submission paths store payloads in the configured storage backend and
  put only non-identifying storage refs on-chain.

## Non-Goals

- Migrating existing sessions between storage backends.
- Changing smart contract ABIs.
- Making gated or encrypted payloads public.
- Replacing the Telegram bot with the Mini App.

## User Stories

- As a public session participant, I can open a session in the CE client or
  Telegram and see the same question text and answer options.
- As a Telegram participant, I can open the Mini App before joining through the
  bot and choose from Telegram-enabled public sessions.
- As an operator, I can create a Telegram-enabled public demo session without
  deciding separately how the client should read prompts.
- As an operator, I can choose private/gated settings and trust that the client
  will not display private prompts as public content.

## Product Rules

- `storageProfile.backend = "arweave"` remains the default backend for normal
  public sessions.
- `storageProfile.backend = "cloudflare"` requires an explicit
  `payloadAccessControl.mode`.
- `public_read` means prompts and configured public summaries are readable by
  client, bot, and Mini App without wallet auth. Writes still require the
  session worker.
- `worker_sbt_gate` means payloads are not end-to-end encrypted, but reads must
  go through session-worker access control. The UI should say `Requires session
  access` when the current viewer has not proven access.
- `lit_encrypted` means the payload envelope is encrypted and should display as
  `Encrypted` until the viewer can decrypt.
- Telegram session lists show only sessions where `telegramBridgeEnabled` is
  true and `telegramOnly` is true while the temporary Cloudflare-native
  Telegram mode is active. The CE client may show any standard session the
  client route normally supports.
- `telegramOnly = true` writes `sessionMode = "telegram_only"` metadata and
  causes the normal `/session/<slug>` client route to show a
  `Telegram-only session` notice instead of rendering questions/results.
- The public CE client must not expose Telegram bot setup UX yet. The former
  `/telegram-demo-setup` route and component should remain absent from public
  release until the Telegram setup flow is standardized, documented, and ready
  for supported operators.
- Telegram-only question loading must prefer preloaded Cloudflare/session-policy
  question lists over chain event scans. Chain-backed public session parity is
  still covered by the normal equivalence matrix below.
- Test-only spam filtering such as hiding `e2e` sessions is temporary and must
  be replaced by a durable session visibility flag.
- Temporary Telegram results exception: joined Telegram-enabled sessions can
  show demo/live `/results` in Telegram without requiring SBT joins. These
  Telegram result cards should not be surfaced in the CE client yet. Reverse
  this exception when the fuller client results implementation can enforce the
  same access and sufficiency rules.

## Surface Equivalence Matrix

| Session config | CE client | Telegram bot | Mini App |
| --- | --- | --- | --- |
| Arweave public | Shows prompts and public responses | Shows prompts and answer buttons | Shows prompts, drafts, submissions |
| Cloudflare `public_read` | Shows prompts and public responses through session worker read/list | Shows prompts and answer buttons | Shows prompts, drafts, submissions |
| Cloudflare `worker_sbt_gate` eligible viewer | Shows prompts after session-worker auth | Shows prompts after managed account/session access | Shows prompts after managed account/session access |
| Cloudflare `worker_sbt_gate` ineligible viewer | Shows `Requires session access` | Shows locked/access message | Shows locked/access message |
| Cloudflare `lit_encrypted` ineligible viewer | Shows `Encrypted` | Shows encrypted/required SBT message | Shows encrypted/required SBT message |
| Payload missing/indexing | Shows `Unavailable` with retry/refresh affordance | Shows unavailable/retry state | Shows unavailable/retry state |
| Temporary Telegram results | Hidden until fuller client parity | Joined Telegram-enabled sessions can view result cards | Joined Telegram-enabled sessions can view result cards when exposed |
| `telegram_only` Cloudflare-native session | Shows `Telegram-only session` notice | Listed and answered in Telegram without chain question discovery | Listed and answered in Mini App without chain question discovery |

## Requirements

- Session metadata must expose enough non-secret storage profile information for
  every surface to classify `public_read`, `worker_sbt_gate`, and
  `lit_encrypted`.
- The CE client session route must resolve Cloudflare `public_read` question
  refs through the session worker instead of treating them as masked prompts.
- The client must distinguish `worker_sbt_gate` from `lit_encrypted` in labels,
  empty states, and telemetry.
- The Telegram worker question index must preserve payload access mode and
  payload-unavailable state separately from encryption state.
- Mini App state must accept no-session launches and show a session picker with
  Telegram-only sessions.
- Counts must use the same definitions across surfaces: total discovered,
  answerable, locked, unavailable.
- Regression tests must cover at least one public Arweave session, one
  Cloudflare `public_read` session, one `worker_sbt_gate` locked session, and
  one `lit_encrypted` locked session.

## Open Questions

- Should `/new` default Cloudflare public Telegram demos to `public_read`, or
  require the operator to choose between public and gated prompts every time?
- Should public response summaries be controlled by the same
  `payloadAccessControl.mode`, or by a separate response visibility setting?
- When client parity is complete, should `telegramOnly` be migrated into a more
  general `channelVisibility`/`supportedSurfaces` field and allow the normal
  client route to render Cloudflare-native sessions?
- Should a Telegram-managed account be allowed to unlock `worker_sbt_gate`
  client views through a client-side Telegram sign-in handoff, or should those
  views remain Telegram-only until full CE account linking exists?
