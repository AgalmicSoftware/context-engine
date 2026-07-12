# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

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

### Fixed

- Fixed passkey survey-response uploads by preserving object-valued EIP-1193
  providers through worker authentication, kept SBT metadata and image reads on
  AR.IO while direct mode is enabled, and serialized shared RPC reads per
  endpoint so one 429 stops queued requests before they create a console burst.
- Fixed active-session SBT loading and sponsorship reporting by avoiding full
  registry enumeration, refreshing selected worker fields before survey
  uploads, moving the rate-limited Tenderly OP Sepolia gateway to the last
  fallback, and reading boolean-only resource presence from the session worker.
- Prevented repeated RPC retries against browser-forbidden (`403`) endpoints,
  and constrained returning passkey-wallet unlocks to the stored credential so
  SBT mint/sign prompts do not reopen the passkey account chooser.
- Removed failing anonymous OP Sepolia fallback fanout from cold session loads,
  deferred worker resource-presence checks until account settings are opened,
  and resolved Vite's browser `buffer` shim explicitly.

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
- Simplified the Session Results export modal copy, fixed light-mode checkbox/radio layout, and added demo preview mode for local demo analysis sections without wallet auth.

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
