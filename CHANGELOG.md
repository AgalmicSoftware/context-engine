# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Added a named runtime SCSS app-theme contract with user/deployment precedence,
  pre-paint initialization, a default-on Settings selector, and bundled
  `context-engine` and `classic-95` themes. The complete client presentation
  surface now consumes semantic runtime color, typography, geometry, border,
  elevation, and control-state tokens; a zero-baseline source gate prevents
  raw presentation colors outside narrowly owned theme, export, QR/bitmap, and
  deterministic avatar sources. Session metadata cannot select an app theme.
  Question authoring now uses explicit paired workspace/control/input tokens;
  Classic 95 renders the generator and its toolbar on readable standard gray
  surfaces with white fields instead of mixing black controls into navy. The
  session question, simulated-user, and Groups surfaces now retain readable,
  minimal gray panels at desktop and mobile widths. Its semantic
  `desktop-window` layout profile now presents Tools as Control Panel applets,
  Community Stats as a participant/plot split window, session questions as
  compact dialogs, and footer navigation as a taskbar without theme-ID
  selectors in components. The Classic 95 taskbar stays docked to the viewport
  bottom on short and scrolling pages while reserving space for page content.
- Fixed local Vite startup for the shared CommonJS group-password derivation
  helper. Persistent startup failures now stop after one automatic cache-busted
  reload, and the recovery heading uses the active panel-text token so the
  fallback remains readable across themes.
- Added **Session colors** to the Session Wizard with the curated
  `context-engine`, `ocean`, and `amber` schemes, immediate preview, exact
  `appearance.colorSchemeId` persistence across Worker/Arweave paths, scoped
  active-session accents, accessibility contrast checks, and fixed-light
  standalone exports.
- Replaced the `/contracts` utility reference with a user-facing `/docs` page
  containing a quickstart, session-options guide, and FAQ. The page retains
  AI prompt references and a contract deployment explorer that waits for an
  explicit session selection before showing its chain and published contract
  addresses; sessions without published addresses show an empty state instead
  of global template contracts. The page removes the JSON bundle and
  byte-conversion UI. Existing `/contracts` paths permanently rewrite to
  `/docs` while preserving deep-link paths, queries, hashes, and deployment
  base paths.
- Added a repository link to the Docs header. Refreshed the public `llms.txt`
  agent summary with the
  current deployment profiles, authoritative architecture references, and safe
  automation guidance.
- Made address comparison session-aware across legacy registry, pure
  Cloudflare, and hybrid session profiles. Compare routes now preserve the
  active session, wait for its canonical caches, isolate cache and prompt
  fallbacks by slug, await on-chain profile enrichment before analysis, and
  skip chain scans for pure Worker sessions. Independent summary, compass, and
  overlap work now loads concurrently with section-level progress, and compass
  exports use a descriptive comparison filename. Two- and three-participant
  Venn diagrams now share one deterministic region model, expose keyboard- and
  click-pinned detail cards with membership images, and keep AI output from
  overriding region counts or evidence. SBT comparison and profile ownership
  now share session + chain + contract identity and one count-provenance rule;
  native Worker Groups use the same projection contract with session + group
  identity. Canonical compare URLs now use repeated `subject=` parameters with
  explicit `wallet:`, `worker:`, and `sim:` tokens; legacy address-path links
  normalize through the same route contract. Wallet and Worker responders now
  resolve from the active session projection while shipped simulated personas
  use stable corpus question IDs; the UI names each source and session, skips
  chain/cache waiting for simulation-only comparisons, and suppresses opinion
  or membership sections when their evidence is not canonically compatible.
  Related simulated-persona cards now offer a canonical compare action while
  retaining their existing profile links.
- Moved the Community, Polis, and demographic-comparison question beeswarms
  onto a reusable renderer with explicit consumer-owned metric/domain labels,
  named force/stacked layouts, stable-key hover state, and
  keyboard/click-pinned detail cards. Community's live and demo paths also
  share one result-to-point projection so their counts and fallbacks cannot
  drift.
- Clarified the repository boundary between canonical Worker source,
  Cloudflare-native deployment packages, local bundle output, immutable CI
  bundle releases, and the stripped public-source snapshot. Release docs now
  accurately distinguish immutable bundle publication from the separately
  approved stable/`latest` promotion workflow. Source-tree public-text checks
  now scan the same tracked and non-ignored files as the release exporter,
  avoiding ignored local caches without overlooking untracked release input.
- Streamlined the client dependency surface by removing eight unused direct
  packages, replacing standalone preview and source-map tools with Vite-native
  preview and a local deterministic bundle report, and loading only the
  two-input and three-input Poseidon implementations used by survey runtime.
