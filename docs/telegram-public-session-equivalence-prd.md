# Telegram Public Session Equivalence PRD

Related PRD: [Telegram Response Export Scope](./telegram-response-export-scope-prd.md)
Related PRD: [Telegram Cloudflare 500-User Scale](./telegram-cloudflare-500-user-scale-prd.md)
Related PRD: [Telegram Results Exposure Levels](./telegram-results-exposure-levels-prd.md)

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

- Treat Telegram support as two separate dimensions:
  session surface mode (where a session can be used) and storage/execution mode
  (where questions/responses are stored and how writes are finalized). Do not
  collapse these into one boolean.
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
  `/telegram-demo-setup` route/component and the Session Wizard
  `Telegram-only session` checkbox should remain absent from public release
  until the Telegram setup flow is standardized, documented, and ready for
  supported operators.
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
- Temporary Telegram authoring exception: question authoring and agent handoff
  permissions default to Telegram-native group/session binding. A user or agent
  may add/pose questions and save preference drafts when the Telegram account is
  acting from a joined group, from a private binding created by a joined group,
  or, for `telegram_only` sessions, from a private Telegram participant binding
  created by joining that session. This is intentionally narrower than full
  CE/SBT resource parity and must be replaced or standardized before public
  operator rollout.
- Telegram results group descriptions must consider both structured answer
  patterns and qualitative evidence, including additional comments and freeform
  responses, when available. Qualitative text should inform neutral summaries
  but must not introduce identifying details.
- Telegram-only result visibility is governed by the exposure-level contract in
  the Telegram Results Exposure Levels PRD. For the Edge City demo, Telegram
  participants may see level 3 aggregate results by default. Level 4 anonymized
  group views require explicit admin enablement. The normal CE client must not
  consume this Telegram-only result surface until a public/anonymized client
  route is designed and reviewed.
- Telegram-only sessions may later expose an admin-enabled public-facing
  Telegram session viewer. This must be an explicit per-session setting, such
  as `publicTelegramViewerEnabled`, controlled by an authorized session admin.
  When disabled, public viewer endpoints should return a non-public state even
  if the session is answerable inside Telegram.
- Public-facing Telegram viewer data must use the redacted snapshot/exposure
  contract from the Telegram Results Exposure Levels PRD. The worker should
  allow browser CORS only for approved CE-owned origins, such as the production
  CE domain and approved staging domains. CORS must not be the only protection:
  the endpoint must also enforce the session's public-viewer setting, exposure
  level, sufficiency thresholds, and redaction policy so non-browser or
  unauthorized callers cannot fetch private Telegram-only records.
- Mini App result filters for Telegram-only sessions may segment real level 3
  aggregate results by Cloudflare-managed lightweight group selections and
  optional country details. These filters intentionally do not apply to local
  demo data, and they must not expose raw membership metadata or participant
  identities.
- Telegram-only sessions may use lightweight Cloudflare-managed groups for the
  demo path. These are intentionally not on-chain SBTs. Categories such as age
  bucket, country relationship, AI tribe, and contribution role can be shown in
  the Mini App and private bot. Users must explicitly save Mini App
  memberships, while private bot group option taps save immediately. Country
  relationship selections may include user-entered country details. Agents may
  propose new group categories or prompt a user to join a group, but the worker
  records those prompts as `requiresUserApproval` rather than auto-joining
  anyone.
- Agents may create worker-local child-session records for Telegram-only
  workflows. These records are `worker_local_until_session_registry_parity` and
  should not be treated as normal CE registry sessions until the parity model is
  standardized.
- Telegram-only Mini App admin controls are visible only when the Telegram
  managed wallet is already authorized for response export/session result
  administration. Non-admin participants should not see the admin menu entry.
- Telegram-only Mini App documents are a temporary Cloudflare-managed surface
  for session context. The Mini App may list existing non-secret session
  document summaries and accept lightweight uploads for Telegram-only sessions,
  but normal CE client document parity and durable file storage remain separate
  follow-up work.

## Mode Taxonomy

The current overlap is real. These are the working modes and the intended
separation:

| Surface mode | Storage/execution mode | Current priority | Expected behavior |
| --- | --- | --- | --- |
| `telegram_only` | Cloudflare-native questions and responses | Urgent Edge City demo path | Bot and Mini App list/answer sessions without chain question discovery; normal CE client shows `Telegram-only session` notice. |
| `telegram_only` + lightweight groups | Cloudflare-native questions, responses, and group memberships | Urgent Edge City demo path | Mini App and private bot manage optional group categories/memberships without on-chain SBTs; agents may propose groups for user approval. |
| `telegram_only` | Normal contracts plus Arweave payloads | Compatibility / fallback | Telegram can read public chain-backed questions, but this is not the preferred demo path because indexing and payload availability add latency. |
| `telegram_only` | Contracts plus Cloudflare payload refs | Transitional hybrid | On-chain records may point at Cloudflare payloads, but Telegram still treats the session as channel-specific until client parity is complete. |
| Normal CE session accessible by Telegram | Normal CE contracts/storage | Planned parity path | Client and Telegram both render public prompts. SBT/resource-gated access still needs standardized Telegram enforcement before this is broadly supported. |
| Normal CE session not accessible by Telegram | Normal CE contracts/storage | Existing default | Client routes behave normally; Telegram session lists omit the session. |

For the Edge City demo, optimize the first row: `telegram_only` with
Cloudflare-native question loading, response drafts/submissions, export, and
results. The PRD goal is to keep this explicit rather than letting the temporary
Telegram-only path blur into normal public CE sessions.

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
| Telegram-only result exposure levels | No client-side implementation yet | Level 3 aggregate results by default; level 4 group views only when admin-enabled | Same participant exposure contract as bot/Mini App results API |
| Admin-enabled public Telegram viewer | Optional redacted viewer only when admin enables it and CE origin is allowed | No change to private bot participation | No change to participant Mini App access |
| Telegram admin actions | Hidden until fuller client parity | Configured export admins see a private `Admin Actions` menu for exports and result exposure toggles | Result toggles are reflected through the same session exposure policy |
| Telegram-only documents | Hidden until fuller client parity | Not yet exposed in bot commands | Mini App can list session document summaries and accept lightweight Telegram-only uploads |
| Temporary Telegram question authoring and preference drafts | Hidden until permission parity is standardized | Telegram-native joined group/bound user can add/pose questions and authorize agent drafts | Mini App can add Telegram-only questions; draft submission still requires user action |
| Temporary Telegram lightweight groups | Hidden until parity is standardized | Private bot can manage Cloudflare-only group memberships for Telegram-only sessions | User-approved Mini App groups, including optional country details, not on-chain SBT claims |
| Telegram-only aggregate result filters | Hidden until parity is standardized | Not yet exposed in bot commands | Mini App can filter real aggregate results by saved lightweight group selections above threshold |
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
- Public-facing Telegram-only viewer endpoints must require an admin-enabled
  public viewer flag before returning any viewer payload, and must return only
  redacted snapshot data compatible with the exposure-level PRD.
- Public-facing Telegram-only viewer endpoints must use an explicit CORS
  allowlist for CE-owned origins. Requests from unapproved origins should not
  receive permissive CORS headers, and direct API calls must still be rejected
  unless the session's public viewer policy allows the requested exposure.
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
- Should question authoring and agent preference drafting be governed by SBT
  membership, Telegram group admin/member status, an explicit session author
  allowlist, or a unified `resourcePermissions` policy that the client and
  Telegram surfaces both enforce?
