# Context Engine Specification

Status: Living specification (update alongside feature work)
Last reviewed: 2026-08-23
Canonical deep-dive docs: `docs/` (see `docs/README.md`)

## Purpose

This document is the current, high-level specification of the Context Engine app.
It describes what the app does today, how the major pieces fit together, and where the authoritative technical details live.

This spec is intentionally:
- Product-facing enough to describe what users can do.
- Technical enough to describe the system boundaries (contracts, worker, storage, gating, encryption).
- Structured so new features have an obvious place to be documented.

## Update Policy (Keep This Spec Current)

When adding or changing features, update all of the following in the same PR:
- `spec.md`: feature inventory, routes, user flows, external integrations, and any new "surface area" (endpoints, contracts, config keys).
- `docs/README.md`: add a link to any new or substantially updated doc in `docs/`.
- `README.md` and `CHANGELOG.md` when the change is user-visible or alters workflows.

Update triggers (if any of these change, `spec.md` should change too):
- A new route/page is added or an existing one changes meaning.
- A new Worker endpoint, auth rule, or scope is added.
- A new contract is added, or an on-chain field/gate/permission model changes.
- A new config key is introduced (client flags, worker config, metadata schema).
- A new export format, encryption target, or gating rule is added.

## System Summary (What This App Is)

Context Engine is a deployment-profile-aware suite of tools for large-group
deliberation and coordination, centered on:
- Surveys and questions with profile-selected storage/anchoring plus optional
  privacy via encryption.
- Worker-native groups or EVM SBT (Soulbound Token) groups for membership,
  roles, and gated access.
- A per-session Cloudflare Worker for canonical Hosted & Fast sessions and for
  profile-enabled AI, transcription, storage, fetch, and chain/Arweave helpers.
- An optional Agent Bridge Worker that exposes scoped `/api/agent/*` requests
  and Telegram/Mini App adapters without replacing session authority.

Primary storage and authority split:
- Hosted & Fast: the creator-owned Session Worker is canonical for config,
  authentication, Worker-native groups/gates, and Cloudflare payload/index
  storage; it does not require EVM or Arweave.
- Trustless & Slower: public EVM contracts anchor identity and gate state, while
  Arweave stores durable metadata and payloads.
- Agent Bridge: a separately deployed adapter that delegates canonical session
  membership, gates, and storage to the configured Session Worker when needed.
- Browser IndexedDB/local storage: caches, encrypted wallet records, and user
  settings for performance and usability, never shared authority.

## Glossary (Core Concepts)

- Session: A named "space" (identified by `slug` and/or `sessionId`) that ties together contracts, metadata, worker config, and access gates.
- Group: Either an on-chain SBT contract representing membership/entitlement,
  or a Worker-native group record for a Worker-canonical session.
- Gate: A profile-owned access rule. Chain-backed sessions use `SessionRegistry`
  Any/All SBT rules; Worker-canonical sessions use the Session Worker's signed
  config and native group authority.
- Passkey EOA wallet: A passkey-unlocked embedded EOA wallet using WebAuthn PRF
  to derive the EOA key by default, with optional AES-GCM encrypted private-key
  compatibility mode and soft worker-held sessions.
- Doc Library: A per-session and per-group document store whose provider follows
  the session profile: Cloudflare storage with profile-selected Worker access
  and encryption (Worker-envelope in the Hosted & Fast preset), or Arweave with
  optional Lit encryption for Arweave-backed sessions.
- Sponsored resource: A service that uses secrets (AI keys, Arweave wallet, faucet key) and therefore routes through the Worker.
- Sponsored grant: A pre-authorized access token for worker resources (deploy, faucet) redeemable without full auth.
- Worker token: A short-lived session token minted after login; it encodes
  scopes granted by the selected session authority.
- Metadata URI: An Arweave JSON payload containing session content/config (non-authoritative for gates).
- Lit encryption: Client-side encryption where decryption access is controlled by programmable conditions (in this app, typically SBT ownership) via Lit Protocol.
- Lit payment delegation: A bootstrap mechanism allowing session admins to delegate Lit Protocol capacity credits without a logged-in session.