- Added automatic patch-version commits for each prepared public release
  candidate, synchronized across root/client manifests and lockfiles. Public
  release tooling, pre-push checks, CI, and worker-release metadata now enforce
  the shared version, while minor and major bumps remain explicit
  operator-directed decisions.
- `/new` now capability-filters optional fields even after `Customize`: pure
  Cloudflare sessions omit block, faucet, and contract controls, persist
  generic Worker/Group defaults, and may set a Worker-enforced closing
  timestamp that stops participant resource use and mutations while preserving
  reads and signed admin access. Explicit Cloudflare + on-chain SBT profiles
  expose only their network and Group Factory subset; decentralized profiles
  retain their chain controls. Worker Group creators now prefill the configured
  generic tags with legacy `defaultSbtTags` fallback. Joining a Worker Group now
  reports success and changes the membership action to **Leave**; authenticated
  participants can remove only their own membership through `/groups/leave`.
  Permission-visible Groups expose a paginated SBT-style member browser without
  leaking Worker storage keys, and unlimited capacity now uses only the
  infinity icon instead of repeating “Unlimited.”
- Telegram group approval no longer creates bearer-capability `startgroup`
  URLs. Bot, Mini App, and Agent API compatibility surfaces now direct a
  configured session admin to approve from inside the target group with
  `/join <session>`, while legacy approval payloads fail closed. Mini App
  onboarding now accepts signed Telegram `initData` only in a POST JSON body or
  the canonical request header; GET and query-string credential transport are
  rejected.
- Worker-canonical sessions now project setup, account settings, Admin metadata,
  diagnostics, secrets, and route errors from the active capability profile.
  Pure Cloudflare sessions use passkey access, Worker config, AI, storage, and
  native Groups without presenting RPC, gas, faucet, Arweave, Lit, registry, or
  SBT requirements; explicitly enabled hybrid and registry sessions retain
  their chain controls. Profile compilation, persistence, canonical readback,
  and Worker validation now reject schema-only, unavailable, malformed, and
  cross-lineage combinations instead of inferring capabilities from legacy
  chain fields. Profile-bearing Worker records now require one matching
  canonical storage object, including exact backend, payload policy, and access
  conditions; incoherent deploys, mutations, and public readbacks fail closed.
  Public-result claims require unencrypted public storage. Session pages also suppress wallet/network controls, Lit hooks,
  SBT auto-mint and filters, non-Cloudflare document references, and Polis
  blockchain metadata for pure Worker profiles, clearing stale chain-backed
  state when the active capability profile changes.
- The native `/new` deployment path now presents an honest Cloudflare dashboard
  checklist with copy controls, return guidance, and Worker URL/CORS/canonical
  config verification before success. Its entry chooser removes redundant
  infrastructure guidance, identifies decentralized RPC access and gas as
  `EVM RPC URL` and `EVM Gas (TX Fees)`,
  and links directly to the README architecture diagram on GitHub. The
  deploy-helper remains a collapsed legacy fallback.
- Worker route failures now distinguish missing discovery, reachability, CORS,
  missing canonical config, and identity mismatch, while native Group cards add
  stable detail/share links and state the current admin-managed leave boundary.
- Worker-canonical web sessions now use native Cloudflare Groups instead of
  opening the on-chain SBT deployment form. Group records support names,
  descriptions, HTTPS images, open or admin-added membership, and visibility
  without contract addresses, chain transactions, gas, RPC, or burn settings.
  They also retain SBT-style tags and public reference URLs plus Worker-native
  member limits, self-join deadlines, and group-admin addresses; limits and
  deadlines are enforced in the authoritative Durable Object membership path,
  and participant creation derives the admin address from the signed principal;
  their creator now shares the compact URL, clipboard-paste, file-upload, and
  preview workflow used by the SBT creator, publishing uploaded files through
  the active session storage policy before group creation;
  the client pins the exact Worker origin while nonce/login, JWT, Group
  request/response, record, and Durable Object state bind the canonical slug and
  session ID. Missing or conflicting identity and pre-existing same-slug data
  fail closed with reconciliation required, late cross-session responses are
  discarded, Worker/SBT hybrids label their configured on-chain conditions
  separately as Advanced access, Worker-native creation stays scoped to the
  active session, and registry-backed sessions retain the SBT flow. Native
  Group card bodies now open the full SBT-style detail layout in a new tab;
      canonical list links use `/groups?sessionName=<slug>` and non-address
      Worker detail links use `/group/<groupId>?sessionName=<slug>`. Legacy
      `/groups/:slug` links normalize to those routes, while address-shaped
      Worker IDs remain at `/groups?sessionName=<slug>#group-<groupId>` so
      `/group/<address>` stays reserved for SBT detail.
  Full detail translates SBT stats into member capacity and a live join
  deadline, exposes member counts and identities only through authenticated
  visibility-aware responses, and renders the Group's public document
  references and tags in the shared More section.
  Legacy per-session Worker question payloads without an embedded session ID
  remain readable from their verified Worker authority, while present
  mismatched or malformed IDs still fail closed; cache readiness now commits
  after the final Worker hydration state so session question collections render
  immediately.
