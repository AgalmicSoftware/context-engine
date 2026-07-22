# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

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
  Context Engine circuit C on white across browser, Apple touch, and Android icons.
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
- Split the desktop main-screen welcome controls into equal-height rows and
  aligned their rail to the slide edges without changing session welcome slides.
- Stabilized the desktop main-screen welcome carousel at one responsive frame
  height so advancing between slides no longer resizes the card.
- Added the agent bridge worker and its test runner to the public release
  surface, with public-safe setup examples and artifact-level PII verification.

### Fixed

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
- Added `/new` Cloudflare payload access modes: default `worker_sbt_gate` worker-enforced SBT access control without Lit credential requirements, plus a `lit_encrypted` scaffold that requires pre-encrypted payloads and rejects plaintext Cloudflare uploads until the Lit envelope path is complete.
- Fixed encrypted Document Library image thumbnails so scoped Lit hooks arriving after initial render trigger preview loading.

### Remaining TODOs

- Finish the Cloudflare `lit_encrypted` envelope producer/reader so documents, private questions/responses, surveys, and generated artifacts can be encrypted before `/storage/upload` without routing through Lit-Arweave.
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