## User Roles

- Participant: Responds to questions/surveys, views results (subject to gates), exports data.
- Session admin: Creates and configures a session, deploys/configures a worker, sets session gates, and can bootstrap worker config.
- SBT admin: Creates and manages SBT groups (minting rules, distribution, burn auth).
- Operator (advanced): Runs local chain, contract tests, and E2E scripts; deploys workers outside the wizard.

## Primary Routes (Pages)

The client uses React Router to route all paths to `MainSite`, which then renders page modules based on `window.location.pathname`.

Core routes:
- `/`: Home (tabs: Latest, Community, Tools, Welcome).
- `/session/new` (alias: `/new`; sponsored links can land here as `/new?sponsored=<txId>#k=<secret>`): Session Wizard. Hosted & Fast publishes canonical Worker config without EVM/Arweave; Trustless & Slower uploads metadata and registers on-chain.
- `/session/:token`: Session landing page (accepts a slug or a UUID-like session id token; resolves and renders a one-page session view).
- `/session/:token/questions`, `/session/:token/questions/results`: Session-scoped question list/results rendered inside the session shell.
- `/session/:token/docs`: Session Doc Library. Worker-canonical sessions use the
  resolved session identity and opaque Cloudflare storage refs; Arweave-backed
  sessions use `sessionIdHex` indexing and optional Lit encryption. Session-id
  route tokens remain stable on this subroute.
- `/surveys`, `/survey/:id`, `/survey/:id/results`: Survey list/view/results.
- `/questions`, `/questions/results`: Question list/results.
- `/question/:id`: Single question view. Canonical session hint uses `?session=<slug>` (legacy `?group=<slug>` accepted).
- `/sbts` and `/groups`: group list and creation UI. Registry-backed SBT
  sessions accept scoped aliases such as `/sbts/:slug` and `/groups/:slug`.
  Worker-canonical sessions use `/groups?sessionName=<slug>`; a selected native
  Group uses `#group-<groupId>` for its full SBT-style detail view. Legacy
  Worker `/groups/:slug` links are accepted and silently canonicalized.
- `/sbt/:address` and `/group/:address` (legacy password suffixes still supported on detail flows where applicable): SBT detail and minting/claim UI.
- `/admin`: Session admin UI (registry and worker tests; sessionId query supported).
- `/sponsor`: Sponsor page for generating grant-backed sponsored-bundle links into the Session Wizard.
- `/bookmarks`: Bookmarked surveys/questions/SBTs/users.
- `/debate`: Experimental stub for an older debate/discussion surface; not part of the supported public surface in this build.
- `/atlas` and `/tag/...`: Debate map / AI Policy Atlas demo surface.
- `/matrix`: Risk matrix demo view.
- `/demos`: Demo sessions launcher (`/agent` also exists as a dev-only route).
- `/benchmarks`: Static benchmark index and interactive report viewer. Bundled
  manifests identify each artifact as either a development preview or a
  released result; the report itself runs in a sandboxed iframe.
- `/posts` and `/posts/:slug`: Public Markdown post index and rendered post pages.
- `/docs`: User-facing quickstart, session-options guide, FAQ, AI-prompt
  reference, and an explicit session selector for published smart-contract
  deployment details. Legacy `/contracts` links redirect here without dropping
  their path suffix, query, or hash.
- `/:0x...`: Address-based user profile page (activity, responses, comparisons).
- `/u/:address`: Alias for the address-based user profile page.
- `/su/:username`: Simulated historical-user profile view used by demo/atlas surfaces.
- `/compare/...`: Address comparison view.
- `/about`: About page.

## Feature Inventory (Current App Capabilities)

### 0) Home Tabs and Primary Navigation

The home route (`/`) is tab-based and functions as the app's main "portal":
- Latest: home landing surface for the current match/feed view.
- Community: universe/group discovery, aggregate stats, and leaderboard-style views sourced from caches and on-chain fetches.
- Tools: a plugin-style launcher for the core Context Engine modules (surveys/questions, SBT groups, AI data tool, debate map, risk matrix).
- Welcome: onboarding slides and entry points into the Tools tab.