- Every `/new` mode now offers an admin-only or all-participants group-creation
  policy. Worker participants use an authenticated, chain-free create route
  that forces open session-visible groups while admin mutation controls remain
  signed. Independently, explicitly public, unencrypted, ungated Worker modes
  expose only redacted, session-visible group metadata before sign-in; private
  modes and all joining, creation, memberships, member identities, and member
  counts remain authenticated. Public group routes stay anonymous even when the
  browser remembers an account, deferring Worker authentication until a visitor
  chooses Create or Join; session-scoped group routes also expose their
  canonical session identifier in the query string and a prominent link back
  to the active session. Registry sessions enforce the creation choice across
  their session and SBT page controls while disclosing that public factories
  remain independently callable on-chain. Legacy Worker configs remain
  admin-only.
- Git-backed Netlify builds now bind the native Cloudflare Deploy Button to
  Netlify's exact public `COMMIT_REF`; builds without a public commit remain
  fail-closed with the native deployment card disabled.
- Public-release scrubbing now preserves the byte-stable generated Cloudflare
  Worker package while continuing to scan its bundled dependency contacts,
  preventing email-shaped wordlist data from being rewritten after hashing.
  Hosted public-text verification now builds a temporary canonical release
  artifact and scans its actual bytes, while direct source-tree verification
  remains strict.
- SBT claim and invite codes now default to explicit export without silent
  browser persistence; existing scoped recovery entries remain readable for
  compatibility.
- Added explicit opt-in encrypted SBT recovery using AES-GCM, authenticated
  chain/address metadata, and a non-extractable IndexedDB key. Unsupported,
  missing-key, and tampered records fail closed to export-only behavior, and
  group-scoped local recovery can be cleared from the admin UI.
- Made Worker authorization current at request time. Login tokens now bind a
  server-managed session authorization epoch, effective config changes
  invalidate prior tokens, and protected routes fail closed unless both the
  signed scope and the current default/route-specific policy allow access.
  Nonce redemption and route limits now use the mandatory Session Durable
  Object, closing cross-isolate replay and concurrent-limit overshoot without
  persisting principal identifiers in coordinator records.
- Encrypted every canonical Session Worker secret record at rest with
  session-bound AES-256-GCM before deploy-helper or signed-admin KV writes.
  Current/previous KEK recovery is bounded, legacy plaintext records are
  read-only compatible and migrate on signed update, all new deployments
  receive an independent KEK, and interrupted activation cannot silently bind
  ciphertext to a lost replacement key.
- Closed the legacy first-signer Worker bootstrap path. Initial session config
  now requires either the deployment-bound bootstrap admin or an existing
  registry session whose on-chain admin matches; missing registry wiring and
  unregistered slugs fail closed.
- Enforced client entry, non-vendor chunk, and temporary AppShell byte budgets
  from Vite's build manifest, with protected no-growth policy and generated-doc
  drift checks. Removed an unconsumed static-image compatibility copy that
  duplicated 21 emitted assets (16,618,799 bytes); future cross-tree image
  duplicates now fail the post-build gate.
- Made client test-universe claims complete and monotonic. One instrumented
  Jest run now accounts for every tracked production source while preserving a
  fixed legacy comparison metric; recursive Node discovery closes nested test
  omissions; and every tracked typed test/helper is classified under a
  real-framework-type diagnostic ratchet. Coverage exclusions, floors, legacy
  membership, and typed-test debt now fail closed against protected baselines.
- Bound Worker releases to the exact bytes produced by successful aggregate
  CI. SHA-keyed artifacts now carry source/replay/tree, builder-run, recipe,
  lockfile, and bundle-digest provenance; publication refuses failed or
  mismatched runs and never rebuilds. Immutable releases no longer move
  `latest` automatically, while a serialized, protected manual promotion keeps
  stable and previous rollback refs. GitHub Actions are pinned immutably.
  Session Setup and Admin Wrapped deploys now bind the corresponding manifest
  digest before request coordination and reject changed bytes before any
  Cloudflare mutation, including retry and repair paths.
