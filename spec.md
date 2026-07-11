# Context Engine Specification

Status: Living specification (update alongside feature work)
Last reviewed: 2026-04-01
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

Context Engine is a web3-native suite of tools for large-group deliberation and coordination, centered on:
- Surveys/questions with on-chain anchoring and optional privacy via encryption.
- SBT (Soulbound Token) groups to represent membership/roles and to gate access.
- A Cloudflare Worker used as a "sponsored resource proxy" for AI, transcription, Arweave uploads, and a testnet faucet.
- An on-chain SessionRegistry that is the authority for access gates (Any/All SBT rules) for sensitive resources.

Primary storage and authority split:
- On-chain contracts: identity, gating, and "root of truth" for access decisions.
- Arweave: durable content payloads (survey metadata, tokenURI JSON, optionally encrypted fields).
- Cloudflare Worker KV: per-session secrets + operational config (not gate authority).
- Browser local storage: caches and user settings for performance and usability.

## Glossary (Core Concepts)

- Session: A named "space" (identified by `slug` and/or `sessionId`) that ties together contracts, metadata, worker config, and access gates.
- Group: Typically an SBT contract (non-transferable ERC-721) representing membership/entitlement.
- Gate: An access rule stored on-chain in `SessionRegistry` that says which SBT(s) are required (and whether Any/All) to access a resource.
- Passkey EOA wallet: A passkey-unlocked embedded EOA wallet using WebAuthn PRF
  to derive the EOA key by default, with optional AES-GCM encrypted private-key
  compatibility mode and soft worker-held sessions.
- Doc Library: A per-session and per-SBT-group document store on Arweave, with optional Lit encryption.
- Sponsored resource: A service that uses secrets (AI keys, Arweave wallet, faucet key) and therefore routes through the Worker.
- Sponsored grant: A pre-authorized access token for worker resources (deploy, faucet) redeemable without full auth.
- Worker token: A short-lived session token minted after an SIWE-style login; it encodes scopes granted by on-chain gates.
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
- `/session/new` (alias: `/new`; sponsored links can land here as `/new?sponsored=<txId>#k=<secret>`): Session Wizard (deploy/configure worker, upload metadata, register on-chain).
- `/session/:token`: Session landing page (accepts a slug or a UUID-like session id token; resolves and renders a one-page session view).
- `/session/:token/questions`, `/session/:token/questions/results`: Session-scoped question list/results rendered inside the session shell.
- `/session/:token/docs`: Session Doc Library (indexed by `sessionIdHex`; supports upload/browse + optional Lit encryption; session-id tokens are kept stable on this subroute).
- `/surveys`, `/survey/:id`, `/survey/:id/results`: Survey list/view/results.
- `/questions`, `/questions/results`: Question list/results.
- `/question/:id`: Single question view. Canonical session hint uses `?session=<slug>` (legacy `?group=<slug>` accepted).
- `/sbts` and `/groups`: SBT groups list and creation UI (including session-scoped list aliases such as `/sbts/:slug` and `/groups/:slug`).
- `/sbt/:address` and `/group/:address` (legacy password suffixes still supported on detail flows where applicable): SBT detail and minting/claim UI.
- `/admin`: Session admin UI (registry and worker tests; sessionId query supported).
- `/sponsor`: Sponsor page for generating grant-backed sponsored-bundle links into the Session Wizard.
- `/bookmarks`: Bookmarked surveys/questions/SBTs/users.
- `/debate`: Experimental stub for an older debate/discussion surface; not part of the supported public surface in this build.
- `/atlas` and `/tag/...`: Debate map / AI Policy Atlas demo surface.
- `/matrix`: Risk matrix demo view.
- `/demos`: Demo sessions launcher (`/agent` also exists as a dev-only route).
- `/contracts`: Contract source viewer page.
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
- Open pile-adjacent listening mode with `/session/<slug-or-id>?mode=listening`; the panel starts only after the user clicks Record, then rolls 3-minute transcription chunks into a stitched transcript and draft question suggestions.
- Open session-scoped question views via `/session/<slug-or-id>/questions` and `/session/<slug-or-id>/questions/results`.
- Open the session doc library via `/session/<slug-or-id>/docs`.
- Create a new session via the Session Wizard (`/session/new` or `/new`), including grant-backed sponsored-bundle entry links.

What the system does:
- Stores session gates and key operational pointers on-chain in `SessionRegistry` (authoritative for access).
- Stores session content/config on Arweave (metadata URI), optionally with Lit-encrypted fields.
- Stores worker operational config + secrets in Worker KV (not authoritative for gates).
- Maintains legacy compatibility while migrating from `demo/demo_sessions.json` to on-chain registry reads.

Deep-dive docs:
- `docs/session-registry.md`
- `docs/session-cors-worker.md`

### 2) SBT Groups (Membership and Gating)

What users can do:
- Create SBT contracts (via `SBTFactory`) with tokenURI metadata stored on Arweave.
- Mint/claim SBTs using multiple distribution modes (open claim, password claim, invite-limited flows, and signature-based flows).
- View SBT group details and mint status, and interact with group gates (as used by the session and worker).