Legacy note:
- `Votes` is no longer a current top-level home tab.
- `Community` is still a current home tab, and Polis-style reports are still current embedded results surfaces.
- The remaining older demo-oriented surface is Atlas / debate-map UI, while `/debate` itself is currently an experimental stub.

### 1) Sessions (Spaces)

What users can do:
- Open a session by slug or by session id link (`/session/<slug-or-id>`).
- Open one-person Interview with `/session/<slug-or-id>?mode=interview`, or Group Conversation with `?mode=recordGroup`. The microphone opens a two-choice modal; Interview creates reviewable response drafts from a realtime responder transcript, while Group Conversation creates draft questions from rolling transcription. Legacy `?mode=listening` remains supported for the pile-adjacent recorder.
- Paste the session's user-authored interview request into ordinary ChatGPT or Claude without installing MCP/plugins. The linked Worker endpoint is an inert JSON catalog with no instructions. The AI searches only already-authorized conversation history, memory, and connected sources directly related to accessible session questions, reports its platform/model, shows the exact response packet before encoding, attaches an explained confidence value to each direct or defensibly inferred response, and returns a fragment-prefill link for local review. If it finds no relevant signal, it returns the clean interview link instead. The Worker accepts only a session-approved return origin and matching session path.
- Open session-scoped question views via `/session/<slug-or-id>/questions` and `/session/<slug-or-id>/questions/results`.
- Open the session doc library via `/session/<slug-or-id>/docs`.
- Create a new session via the Session Wizard (`/session/new` or `/new`), including grant-backed sponsored-bundle entry links.
- Choose a curated **Session colors** scheme with an immediate preview. The
  session stores only `appearance.colorSchemeId` (`context-engine`, `ocean`, or
  `amber`); it cannot select an app theme or provide colors, token maps,
  stylesheets, or CSS.

What the system does:
- In Hosted & Fast, stores canonical signed session config, secrets,
  Worker-native group/gate state, and Cloudflare payload indexes in the
  per-session Worker; publication does not perform an EVM transaction or
  Arweave upload.
- In Trustless & Slower, stores session gates and operational pointers in
  `SessionRegistry` and content/config on Arweave, optionally with Lit-encrypted
  fields.
- Maintains compatibility readers for older demo and chain-backed session data
  while keeping authority explicit per selected profile.

Deep-dive docs:
- `docs/session-registry.md`
- `docs/session-cors-worker.md`

### 2) Groups (Membership and Gating)

What users can do:
- Create SBT contracts (via `SBTFactory`) with tokenURI metadata stored on Arweave.
- Create chain-free Worker-native groups in a Worker-canonical session. The
  session's `groupCreationPolicy` chooses configured admins only or all
  participants. Authenticated principals with the `groups` scope may join and,
  when the policy permits, create. Participant-created groups are forced to
  open self-join and session visibility, while retaining validated tags,
  public reference URLs, a per-group member limit, a self-join deadline, and
  the signed creator's group-admin address. Anonymous discovery is independent:
  only an explicitly public, unencrypted, ungated session mode exposes redacted
  session-visible group metadata before sign-in.
- Mint/claim SBTs using multiple distribution modes (open claim, password claim, invite-limited flows, and signature-based flows).
- View SBT group details and mint status, and interact with group gates (as used by the session and worker).
- View Worker-native Groups in the corresponding SBT-style detail hierarchy,
  translated to member capacity, a live join deadline, Join/Leave actions,
  public document references, and tags. Authenticated viewers may browse
  member identities and the authoritative count when `memberVisibility`
  permits their session or Group membership; Worker Groups do not invent
  contract, network, gas, transaction, or burn fields.

What the system does:
- Keeps Worker-native group IDs, records, membership, and capacity bound to the
  exact Worker origin, slug, and canonical session ID. Signed admins retain
  edit, delete, and membership management under either creation policy. The
  Durable Object enforces each group limit and join deadline in the same
  serialized path that reserves membership capacity.