- Unified local and hosted CI behind `scripts/ci-gates.json`. The local
  aggregate now runs the full client coverage and tracked root Node universes once,
  hosted jobs execute the same named gates, aggregate results fail closed
  against the hosted profile, and `verify:release` remains a separate
  non-coverage release rehearsal. Public-package scrubbing keeps retained gate
  commands aligned with retained scripts.
- Hardened new-session profile continuity and enforcement: explicit saved
  profiles now survive `/new` reloads behind a clear continue action, invalid
  profiles fail before publish side effects and are rechecked against the live
  draft after asynchronous preflight, stage-local errors identify the
  setting to fix, storage backend changes preserve an explicit Cloudflare role
  gate without carrying Cloudflare fields into Arweave, and unsupported
  result/export promises remain visible but unavailable. The compact selectors
  now support arrow keys and editable multi-digit group thresholds.
- Made Telegram Mini App an independently enforced session surface that still
  requires Telegram, while keeping Agent Session Wrapped independent. The
  Bridge now consumes canonical nested result-exposure settings before legacy
  aliases and excludes Mini-App-disabled sessions from every Mini App picker
  and route; onboarding cannot mint a credential for a disabled Mini App,
  activity and settings requests fail closed when no enabled session remains,
  and launch-bound settings cannot target a different session.
- Made direct Agent HTTP authorization independent of Telegram for user invite,
  service bootstrap, and ordinary authenticated API requests. Explicit session
  profiles now enforce `surfaces.agentHttp`; pre-profile Bridge records retain
  their historical direct API behavior unless they explicitly disable it.
- Integrated hosting customization into the existing session setup stages:
  storage, encryption, decryption access, and result visibility now live in
  Privacy; optional participation channels live in Worker; and export policy
  lives in Deploy. The compact header no longer opens a large technical
  popover, profile-based drafts no longer show a duplicate legacy storage
  editor, and custom decryption rules stay hidden until the creator overrides
  the explicit Cloudflare defaults.
- Moved session hosting selection into a compact header control, kept the
  selected Cloudflare, decentralized, or custom profile visible in the title,
  and previewed Corporate hosting as unavailable without changing publishing
  semantics. Cloudflare token guidance now explains that the linked form
  prefills permissions for users already signed in.
- Made `contextengine.sh` the canonical public URL across site metadata,
  discovery assets, documentation, and Agent Bridge links. Worker and Bridge
  bootstrap allowlists now prefer `.sh` while retaining `.xyz` as redirect
  compatibility.
- Replaced the placeholder emoji favicon family with an optically centered
  white Context Engine circuit C on transparent browser, Apple touch, and
  Android icon backgrounds, using the high-resolution circuit artwork for the
  larger touch and installed-app assets.
- Added a repository-owned Netlify build contract for strict, Node 20 client
  builds from public `main`, with pull-request preview guidance and the existing
  manual-deploy redirect fallback retained.
- Refreshed the AI discourse corpus with verified 2026 policy, safety,
  evaluation, and practitioner sources; consolidated duplicate records,
  repaired primary-source provenance and tweet metadata, synchronized the
  client sample, and added normalized-URL and duplicate-title quality gates.
- Toolchain correction (2026-07-19): Vite is the canonical client dev/build
  path, and normal client installs again use npm's strict peer resolution.
  Earlier entries describing Create React App as canonical or durable
  `legacy-peer-deps` installation reflect superseded intermediate states.
- Unified Agent Bridge authentication around session-bound user, browser, and
  named service credentials. Telegram is now an optional identity adapter;
  one-time invites can onboard an opaque non-Telegram user, the root token is
  limited to bootstrap/break-glass semantics, and browser exchange returns
  separate Bridge and session-worker credentials.
- Added the hybrid Agent Session Wrapped path for worker-canonical and
  registry-canonical sessions through one deployment-pinned session-Worker
  membership verifier. Dedicated Bridges now require explicit one-session
  policy, use the sole `surfaces.agentHttp` capability bit, deploy without the
  unused Durable Object or Telegram resources by default, exchange Worker
  credentials for at-most-24-hour session-bound `ceagt_` member credentials,
  and accept Wrapped answers over HTTPS/KV without an agent-originated EVM
  transaction. Session Setup and Admin support request-only enable, retained-
  resource disable-access, health, and idempotent redeploy controls with
  capability publication only after durable verification. Ordinary Wrapped
  uses canonical session questions, explicit historical/agent-only configs
  retain proposal windows and storage prefixes, and posters default to the
  deterministic local renderer with separately configured optional OpenAI
  generation.