What the system does:
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
- Uses `SessionRegistry` as the single source of truth for access gates (Any/All, per-resource).
- Worker login checks gates on `/auth/login` and issues a scoped token (`ai`, `arweave`, `transcribe`, `faucet`, `fetch`, `lit`).
- Gated encryption/decrypt uses the worker-mediated Lit Chipotle runtime for supported sessions; legacy Lit payload readers remain for compatibility.
- Stores per-field metadata encryption decisions via `encryptedFieldGates` (values are `string | string[]`; 1 gate stays legacy `string`, 2+ gates become `string[]`).
- Stores per-question/per-survey encryption audiences in the payload (`encryption.gates`), and SurveyTool derives response encryption recipients per question from that lock state (with fallback to session response gate policy when a question is not locked).

Deep-dive docs:
- `docs/session-registry.md`
- `docs/lit-protocol-information.md`

### 6) Worker-Sponsored Resources (AI, Arweave, Transcription, Faucet, Fetch)

What users can do (through the app UI):
- Make AI calls (for question generation and other assistive features).
- Transcribe recorded audio to text.
- Upload JSON and markdown payloads to Arweave.
- Request small amounts of testnet ETH when below a threshold (testnet faucet).
- Fetch remote URLs/images through a controlled proxy for safety/CORS.
- Redeem sponsor-provided deploy/faucet grants during session setup flows.

What the system does:
- Enforces CORS and per-session allowlists.
- Stores session config and secrets in KV.
- Requires auth for secret-using endpoints by default, but `POST /ai` and `POST /transcribe` also support anonymous access when the session config allows it.
- Supports admin-signed bootstrap paths for `POST /arweave/upload` when no bearer token is present.
- Supports worker-mediated Lit Chipotle setup and execution through signed admin `lit-chipotle-*` actions and authenticated `/lit/chipotle-action` runtime requests.
- Supports grant-backed sponsored setup flows via `/sponsor`, `POST /admin/issue-sponsored-grants`, `POST /sponsored/redeem-deploy`, and `POST /sponsored/redeem-faucet`.

Deep-dive docs:
- `docs/session-cors-worker.md`
- `docs/resource-keys.md`

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
- Upload and browse documents associated with a **Session** (discoverability by `sessionIdHex`) and/or an **SBT group** (discoverability by `chainId + sbtAddress`).
- Store either plaintext docs (Arweave) or Lit-encrypted docs (Arweave payload encrypted client-side; decrypt gated by SBT ownership conditions).
- Add a URL as a small “link record” (optionally Lit-encrypted) without uploading remote content.
- View decrypted/plaintext docs inline (images/PDF/audio/video/text) or download as a file.

What the system does:
- Indexes docs using Arweave tags (all `CE-*`), and lists them via Arweave GraphQL (`https://arweave.net/graphql` by default).
- Uses SessionRegistry’s `docUploads` gate as the *default* encryption audience when configured:
  - If `docUploads` gate is empty or unavailable, session docs default to plaintext (no fallback to any “general” gate).
- Allows encrypted uploads to target either the session `docUploads` gate or a custom SBT audience, with a "Copy from session gate" shortcut to prefill the session audience.
- Enforces association integrity and anti-spam at upload time in the Worker:
  - `CE-SessionId` must match the authenticated session’s on-chain `sessionIdHex`.
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
- `workers/sessionCorsWorker/worker.js`: Multi-tenant, KV-backed secrets/config, auth tokens, and sponsored resource proxying.

Optional helper:
- `workers/deploy-helper/`: Helper for one-click Worker deploys from the Session Wizard (trusted endpoint).

Worker API (selected endpoints):
- `POST /auth/nonce`: Start SIWE-style login (returns nonce).
- `POST /auth/login`: Verify signature + gates and mint a session token with scopes.
- `GET /health`: Authenticated health check.
- `POST /ai`: AI proxy (provider-based); authenticated by default, with anonymous access supported when the session config allows it. Also supports `POST /` with `{ action: "ai", ... }`.
- `POST /transcribe`: Transcription proxy; authenticated by default, with anonymous access supported when the session config allows it.
- `POST /arweave/upload`: Authenticated Arweave upload (also supports an admin-signed bootstrap path when no auth header).
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
- `POST /`: Authenticated action-style requests using an `action` field: `request_test_eth` (testnet faucet), `fetch_url`, `fetch_image`.

### Storage and Data

- Arweave: durable JSON payloads for session metadata, survey metadata, question payloads, and SBT tokenURI metadata.
- Worker KV: operational per-session config and secrets.
- Browser localStorage: caches for surveys/questions/responses/SBTs/bookmarks/user scans.
- Browser IndexedDB: passkey EOA encrypted wallet records. Plaintext wallet
  keys must not be stored in localStorage or IndexedDB.

## Configuration Surfaces

Client-side:
- `client/src/variables/appConfig.ts`: user-visible feature flags and default endpoints (worker URLs, chain defaults, debug toggles).
- `client/src/variables/demo/demo_sessions.json`: legacy session config source and fallback during migration.
- `client/src/variables/local-contracts.json`: local chain contract address overrides (written by deploy scripts).

Worker-side:
- Worker KV session config and secrets (see `docs/session-cors-worker.md` for shapes and bindings).

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