- Applies an optional Worker-canonical `sessionEndsAt` timestamp to participant
  resource use and mutations. At closure, AI, transcription, fetch, uploads,
  Group creation, and Group joins stop while existing Group/storage/result
  reads and signed admin operations remain available.
- Applies the same group-creation choice to Context Engine's session-bound
  on-chain SBT creation controls. This is not factory-level authorization:
  public SBT factory methods remain independently callable on-chain.
- Uses SBT ownership for worker auth gating (scopes for AI/Arweave/transcribe/faucet/fetch/Lit delegation).
- Uses SBT ownership for Lit encryption access control (decrypting gated metadata and responses).

Deep-dive docs:
- `docs/arweave-payloads.md`
- `docs/session-registry.md`
- `docs/cache/sbts-cache-structure.md`

### 3) Surveys, Questions, and Responses

What users can do:
- Create surveys composed of multiple question types.
- Answer surveys and questions, including optional voice-to-text input.
- After a successful submit, see a stable `Submitted` state (instead of `Submit (N)`) until making a new edit.
- View results and filter responses by SBT membership and other criteria.
- Export results for external analysis (CSV, JSON, redacted session-results HTML viewer/static HTML/PDF report options, and Polis-style PDF/report generation). Session-results exports require a logged-in authorized viewer, embed downloader metadata, and can derive local/session-private AI analysis sections using synthetic participant ids instead of sending wallet addresses to AI.
- Generate/read Polis-style report views inside survey/question/session result surfaces (rather than on a standalone top-level route).

Question types (current core set):
- Binary (agree/disagree style).
- Rating scales.
- Multiple choice (single-select and multi-select).
- Freeform text.

Privacy and integrity:
- Response fields can be optionally encrypted (for self or for a gated audience), with hashes retained for verification.
- Surveys/questions/doc URLs can be stored in plaintext or as Lit-encrypted payloads depending on session settings and gates.

Deep-dive docs:
- `docs/arweave-payloads.md`
- `docs/cache/surveys-and-questions-cache-structure.md`

### 4) AI-Assisted Tools

What users can do:
- Generate candidate questions from pasted text, audio, or additional sources (URLs/files) using AI.
- Deduplicate/select questions and then upload them into the survey system.
- Generate and optionally upload a markdown summary of an audio discussion to Arweave (optionally encrypted).

What the system does:
- Routes AI calls through the Worker to avoid leaking provider keys and to apply per-wallet/day limits.
- Supports multiple providers (OpenAI, Anthropic, OpenRouter, and custom RPC-style proxying), with provider selection from model/provider metadata.

Deep-dive docs:
- `docs/resource-keys.md`
- `docs/session-cors-worker.md`

### 5) Encryption, Gates, and Gated Decrypt

What users can do:
- View encrypted placeholders and decrypt content when entitled by gates (SBT ownership).
- Encrypt content so only a gated audience can decrypt (via Lit).
- Lock/encrypt session metadata fields, survey-level fields, and individual question prompts/tags using one or more gates (multi-select lock popover; OR semantics).
- Avoid “nonsense answers”: gated questions are hidden from non-holders in session question lists, and direct question links disable answering/submission while the prompt remains masked.

What the system does:
- Uses `SessionRegistry` as the gate authority for chain-backed sessions and the
  Session Worker's signed config/native groups for Worker-canonical sessions.
- Worker login checks the selected profile's authority on `/auth/login` and
  issues only the permitted scopes (`ai`, `arweave`, `transcribe`, `faucet`,
  `fetch`, `lit`, `storage`, and `groups` as configured).
- Gated encryption/decrypt uses the worker-mediated Lit Chipotle runtime for supported sessions; legacy Lit payload readers remain for compatibility.
- Stores per-field metadata encryption decisions via `encryptedFieldGates` (values are `string | string[]`; 1 gate stays legacy `string`, 2+ gates become `string[]`).
- Stores per-question/per-survey encryption audiences in the payload (`encryption.gates`), and SurveyTool derives response encryption recipients per question from that lock state (with fallback to session response gate policy when a question is not locked).
- Keeps answer and additional-comment locks independent by default; comments inherit the answer audience only after an explicit **same as answer** selection or when a mandatory session/question gate applies.