- Added direct session-worker access-group views and open self-join controls to
  agent-enabled sessions, plus signed group and member administration in the
  existing Admin surface. The Agent Bridge does not proxy or mirror this state.
- Removed the unused mock OpenClaw forwarding module and catalog entry while
  retaining transport-neutral direct HTTP and optional host-agent adapters.
- Completed the frontend modernization baseline with typed domain boundaries,
  downward-only type-debt and size ratchets, decomposed session, survey, and
  application shells, split CI/release verification, synchronized worker-bundle
  checks, and public-release surface validation.
- Added stable automation hooks for gate-lock state and gate selection without
  changing user-facing behavior.
- Hardened public documentation packaging so operator runbooks and internal
  planning material are stripped, while retained Markdown is checked for
  private references, unavailable commands, and broken local links.
- Hardened public release artifacts so private file inventories are not
  published, retained text is scanned for private references, and unowned image
  files fail verification; removed unused image assets without changing the
  active animated logos.
- Reduced the two active logo GIFs by about two thirds while preserving their
  dimensions, duration, looping behavior, luminosity-blended presentation, and
  current Navbar and SBT loading owners.
- Enlarged the sparse three-card Tools view so its image cards use the available
  full-screen width and viewport height while retaining compact mobile sizing.
- Replaced the default Tools image-card status frame with UserPage-style 3D
  depth, keeping live/future borders visible only while demo mode is enabled.
- Moved desktop main-screen Welcome controls into a compact bottom strip and
  kept titles, artwork, and copy within one viewport-capped frame, including
  ultra-wide/short displays, without changing session welcome slides.
- Added theme-owned Welcome artwork detail controls so Classic 95 can present
  legacy slide images as quiet grayscale illustrations while Context Engine
  preserves its original treatment.
- Added the agent bridge worker and its test runner to the public release
  surface, with public-safe setup examples and artifact-level PII verification.

### Fixed

- Corrected passkey account creation so Chromium-compatible registration offers
  ES256 and RS256, uses PRF output from registration without an unconditional
  sign-in-style second prompt, and labels the pending action as creation.
  Worker-canonical sessions now retain their verified dedicated Worker during
  response submission, skip chain-only block scans and automatic faucet calls,
  finish durable Cloudflare response writes without an EVM transaction, and
  hydrate those responses after reload under a stable chainless cache scope.
  Response list metadata is bound to the authenticated Worker uploader instead
  of trusting a self-claimed responder address in the stored JSON.
- Replaced the About-page Google Drive video embed and thumbnail dependency
  with the repository-owned `about-demo.mp4` on desktop and mobile, so public
  playback no longer depends on third-party cookies or Drive playback limits.
- Kept registry-backed session scans bounded when Arweave metadata is temporarily
  unavailable by deriving the creation block from the registry tuple timestamp
  before attempting legacy event-log recovery.
- Kept history-preserving public releases self-testing when the Agent Bridge
  cutover follows a source-only baseline by restoring its narrow root test
  command alongside the audited worker and runner snapshot, while using the
  artifact scrubber to remove commands whose private runners are stripped.
- Made Agent Bridge credential rotation publish replacements before retiring
  prior records, rejected query-string bearer credentials and nested browser
  exchanges, pinned credentials to their issued session, and made managed
  account issuance fail closed without signer configuration.
- Enforced `session_member_aggregate` result visibility against live canonical
  worker membership and the configured minimum group size for JSON and image
  results, failing closed when membership cannot be checked. Telegram-optional
  user and service exchanges now derive their worker wallet from the stored
  credential principal.
- Prevented worker-native group state from silently switching to an unrelated
  D1 or envelope-audit binding: session-worker groups now use only the explicit
  group KV or storage-index KV aliases, and D1-only group configuration fails
  as unconfigured.
- Kept worker-envelope key-release audits on the explicit audit KV or storage
  index KV, ignored unrelated D1 aliases, and preserved fail-closed
  audit-before-decrypt behavior when persistence is unavailable.
- Required the explicit `groups` JWT scope for worker group listing,
  self-membership reads, and joins instead of accepting the legacy `arweave`
  storage compatibility scope.
- Stopped generated session-worker Cloudflare profiles from advertising an
  unused D1 primitive; payload indexes, envelope audits, and group records now
  describe the KV authority that the deployed worker actually binds.
- Made KV index rows authoritative for per-item Cloudflare R2 authorization
  metadata: uploads now require a readable/writable index binding, and reads
  fail closed without a valid matching row instead of falling back to weaker
  object metadata.