Deep-dive docs:
- `docs/session-registry.md`
- `docs/lit-protocol-information.md`

### 6) Worker-Sponsored Resources (AI, Arweave, Transcription, Faucet, Fetch)

What users can do (through the app UI):
- Make AI calls (for question generation and other assistive features).
- Transcribe recorded audio to text.
- Upload JSON, Markdown, and media payloads to the selected Cloudflare or
  Arweave storage profile.
- Request small amounts of testnet ETH when below a threshold (testnet faucet).
- Fetch remote URLs/images through a controlled proxy for safety/CORS.
- Redeem sponsor-provided deploy/faucet grants during session setup flows.

What the system does:
- Enforces CORS and per-session allowlists.
- Stores session config and secrets in KV.
- Requires auth for secret-using endpoints by default, but `POST /ai`, `POST /transcribe`, and `POST /realtime/call` also support anonymous access when the session config allows it.
- For worker-canonical sessions, `workerAuthority.anonymousScopes` explicitly
  grants anonymous `ai` and/or `transcribe` access. Browser transcription never
  escalates an anonymous denial into a wallet or passkey signature prompt.
- Browser speech capture requests voice-processing constraints and, when the
  selected input is clearly an iPhone/iPad Continuity microphone, prefers an
  identifiable built-in computer microphone while preserving other explicit
  device choices.
- Supports admin-signed bootstrap paths for `POST /arweave/upload` when no bearer token is present.
- Supports worker-mediated Lit Chipotle setup and execution through signed admin `lit-chipotle-*` actions and authenticated `/lit/chipotle-action` runtime requests.
- Supports grant-backed sponsored setup flows via `/sponsor`, `POST /admin/issue-sponsored-grants`, `POST /sponsored/redeem-deploy`, and `POST /sponsored/redeem-faucet`.

Deep-dive docs:
- `docs/session-cors-worker.md`
- `docs/resource-keys.md`

### 6a) Agent Bridge (Optional Separate Worker)

What integrations can do:
- Use scoped credentials with the canonical `/api/agent/*` HTTP contract for
  implemented account, session, question, response, preference, and agent-only
  flows.
- Use optional Telegram bot and Mini App adapters, including the live
  `/telegram/webhook` route, without changing the underlying Context Engine
  authority model.
- Exchange an authorized Session Worker identity for a bridge credential on the
  implemented wrapped-member handoff.

What the system does:
- Deploys `workers/agentBridgeWorker/` separately from each Session Worker.
- Delegates canonical membership, gates, storage, and chain operations to the
  configured Session Worker or contract boundary when required. Bridge-local
  indexes and contract-only catalog entries are not presented as canonical
  session state.
- Keeps reusable worker modules under `workers/shared/`; that directory is not a
  deployable Worker.

Deep-dive docs:
- `workers/agentBridgeWorker/README.md`
- `docs/session-cors-worker.md`

### 7) Wallet and Login Options

What users can do:
- Connect with a standard injected wallet (RainbowKit/wagmi, e.g. MetaMask).
- Use the embedded passkey EOA wallet with soft worker-held session mode
  (optional) for smoother UX.

What the system does:
- Maintains an encrypted passkey EOA wallet record in IndexedDB. Plaintext
  private keys, PRF output, and derived encryption keys are not persisted.
- Uses the connected wallet identity for contract actions, worker login, and Lit auth.

Deep-dive docs:
- `docs/passkey-wallet.md`
- `docs/forking-wallet.md`
- `docs/security-model.md`

### 8) Bookmarks, Profiles, and Discovery

What users can do:
- Bookmark surveys, questions, SBTs, users, and saved filters.
- View user profiles (address-based) and compare addresses.
- Open simulated historical-user profiles used by Atlas/demo surfaces (`/su/:username`).
- Use "deep search" style scans (cached) to aggregate a user's historical activity.

Deep-dive docs:
- `docs/cache/bookmarks-cache-structure.md`
- `docs/cache/user-cache-structure.md`

### 9) Admin and Operations

What admins can do:
- Inspect and manage session registration state (slug/sessionId).
- Run Worker tests (health, AI, Arweave, transcription, faucet) and bootstrap worker config via signed admin actions when needed.
- Manage gates and sponsored resource settings as part of session setup and ongoing operations.
- Generate sponsored setup bundles/grants via `/sponsor` for one-click or grant-backed session bootstrapping.

Deep-dive docs:
- `docs/session-cors-worker.md`
- `docs/session-registry.md`

### 10) Doc Library (Sessions + SBT Groups)

What users can do:
- Upload and browse documents associated with a **Session** and/or an **SBT
  group**. Arweave-backed sessions index by `sessionIdHex`; Worker-canonical
  Cloudflare storage is scoped by session identity and opaque storage refs.
- Store plaintext or Worker-envelope documents in Cloudflare storage, or
  plaintext/Lit-encrypted documents on Arweave when that provider is selected.
- Add a URL as a small “link record” (optionally Lit-encrypted) without uploading remote content.
- View decrypted/plaintext docs inline (images/PDF/audio/video/text) or download as a file.

What the system does:
- Resolves the document provider from the session storage profile. Cloudflare
  documents use authorized `/storage/upload`, `/storage/list`, and
  `/storage/read` calls with opaque refs; Arweave documents use `CE-*` tags and
  Arweave GraphQL (`https://arweave.net/graphql` by default).
- For Arweave/Lit audience selection, uses the selected profile's chain-backed
  `docUploads` SessionRegistry gate when configured. If that gate is empty or
  unavailable, Arweave session docs default to plaintext rather than falling
  back to a “general” gate.
- For Worker-canonical Cloudflare storage, encryption and access conditions
  follow `storageProfile`; the Hosted & Fast preset uses Worker-envelope
  encryption with Worker role/scope conditions and does not infer plaintext
  from the absence of a SessionRegistry `docUploads` gate.
- For Lit-Arweave uploads, allows either the session `docUploads` gate or a
  custom SBT audience, with a "Copy from session gate" shortcut.
- Enforces provider-appropriate association integrity and anti-spam at upload
  time in the Worker:
  - For Arweave tags, `CE-SessionId` must match the authenticated session's
    on-chain `sessionIdHex`.
  - `CE-SbtChainId` + `CE-SbtAddress` association requires uploader is a holder or admin/owner (where available).

Deep-dive docs:
- `docs/doc-library.md`

### 11) Older Atlas / Debate Surfaces

This repo still includes an older Atlas / debate-map demo surface alongside the primary session, survey, and SBT workflows.
That remaining surface is mainly `/atlas`, `/tag/...`, and embedded debate-map UI inside demo session results.
The older `/debate` path itself is currently an experimental stub rather than a supported public feature.

Intent for these features:
- Either retire them cleanly (if no longer needed), or explicitly scope and bring them back under test.

## System Architecture (How It Works)

### Frontend (React)

- UI lives under `client/`; production React components are TSX, with a smaller
  set of JavaScript compatibility modules remaining outside the component
  surface.
- Vite is the canonical client dev/build toolchain. From `client/`, `npm run dev` starts the local Vite server, `npm run build` writes the production build to `client/build/`, and `npm run preview` serves a local Vite preview.
- Routing is centralized through `client/src/components/MainSite/AppShell.tsx`,
  `client/src/components/MainSite/routeTable.ts`, and the co-located lazy route
  modules.
- State management uses Redux (`client/src/store.ts`, reducers under `client/src/reducers/`).
- Group/session-aware caches are stored in localStorage under `dg:<cacheName>:<slug>` keys (see `docs/cache/*`).

### Smart Contracts (Solidity)