- Bounded Cloudflare storage listings to opaque-cursor pages and preserved
  manual continuation in the Document Library when authorization filtering
  produces an empty page with a later cursor.
- Made targeted survey-response refreshes merge into the latest cache snapshot,
  resolve concurrent same-responder updates without regressing newer or
  unorderable values, keep scan watermarks monotonic, and publish their UI
  revision only after durable cache persistence succeeds; detached initial
  refresh failures are now caught and logged at the results lifecycle boundary.
- Made the remaining survey and question discovery, response hydration, and
  application event cache commits merge only their active deltas into the
  latest managed-cache snapshot. Concurrent metadata, responder recency,
  retry state, and monotonic watermarks are preserved, while readiness,
  revisions, and awaited success are withheld when persistence fails.
- Serialized first-use worker-envelope keys and signed session-config writes
  through one per-session coordinator, rejected unreadable R2-only envelope
  writes, and removed unsafe unused key-changing Admin actions. Cloudflare
  uploads retain documented at-least-once retry behavior.
- Hardened the `Surveys` source contract and client preflight so zero survey or
  question IDs, zero content or response hashes, and mismatched optional
  survey-response pairs fail before ambiguous state or wallet submission.
- Required configured deterministic SBT deployments to be submitted by the
  configured SBT admin in both the source contract and ethers-v5 client
  preflight, preventing public callers from front-running predicted addresses.
  These immutable-contract fixes require a separate testnet redeploy before
  they are live at configured addresses.
- Fixed passkey survey-response uploads by preserving object-valued EIP-1193
  providers through worker authentication, kept SBT metadata and image reads on
  AR.IO while direct mode is enabled, and extended the shared RPC 429 probe
  window so exponential backoff engages before neighboring reads create a burst.

## [0.7.0] - 2026-07-06

### Added

- Published the M1 source release with a curated public tree and public-safe
  history on `main`.
- Added the mode-first session creation entry flow for Cloudflare-backed and
  decentralized sessions, with the existing setup UI revealed after Continue.
- Added public release PII scanning and stricter public push protection for
  release branches.
- Added a default-off MetaMask build profile. Passkey-only builds remove the
  MetaMask login control and fail if MetaMask/RainbowKit connector modules or
  assets enter the emitted client bundle.

### Fixed

- Fixed public CI regressions in passkey PRF normalization, public contact
  email handling, stripped corpus helper scripts, and private E2E script naming.
- Kept public package scripts and release-surface checks aligned with stripped
  private runner paths.

### Operator TODOs

- Tag `v0.7.0` after the public `main` state and latest worker-bundle release
  asset smoke check are confirmed.

## 2026-07-03

### Completed TODOs

- Added the public `/posts` route backed by root-level Markdown files, a default-on `REACT_APP_CE_ABOUT_POSTS_ENABLED` toggle, an About-page Posts link, static Vite serving/copying for `posts/`, per-post attachment directories, manifest header images, Markdown image blocks, and initial `ce-viz` post exhibits for category dot grids, ranked theme panels, theme networks, and quote walls.

## 2026-06-09

### Completed TODOs

- Added a public-release surface verifier that blocks JavaScript/TypeScript imports into stripped paths before release branches are imported or pushed, changed the Worker Chipotle tests to read the public client action catalog instead of a private mirror, and made release replay run public `test:node` before push so stripped public-copy regressions fail locally.

## 2026-06-06

### Completed TODOs

- Added a signed worker `secret-presence` admin action that returns allowed-key booleans without exposing secret values, and updated `/admin` Worker secrets cards so blank write-only inputs show unknown/configured/empty status from the worker presence manifest instead of local draft emptiness.

## 2026-05-25

### Completed TODOs

- Added the first Session Results HTML report export slice: redacted snapshot/HTML helpers, safe embedded JSON, a SurveyResults confirmation/download flow, and focused regression coverage.
- Extended Session Results exports with logged-in downloader metadata, visible artifact watermarking, explicit unavailable reasons, section checkboxes, exported viewer/static HTML/single-page PDF options, and local AI-generated analysis artifacts that use synthetic participant IDs before provider calls.

## 2026-05-17

### Completed TODOs

- Added a Vite sidecar for the React client with separate `dev:vite`, `build:vite`, and `preview:vite` scripts, `build-vite/` output, CRA-compatible env/static-asset shims, and focused ethers ESM import compatibility while keeping CRA/react-app-rewired as the canonical client path.

## 2026-05-13

### Completed TODOs