Key contracts (current Context Engine flows):
- `contracts/SessionRegistry.sol`: On-chain session registry and gate authority for resources (Any/All SBT requirements), including `SESSION_CREATION_FEE`, per-gate `perMemberLimit`, and arbitrary per-session `sessionFields` key/value storage.
- `contracts/Surveys.sol`: Survey/question registration and response anchoring.
- `contracts/SBTFactory.sol`: Creates SBT contracts (optionally deterministic).
- `contracts/CustomSBT.sol`: The SBT implementation (non-transferable ERC-721 style), with configurable `burnAuth`, metadata/history helpers (`getHistorySummary`, `getSBTMetadata`), and `isPasswordValid` for password-gated flows.

### Cloudflare Workers

Primary runtime worker:
- `workers/sessionCorsWorker/worker.js`: session-scoped canonical config/auth and
  Cloudflare storage for Worker-canonical profiles, plus profile-enabled AI,
  transcription, fetch, chain, Arweave, and faucet services.

Optional legacy/sponsored helper:
- `workers/deploy-helper/`: Trusted endpoint for the explicit legacy Session
  Wizard fallback, sponsored deployment, and Agent Wrapped provisioning; the
  default Hosted & Fast path uses the native Cloudflare dashboard handoff.

Optional agent sidecar:
- `workers/agentBridgeWorker/`: Scoped Agent HTTP API and optional Telegram bot
  and Mini App adapters. It delegates canonical session authority rather than
  duplicating it.
- `workers/shared/`: Reusable modules bundled into worker packages; not a
  deployable Worker.

Worker API (selected endpoints):
- `POST /auth/nonce`: Start SIWE-style login (returns nonce).
- `POST /auth/login`: Verify signature + gates and mint a session token with scopes.
- `GET /health`: Authenticated health check.
- `POST /ai`: AI proxy (provider-based); authenticated by default, with anonymous access supported when the session config allows it. Also supports `POST /` with `{ action: "ai", ... }`.
- `GET /agent/interview-catalog` (`/agent/interview-brief` compatibility alias): Public inert per-session question catalog for the client-authored, zero-install ChatGPT/Claude prefill handoff. It declares binary, rating, and multichoice answer formats and is disabled by `interviewModeEnabled=false`.
- `POST /realtime/call`: OpenAI Realtime WebRTC SDP exchange using the session Worker key and the session's anonymous AI eligibility policy.
- `POST /transcribe`: Transcription proxy; authenticated by default, with anonymous access supported when the session config allows it (`workerAuthority.anonymousScopes` for worker-canonical sessions).
- `POST /arweave/upload`: Authenticated Arweave upload (also supports an admin-signed bootstrap path when no auth header).
- `POST /storage/upload`: Profile-aware payload upload to Cloudflare or Arweave.
- `GET|POST /storage/read`: Authorized read by opaque storage reference.
- `GET|POST /storage/list`: Bounded, authorization-filtered metadata/index pages.
- `GET|POST /storage/export-envelopes`: Authorized export of encrypted payload
  ciphertext and envelope metadata; session KEK material is never returned.
- `POST /groups/create`: Authenticated participant Worker-group creation,
  enabled only by `groupCreationPolicy: "participants"` and forced to an open,
  session-visible record. Tags, public reference URLs, member limit, and join
  deadline are retained; the group-admin address is derived from the signed
  principal.
- `GET /groups/list`: Redacted session-visible Worker-group discovery is
  anonymous only for a validated Worker-canonical mode with public stored
  results and unencrypted, ungated Cloudflare storage. Memberships, member
  identities/counts, and join/create remain authenticated; creation permission
  is controlled separately by `groupCreationPolicy`.
- `GET|POST /groups/my-memberships`: Authenticated self-membership projection.
- `GET|POST /groups/members`: Authenticated, paginated member identities and
  authoritative count. `session` permits any authenticated session principal,
  `members` requires Group membership, and `admin_only` remains on the signed
  Admin route.
- `POST /groups/join`: Authenticated self-join for an open Worker group before
  its configured deadline and within its member limits.
- `POST /groups/leave`: Authenticated self-removal. The principal is derived
  from the bearer credential rather than request JSON.
- `POST /admin/groups/create`: Signed-admin Worker-group creation under either
  creation policy, including Worker-native metadata, membership limits, join
  deadlines, and a group-admin address.
- `POST /admin/groups/reconcile-empty`: Signed-admin recovery for an exact
  `legacy_locked` coordinator; succeeds only with a valid server-managed fresh
  bootstrap proof and no current or deleted Group rows.
- `POST /lit/chipotle-action`: Authenticated worker-mediated Lit Chipotle execution for check/encrypt/decrypt requests.
- `POST /sponsored/redeem-deploy`: Redeem a sponsored worker deploy grant.
- `POST /sponsored/redeem-faucet`: Redeem a sponsored faucet grant.
- `POST /admin/set-config`: Signed admin action to store session config in KV.
- `POST /admin/set-secrets`: Signed admin action to store session secrets in KV.
- `POST /admin/set-limits`: Signed admin action to update rate limits in KV.
- `POST /admin/lit-chipotle-status`: Signed admin action to check worker-mediated Chipotle readiness without returning stored API keys.
- `POST /admin/lit-chipotle-provision`: Signed admin action to register the default CE action in an existing Lit account.
- `POST /admin/lit-chipotle-bootstrap-session`: Signed admin action to create or derive the session Chipotle group, PKP, usage key, and CE action metadata.
- `POST /admin/issue-sponsored-grants`: Signed admin action to issue sponsored access grants.
- `GET /admin/abuse-summary`: Bearer-admin abuse/rate-limit summary for a bounded
  number of coordinator windows.
- `POST /`: Authenticated action-style requests using an `action` field: `request_test_eth` (testnet faucet), `fetch_url`, `fetch_image`.

Agent Bridge API families (selected):
- `/api/agent/*`: Canonical scoped agent contract; implemented and
  contract-only entries are identified in the Agent Bridge catalog.
- `/telegram/webhook` and `/telegram/mini-app*`: Optional Telegram adapter and
  Mini App surfaces.

### Storage and Data

- Cloudflare Worker storage: canonical signed config, secrets, payload envelopes,
  authorization metadata/index rows, and optional advanced R2 blobs for Hosted &
  Fast.
- Arweave: durable JSON payloads for chain-backed session metadata, survey and
  question payloads, SBT tokenURI metadata, and explicitly Arweave-backed
  resources.
- Browser localStorage: caches for surveys/questions/responses/SBTs/bookmarks/user scans.
- Browser IndexedDB: passkey EOA encrypted wallet records. Plaintext wallet
  keys must not be stored in localStorage or IndexedDB.

## Configuration Surfaces

Client-side:
- `client/src/variables/appConfig.ts`: user-visible feature flags and default endpoints (worker URLs, chain defaults, debug toggles).
- `client/src/variables/demo/demo_sessions.json`: legacy session config source and fallback during migration.
- `client/src/variables/local-contracts.json`: local chain contract address overrides (written by deploy scripts).

Worker-side:
- Worker KV session config and secrets, including the top-level
  `groupCreationPolicy` enum (`admin_only` or `participants`; omitted legacy
  Worker configs default to `admin_only`), optional `sessionEndsAt`, and generic
  `defaultGroupTags`. Pure Worker profiles reject block/faucet/registry
  configuration; explicit Worker + on-chain SBT profiles accept only the
  required network and Group Factory subset. See `docs/session-cors-worker.md`
  for shapes and bindings.

Resource keys:
- Keys can live in worker secrets, with optional per-user local overrides (see `docs/resource-keys.md`).

## Testing and Verification

Local chain and contracts:
- `npm run chain:start` and `npm run chain:deploy` (Foundry + Anvil).
- `npm run test:contracts` for the public Foundry contract suite.

Client tests:
- `npm run test:client`

Published workflow verification:
- `npm run test:e2e` runs the Vite navigation and route-style smoke.
- `npm run test:node` runs public Node regression suites.
- `npm run verify:release` runs client lint, typecheck, client tests, public
  surface validation, worker bundle verification, and the production build.

See also:
- `docs/local-chain.md`
- `README.md` for the AI wallet test workflow

## Appendix: Canonical Docs Index

See `docs/README.md` for the maintained index of documentation files.