- Kept uploaded sponsored Custom RPC URLs out of public registry fields while preserving the `sponsored_rpc` flag, and made sponsored RPC access fall back to the session's default on-chain gate when no resource-specific RPC gate is set.

## 2026-05-09

### Completed TODOs

- Hardened worker-mediated Lit Chipotle encryption by forwarding worker env credentials into authenticated execution, allowing non-holder authors to encrypt for a target SBT audience, enforcing SBT ownership only for check/decrypt, deriving decrypt/check RPC URLs from worker-approved config/defaults, verifying action-side chain IDs, binding v2 wrapped CEKs to canonical policy fingerprints, rejecting legacy Chipotle wrapped-key formats, and documenting the required Lit Action CID re-provisioning step.

## 2026-05-08

### Completed TODOs

- Added the session storage routing layer with normalized `storageRef` compatibility, worker `/storage/upload`, `/storage/read`, and `/storage/list` contract tests, Cloudflare-safe opaque refs backed by mocked R2/KV contracts, Lit-Arweave document enforcement, and Document Library routing for Arweave, Lit-Arweave, and plaintext Cloudflare docs/context while preserving legacy `/arweave/upload` and `arweaveTxId` behavior.
- Threaded `storageRef` compatibility into client question/survey/response reads and CE-CC agent question/response summaries where legacy Arweave tx ids are still the contract source of truth.
- Added explicit dual-field helpers, made question/survey/response client and CE-CC records prefer `storageRef` before legacy `arweaveTxId`, extended worker storage tests for `questions`, `surveys`, and `responses`, and documented the future canonical `storageRef` naming migration.
- Routed Cloudflare-configured session question, survey, and response writes through sessionCorsWorker `/storage/upload`, using opaque bytes32-compatible Cloudflare IDs in existing Surveys pointer fields without changing the contract ABI; readers now try Cloudflare `storageRef` resolution before Arweave fallback.
- Clarified Cloudflare setup permissions for R2 payload blobs, D1/KV metadata indexes, and Durable Objects only for signer/runtime coordination.
- Added the then-current `/new` Cloudflare payload aliases:
  `worker_sbt_gate` was the default in this release and `lit_encrypted` required
  pre-encrypted payloads. Both names are now legacy read compatibility; current
  profiles use explicit `gate` and `encryption` fields, and pure Worker profiles
  do not default to an SBT gate.
- Fixed encrypted Document Library image thumbnails so scoped Lit hooks arriving after initial render trigger preview loading.

### Remaining TODOs

- Finish the Cloudflare `encryption: "lit"` envelope producer/reader (legacy
  alias `lit_encrypted`) so documents, private questions/responses, surveys, and
  generated artifacts can be encrypted before `/storage/upload` without routing
  through Lit-Arweave.
- Once all public and agent readers are storageRef-aware, rename the top-level payload pointer contract to `storageRef` in API docs and schemas, leaving `arweaveTxId` as a deprecated Arweave compatibility alias.

## 2026-05-04

### Completed TODOs

- Made direct encrypted-question routes fail soft while fresh Arweave metadata propagates by rendering a masked `[encrypted]` question placeholder and continuing background retries, and restored AR.IO-only Arweave read routing as the default while leaving legacy gateway fanout behind an explicit opt-out.
- Routed Survey contract hash/metadata/response/event reads through the session-aware read provider so open or verified sponsored `rpcUrl` / `rpcUrlsByChainId` entries are actually used for that session before the normal anonymous fallback stack.
- Deprioritized the OP Labs public OP Sepolia RPC in browser fallback ordering and added endpoint-level exponential backoff after RPC 429s so throttled providers are not hammered by repeated reads.
- Added an explicit `Decrypt Prompt` action to gated single-question notices so masked prompts are not only clickable through the `[encrypted]` badge.
- Kept single-question route load passive by preventing legacy Porto session restore from showing a passkey prompt until a signer is actually needed, and fixed the Wagmi RPC backoff wrapper TypeScript build error.
- Made automatic gated prompt/response decrypt respect Porto session-key auto-sign readiness: passive restores no longer trigger repeated passkey prompts during single-question bootstrap, while an unlocked Porto session can auto-decrypt SBT-gated prompts; non-creator metadata decrypts now prefer Lit SBT recipients before self-sign unwraps.
- Preserved per-question source session slugs on profile question cards so created/answered question links use their real session, such as `demo-4`, instead of falling back to the current profile page session.

## 2026-05-01

### Completed TODOs

- Hardened SBT mint-policy enforcement by storing an explicit on-chain `mintMode`, making `claim()`, password minting, reusable group signatures, and invite signatures fail closed outside their declared modes, rejecting contradictory factory deploy args, threading the resolved mode through CreateSBTGroup and deferred session-wizard publish state, and adding regression coverage for the old public-claim group-password vulnerability. Existing vulnerable unlimited `groupPassword` SBTs are not compatibility targets and should be rotated to newly deployed replacements.

## 2026-04-19

### Completed TODOs

- Made the local historical-avatar asset set canonical for demo personas, removed tracked placeholder avatar sentinel strings from the historical figure manifests and demo fixtures, rewrote avatar-source tests to ban placeholder-style sentinels and unapproved hotlinks, cleaned up planning-backed inline TODO comments in `SessionWizard` / `SingleQuestionResponse`, and removed the remaining `sponsoredSbtAddress` compatibility reads so `sponsored.gates` is the only canonical sponsored-SBT shape.

## 2026-04-17

### Completed TODOs

- Pinned `client` devDependency `typescript` to exactly `5.8.3` to match `@lit-protocol/contracts@0.9.1`'s strict peer, and adopted `--legacy-peer-deps` as the durable client install contract via `client/.npmrc` so `npm install` / `npm ci` no longer require the flag at the CLI. Strict restoration of plain `npm install` at the dep-graph level is deferred to the Phase 2 toolchain decision to move off `react-scripts@4` / CRA.

## 2026-04-16

### Completed TODOs

- Taught the shared client read-provider resolver to normalize browser-visible session RPC fields (`rpcUrlsByChainId`, `rpcEndpoint`, `rpcUrl`) alongside legacy `rpc.providers.path.*` overrides, so participant-facing session reads can use session-sponsored RPC directly when the on-chain `rpc` gate is open or the current wallet already has a cached grant, while restricted/unverified cases still fail closed onto the normal fallback stack; added focused regression coverage for worker-only, open, granted, and denied session-RPC selection paths.

## 2026-04-15

### Completed TODOs

- Strengthened crawler-visible discovery by adding a raw-HTML `noscript` summary to `client/public/index.html`, linking the canonical GitHub repo plus the live `main` branch source tree, adding a static `discoverability.html` summary page and `llms.txt`, limiting the sitemap to raw-HTML crawlable pages, and adding tests/docs so the public discovery links stay in sync.

## 2026-04-14

### Completed TODOs

- Stopped tracking generated worker bundle artifacts in `dist/`, updated CI and release verification to rebuild bundles before verifying them, removed the client-served `/worker/sessionCorsWorker.bundle.js` fallback path so normal and sponsored deploy flows now use the hosted GitHub release asset by default while still allowing one-off manual bundle URL or upload overrides after a fetch failure, explicitly marked automated worker-bundle GitHub releases as latest so the client's `releases/latest/download/...` URL stays current, refreshed Session Wizard fallback copy to explain the retry options, and updated docs/tests to treat `dist/*.bundle.js` as generated local fallback output rather than committed repo state.
- Added JSON-LD structured data for the public site so search engines can associate `contextengine.xyz` with the public GitHub repository via `sameAs`, while keeping the structured data synced with SPA route changes.
- Updated the public metadata description to align more closely with the README framing around AI-enhanced deliberation, large-group sensemaking, permanent records, and cryptographic access control.

## 2026-04-13

### Completed TODOs

- Strengthened root-site discovery metadata by updating the SPA shell title/description/canonical/social tags, added static `robots.txt` and `sitemap.xml` crawl assets, pointed root and client `homepage` metadata at `https://contextengine.xyz/`, refreshed the README opening section with stronger public framing and key links, and verified the client build copies the crawl assets into `client/build/`.

## 2026-04-06

### Completed TODOs

- Removed unused client dependencies `react-copy-to-clipboard`, `react-iframe`, `react-moment`, `fetchival`, `html-react-parser`, `papaparse`, `react-tooltip`, and `request`; regenerated `client/package-lock.json`; verified the production client build on Node 20.
- Removed unused client dependencies `axios`, `react-markdown`, `react-chartjs-2`, `chart.js`, `lucide-react`, and `moment`; removed dev dependencies `imagemin-cli` and `redux-devtools-extension`; replaced `classnames`, `react-hot-toast`, `react-datepicker`, and `idb-keyval` with repo-owned client code; regenerated `client/package-lock.json`; verified targeted tests locally and the production client build on Node 16; plain Node 20 `npm run build` still hits the repo's existing Webpack/OpenSSL incompatibility.

### Remaining TODOs

- Outstanding: complete the higher-risk peer-dependency cleanup still needed for clean no-flags `cd client && npm install`, especially `react-rangeslider`, `react-select`, and `reactstrap`.
