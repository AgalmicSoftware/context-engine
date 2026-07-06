# E2E Workflow Tests (OP Sepolia + Local UI)

The stripped `release-public` OSS copy intentionally omits the repo-level E2E workflow entrypoints under `scripts/test-*.js`, `scripts/test-*.ui.js`, `scripts/e2e/`, and `scripts/lib/e2e/`. This runbook is for the full dev repo or a restored private pack, not the stripped public release artifact.

This repo now includes an expanded CE E2E runner set for:
- Session setup
- SBT create/collect/boundary behavior
- Session/SBT doc encryption paths
- Survey encryption authoring/response matrices
- Gate lifecycle + worker scope matrix checks
- Full-app navigation smoke coverage
- Deterministic AI smoke coverage (CompareAddresses + PolisReport)
- Dev/E2E Agent Mode (JSON-driven actions)

Arweave is public and permanent. Use non-identifying payloads only.

## Prereqs

- Local app at `http://127.0.0.1:3000` (override with `BASE_URL`)
- Playwright + Chromium (or `PLAYWRIGHT_EXECUTABLE_PATH`)
- Testnet RPC + funded deterministic wallets for onchain mode
  - For OP Sepolia reliability, prefer a reliable keyed RPC via `RPC_URL` when available. Public gateways (Pocket/PATH, publicnode, and other anonymous endpoints)
    are rate-limited and can cause flaky `getLogs`/handshake timeouts (and noisy `[RPC_DEBUG] PATH RPC failed` console output).
- For Arweave doc flows: `ARWEAVE_JWK_PATH=/abs/path/to/arweave-test.jwk.json`
  - Generate one locally with `npm run -s arweave:jwk:generate -- --output .keys/arweave-test-wallet.jwk.json`
  - Copy/paste create + show funding address: `npm run -s arweave:jwk:generate -- --output .keys/arweave-test-wallet.jwk.json && npm run -s arweave:jwk:inspect -- --input .keys/arweave-test-wallet.jwk.json`
  - Generate a testnet EVM faucet/admin key with `npm run -s evm:key:generate -- --output .keys/faucet-op-sepolia.key`
  - Show the public address for an existing EVM key with `npm run -s evm:key:address -- --input .keys/deployer-op-sepolia.key`
  - Print the same prefilled Cloudflare token-request link used by the wizard with `npm run -s cloudflare:token-link -- --slug <session-slug>`

## Recommended Setup

1. `cp .env.e2e.example .env.e2e`
2. Set common values:
   - `RPC_URL`
   - `ARWEAVE_JWK_PATH` (required for doc upload/decrypt flows)
     - Verify the configured key with `npm run -s arweave:jwk:inspect -- --expect-address <known-address>`
   - For Session Wizard custom-worker flows:
     - `CLOUDFLARE_API_TOKEN`
     - `FAUCET_PRIVATE_KEY` or `E2E_FAUCET_PRIVATE_KEY` (optional, for prefilled faucet secret field)
     - `E2E_OPENAI_KEY` when running real deploy verification with `E2E_AI_MOCK=0`
   - For fresh full private runs, set `CLOUDFLARE_API_TOKEN` and let session setup create the worker-backed session target.
   - For reuse-only runs, set both `SESSION_SLUG` and `SESSION_WORKER_URL` from an already established E2E session target.
   - Ensure the deterministic wallet you use (derived from the fixture credential ID through the passkey mock PRF/HKDF path) is funded on the target chain.
   - Before private harness runs, `npm run -s ai:harness:doctor` checks that restored operator-local E2E entrypoints resolve. Replace stale `porto-wallet-derivation` imports with `scripts/lib/passkey-derived-wallet.js`.
   - For multi-wallet Polis seeding, keep walletA funded; walletB/C/D/E are auto-topped-up by the runner when below threshold.
3. Run `npm run -s test:e2e` for the public navigation smoke, or any private
   `ai:*` workflow command; the scripts auto-load `.env.e2e.local`, then
   `.env.e2e`.

For the Cloudflare envelope and groups suites, also verify `CLOUDFLARE_API_TOKEN` can create Workers, KV namespaces, and worker secrets. Each run creates a dedicated session worker, a KV namespace, a `CE_STORAGE_ENVELOPE_KEK` worker secret when `worker_envelope` is selected, and a non-identifying SessionRegistry slug on the configured test chain. The key-lifecycle suite rotates/re-wraps envelope keys and, when the token permits worker secret updates, replaces only the test worker's `CE_STORAGE_ENVELOPE_KEK` to prove recovery under the new deployment key. The generated deployment key is process-local and must not be copied into docs, artifacts, or logs.

Committed E2E scripts do not read fallback secrets from `.e2e-secrets/*`; use env, `.env.e2e.local`, `.env.e2e`, or `E2E_ENV_FILE`.

Optional:
- `E2E_ENV_FILE=/abs/path/to/custom.env npm run ai:test-survey-authoring:encryption-matrix`
- `E2E_ENV_DEBUG=1 npm run ai:test-survey-authoring:encryption-matrix`

## Chain Runtime Modes

Current E2E work uses three practical chain-runtime lanes:

| Runtime | How to use it today | Contracts / state | Gas / side effects | Current support |
| --- | --- | --- | --- | --- |
| `onchain` | Default shared path | Live deployed contracts and live chain state | Real gas, persistent writes | First-class |
| `local` | `E2E_CHAIN_MODE=local` on runners that support it | Local Anvil + local deploys | Local gas, no live writes | First-class |
| manual fork | Start Anvil in fork mode yourself, then point `RPC_URL` at that local fork while keeping `CHAIN` / `CHAIN_ID` / `SESSION_REGISTRY` / `SBT_FACTORY` aligned to the upstream chain | Live deployed contracts and seeded live chain state | Local gas, no live writes | Supported as a manual workaround |

Manual fork recipe today:

1. Start a local Anvil fork against the target chain outside the repo.
2. Keep the target chain identity explicit with `CHAIN` / `CHAIN_ID` and any contract overrides that should still refer to the upstream deployment.
3. Point `RPC_URL` at the local Anvil endpoint for the run.
4. If the forked upstream RPC is not the shared default for that chain, also set `E2E_FORK_RPC_URL` so reports describe the actual upstream you forked.
5. Choose mock-vs-live toggles independently (`E2E_LIT_MOCK`, `E2E_AI_MOCK`, `E2E_ARWEAVE_MOCK`).

Current committed runners do not yet auto-spawn or tear down a fork runtime for you. First-class `E2E_CHAIN_MODE=fork` orchestration should remain tracked in private planning until it is implemented.

## Common Env Vars

All new runners accept this common surface:
- `AI_RUN_TAG`
- `BASE_URL`
- `CHAIN_ID`
- `RPC_URL` (recommended: a reliable keyed endpoint for OP Sepolia)
- `SESSION_REGISTRY`
- `SBT_FACTORY`
- `SESSION_SLUG`
- `NO_CLEANUP=1` (optional)

Optional RPC controls (UI-only):
- `E2E_PREFER_PATH_RPC=1` re-enables Pocket-first PATH ordering inside the browser. E2E defaults to disabling this so the UI
  prefers the configured `RPC_URL`/public fallbacks instead of hitting Pocket gateways first.
- `E2E_RPC_CACHE_DISABLED=1` disables the client RPC read-cache during the UI run (useful for worst-case RPC demand checks).
- `E2E_RPC_DEBUG_TRACE=1` captures stack snippets in RPC debug entries (larger reports, slower).
- `E2E_RPC_LOG_PROVIDER_SUCCESS=1` logs the serving RPC endpoint per successful call.
- Navigation smoke RPC threshold assertions (enabled by default):
  - `E2E_RPC_ASSERT_ENABLED=1|0`
  - `E2E_RPC_ASSERT_MAX_TOTAL` (default `7000`)
  - `E2E_RPC_ASSERT_MAX_ERRORS` (default `6000`)
  - `E2E_RPC_ASSERT_MAX_GETLOGS_NETWORK` (default `250`)
  - `E2E_RPC_ASSERT_MAX_ERROR_RATIO` (default `0.95`)
- Navigation smoke refresh-resume assertions (disabled by default):
  - `E2E_NAV_RESUME_ASSERT_ENABLED=1|0`
  - `E2E_NAV_RESUME_PROGRESS_BLOCKS` (checkpoint advance target before refresh; default `20000`)
  - `E2E_NAV_RESUME_TIMEOUT_MS` (wait budget for checkpoint advance; default `240000`)
  - `E2E_NAV_RESUME_POST_RELOAD_WAIT_MS` (post-refresh settle wait; default `12000`)
  - `E2E_NAV_RESUME_MIN_START_BLOCK_DELTA` (assert resumed start > baseline; default `1`)
  - `E2E_NAV_RESUME_MAX_SECOND_GETLOGS_NETWORK` (optional absolute cap)
  - `E2E_NAV_RESUME_MAX_SECOND_GETLOGS_NETWORK_DELTA` (optional cap on second-first delta)
  - `E2E_NAV_RESUME_MAX_SECOND_GETLOGS_NETWORK_RATIO` (optional cap on second/first ratio)
  - `E2E_NAV_RESUME_USE_FILTERED_GETLOGS=1|0` (optional; use filtered `eth_getLogs` counts for resume assertions instead of app-wide counts)
  - `E2E_NAV_RESUME_FILTERED_SUMMARY_KEY` (optional; defaults to `questionDiscoveryGetLogs`)

Dev/E2E UI toggles (seeded into localStorage by Playwright when enabled):
- `E2E_LIT_MOCK=0` disables Lit network mocking (E2E defaults to mocking Lit for stability; set to `0` to run against real Lit nodes).
- `E2E_NAV=1` enables the Dev/E2E nav overlay (TestID API-driven links).
- `E2E_AI_MOCK=1` enables client-side deterministic AI mocks for E2E (no network).
- `E2E_AGENT_MODE=1` enables Agent Mode (`window.__ceAgent`) for JSON-driven actions.
- `E2E_ARWEAVE_MOCK=0|1` controls whether Arweave uploads/reads are real or mocked.
  - Recommended default for `.env.e2e`: set it explicitly
  - Typical stability default: `1`
  - Use `0` when you want created sessions/questions to remain inspectable later in a normal browser.

Session slug handoff:
- Keep one slug across multiple commands with env: `SESSION_SLUG=<slug> npm run -s <command>`
- Or pass CLI overrides (take precedence over env):
  - `npm run -s ai:test-gates:any-all -- --session-slug <slug>`
  - `npm run -s ai:seed-survey:question-types -- --session-slug <slug>`
  - `npm run -s ai:test-gated-decrypt:all-types -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:session -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:session:filetypes -- --session-slug <slug>`
- When not provided, runners generate timestamped slugs that include both `runTag` and a human tag (DD-Mon-YYYY-HH-MM-AM/PM) so it is obvious which runs happened first.

Session target handoff (slug + worker URL):
- A full normal private E2E run should start by creating a fresh custom-worker session:
  `E2E_ARWEAVE_MOCK=0 npm run -s ai:test-session-setup:custom-worker-secrets`.
- Feed the resulting session target forward as a pair:
  - `SESSION_SLUG=<slug>`
  - `SESSION_WORKER_URL=<sessionCorsWorker URL>`
- Prefer the worker URL from the successful setup/suite artifact. If an older setup report has an empty `workerUrl`, read the SessionRegistry `corsWorkerUrl` field for the same slug and use that URL.
- Reuse is acceptable only for a recent successful E2E-created session target whose worker still authenticates for that exact slug. Do not pair a fresh/generated slug with a global demo/default worker.
- For `ai:test-survey-response:encryption-matrix`, set `SURVEY_RESPONSE_REUSE_SESSION_SLUG=1` or pass `--session-slug <slug>` so the response run uses the established target instead of generating a new slug.

Boundary runner mode:
- Current committed boundary-mode surface: `E2E_CHAIN_MODE=onchain|local` (`onchain` default)
- First-class `fork` orchestration is not committed yet; use the manual fork workflow above and point `RPC_URL` at your local Anvil fork when needed.

Arweave-required flows:
- `ARWEAVE_JWK_PATH` is required for doc upload/decrypt flows
- `ARWEAVE_JWK_PATH` (or `ARWEAVE_JWK_JSON` / `ARWEAVE_JWK`) is also required for session/content-producing manual-follow-up flows when `E2E_ARWEAVE_MOCK=0`, including:
  - `ai:seed-survey:question-types`
  - `ai:test-gated-decrypt:all-types`
  - `ai:test-sbt-metadata-locks`
  - `ai:test-survey-response:encryption-matrix`
  - `ai:test-survey-gated-decrypt:any-all`

## Worker URL Resolution + Bootstrap

Runners that need the CORS worker will resolve a base URL in this order:
1. CLI `--worker-url` when supported, then env `SESSION_WORKER_URL`, `SESSION_CORS_WORKER_URL`, `CE_SESSION_WORKER_BASE_URL`, `AGENT_BRIDGE_SESSION_WORKER_URL`, or `CORS_WORKER_URL`
2. Legacy env `WORKER_URL`, unless it appears to point at `agentBridgeWorker`
3. On-chain `corsWorkerUrl` from the SessionRegistry for the `SESSION_SLUG` (http/https only; non-URL strings are ignored)
4. Shared global fallback from client config (`CLOUDFLARE_CORS_WORKER_URL` in `client/src/variables/appConfig.js`, used for general/default-session fallback)

Reuse-first behavior:
- If `SESSION_WORKER_URL` is set and works for the active `SESSION_SLUG`, runners will reuse it.
- `WORKER_URL` remains a legacy session-worker alias. If it looks like an agent bridge URL, normal session-worker E2E ignores it and leaves it available as `AGENT_BRIDGE_PUBLIC_URL`.
- Set `E2E_ALLOW_WORKER_URL_AGENT_BRIDGE=1` only for explicit bridge tests that intentionally overload `WORKER_URL`.
- Keep Telegram/agent bridge endpoints in `AGENT_BRIDGE_PUBLIC_URL`; do not use them as session-worker inputs for the normal suite.
- Full encrypted/gated response runs should not rely on the shared global fallback/default demo worker. Either create a new custom-worker session target in the same run or reuse a recent E2E-created target with both `SESSION_SLUG` and `SESSION_WORKER_URL` set.

Bootstrap behavior:
- Runners probe `/auth/nonce` + `/auth/login` for the admin/holder wallet used by the flow.
- If login fails because the worker is missing per-session config, runners attempt a single best-effort `/admin/set-config` and retry login.
- If admin endpoints are disabled, the runner proceeds only if login works without bootstrapping.
- Generated fresh-session runs should not silently borrow worker config from the legacy `ai-browseruse-75209033` slug.

Allow-origins behavior:
- Default: `WORKER_ALLOW_ORIGINS_MODE=open` (do not set an allowlist)
- Strict: `WORKER_ALLOW_ORIGINS_MODE=strict` sets an allowlist derived from `BASE_URL` (plus localhost/127 variants)

Playwright launch controls (optional):
- `PLAYWRIGHT_BROWSER=chromium|firefox|webkit` (or `CE_PLAYWRIGHT_BROWSER`) chooses the browser engine for smoke/debug runs.
- `PLAYWRIGHT_VIEWPORT=desktop|mobile|tablet|<width>x<height>` (or `CE_PLAYWRIGHT_VIEWPORT`) overrides the default UI viewport across the shared Playwright helper.
- `PLAYWRIGHT_VIEWPORT_WIDTH` / `PLAYWRIGHT_VIEWPORT_HEIGHT` can override dimensions directly.
- `PLAYWRIGHT_EXECUTABLE_PATH` explicit browser binary path.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (example: `mac-arm64`) to pin host-platform resolution.
- `PLAYWRIGHT_LAUNCH_ATTEMPTS`, `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`, `PLAYWRIGHT_LAUNCH_BACKOFF_MS` for retry tuning.
- `PLAYWRIGHT_LAUNCH_STRATEGY=explicit-only|multi`.
- `PLAYWRIGHT_ALLOW_FALLBACK=1|0` (overrides strategy default).
- `PLAYWRIGHT_WS_ENDPOINT` connect-mode endpoint for a shared Chromium server (see `node scripts/start-playwright-server.js`).
- Default strategy behavior:
  - macOS arm64: `explicit-only`
  - other platforms: `multi`

## `.e2e-cache/` (Setup/Assert Split)

Some heavy runners cache setup artifacts in `.e2e-cache/` and reuse them when still valid.

Controls:
- `E2E_CACHE_DIR` (default: `.e2e-cache`)
- `E2E_FORCE_SETUP=1` (ignore cache and redo setup)
- `E2E_NO_CACHE=1` (disable cache reads/writes)
- `E2E_CACHE_TTL_HOURS` (default: `168`)

Cache validity is conservative (example checks include TTL, chainId/sessionSlug match, required IDs present, and deployed contract code existence).

## Commands

### Suite

- `npm run -s test:e2e` (public navigation/style smoke)
- `npm run -s test:e2e:quick` (alias for the same public smoke)
- `npm run -s test:e2e:quick:stability` (repeat the public smoke `E2E_STABILITY_RUNS` times; default `3`)
- `npm run -s ai:test-e2e:encryption-gates` (private core encryption/gated-decrypt suite; Playwright reuse)
- The suite runners prefer a shared Chromium server for stability and speed, but if `launchServer` fails on the host they now fall back to normal per-step browser launches instead of aborting before the first step.

Private suite flags for `scripts/run-e2e-suite.js`:
- `E2E_SUITE_PREFLIGHT_GATES=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_DOCS=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_SBT=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
  - Includes `ai:test-sbt-create:variants`, `ai:test-sbt-metadata-locks`, `ai:test-sbt-collect:variants`, and `ai:test-sbt-contract:boundaries`
- `E2E_SUITE_INCLUDE_SESSION_SETUP=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_PROFILE_SBT_MULTI=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_PROFILE_ACTIVITY_MULTI=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_ADMIN=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_AI=1 E2E_AI_MOCK=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_INCLUDE_AGENT=1 E2E_AGENT_MODE=1 E2E_AI_MOCK=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
- `E2E_SUITE_CONTINUE=1 npm run -s ai:node -- scripts/run-e2e-suite.js` (run all steps, then exit non-zero if any failed)
- Full private suites create a fresh session target by default before child steps. When `CLOUDFLARE_API_TOKEN` is set, the default fresh profile is `custom-worker-secrets-v1` so the target session gets its own worker and slug-scoped secrets. Without a token the fallback profile is `default-worker-minimal-v1`, which is only appropriate when the shared/default worker accepts the target session slug. Set `E2E_SUITE_ENSURE_SESSION=0` to skip setup, `E2E_SUITE_REUSE_SESSION_TARGET=1` to reuse `SESSION_SLUG` or the latest active target, or `E2E_SUITE_SESSION_PROFILE=...` to choose explicitly.

Manual full-session sequence:
1. Create a custom-worker session with `ai:test-session-setup:custom-worker-secrets`.
2. Resolve the session target from the setup artifact: `slug`, `adminUrl`, metadata URI, and the deployed `sessionCorsWorker` URL. If the setup artifact omits `workerUrl`, read the on-chain SessionRegistry `corsWorkerUrl` for that slug.
3. Run downstream authoring/response commands with `SESSION_SLUG=<slug>` and `SESSION_WORKER_URL=<worker-url>`.
4. For the response matrix, also set `SURVEY_RESPONSE_REUSE_SESSION_SLUG=1` unless passing `--session-slug <slug>`.

Navigation is included in the public smoke via `scripts/vite-navigation-smoke.js`.

### Session Wizard

- `npm run -s ai:test-session-setup:default-worker`
- `npm run -s ai:test-session-setup:custom-worker-secrets`
- `npm run -s ai:test-session-setup:custom-worker-no-secrets`
- `npm run -s ai:test-session-setup:sponsored-inline-sbt`

Session Wizard env contract:
- `CLOUDFLARE_API_TOKEN` is required for custom-worker deploy-helper flows
- `FAUCET_PRIVATE_KEY` or `E2E_FAUCET_PRIVATE_KEY` can prefill the faucet secret field
- `E2E_OPENAI_KEY` is required for real custom-worker deploy verification when `E2E_AI_MOCK=0`
- In mock mode (`E2E_AI_MOCK=1`, default), the runner uses a placeholder OpenAI key only to satisfy UI validation

`ai:test-session-setup:custom-worker-no-secrets` is intentionally stubbed right now:
- Flow ID: `CE-E2E-SESSION-SETUP-CUSTOM-NO-SECRETS`
- Blocker: no deterministic automated funding/provisioning path for BYOK custom worker resources
- Behavior: exits 0 and returns JSON `{ ok: true, skipped: true, ... }` so it can be left in suites without failing them.

### SBT

- `npm run -s ai:test-sbt-create:variants`
- `npm run -s ai:test-sbt-metadata-locks`
- `npm run -s ai:test-sbt-collect:variants`
- `npm run -s ai:test-sbt-contract:boundaries`
- `npm run -s ai:test-sbt:onchain:all-functions`

`ai:test-sbt-metadata-locks` covers the metadata-lock workflow:
- provisions a helper gate SBT for the holder/admin wallet
- creates a new locked SBT through the real `/sbts/<slug>` Create Group UI
- smoke-checks the Create Group lock UX (all five lock rows, session-name gate labels, successful mint)
- asserts the deployed SBT contract `name()` uses the public `CE-SBT-*` placeholder
- asserts the tokenURI metadata does not leak plaintext `name` / `description` / `tags` / `documentURLs`
- smoke-checks non-holder masked UX and holder decrypt UX on `/sbt/:address`

Arweave modes for `ai:test-sbt-metadata-locks`:
- default/stable: `E2E_ARWEAVE_MOCK=1`
- live/manual follow-up: `E2E_ARWEAVE_MOCK=0 ARWEAVE_JWK_PATH=/abs/path/to/test-jwk.json`
- live mode also expects a worker that can authenticate and upload for the chosen `SESSION_SLUG` (`SESSION_WORKER_URL=...`)

### Profile (`/u/:address`)

- `npm run -s ai:test-profile:sbt-multi-session`
- `npm run -s ai:test-profile:activity-multi-session`
- Creates fresh sessions and fresh SBT contracts, mints to one deterministic holder, then verifies that `/u/:address` renders all expected SBT names and does not show `No SBTs collected.`.
- Requires Session Wizard prerequisites (`ARWEAVE_JWK_PATH` or `ARWEAVE_JWK_JSON`/`ARWEAVE_JWK`).
- Activity scan-mode runner verifies profile deep-scan telemetry for activity-only all-session override (`useAllSessionsActivityScan=true`, `useAllSessionsSbtScan=false`) and multi-session slug fanout for the target address.

### Doc Library

- `npm run -s ai:test-doc-library:session`
- `npm run -s ai:test-doc-library:session:filetypes`
- `npm run -s ai:test-doc-library:session:multi-gate`
- `npm run -s ai:test-doc-library:url-records`

### Survey / Gated Decrypt

- `npm run -s ai:seed-survey:question-types`
- `SESSION_SLUG=<existing-session-slug> npm run -s ai:seed-polis:binary-multi-wallet`
- `npm run -s ai:test-gated-decrypt:all-types`
  - Includes submit-latch regression checks in SurveyTool (full + pile): post-success button stays submitted (not `Submit (N)`), and a second click without edits does not retrigger submit.
- `npm run -s ai:test-survey-authoring:encryption-matrix`
- `npm run -s ai:test-survey-response:encryption-matrix`
- `npm run -s ai:test-survey-gated-decrypt:any-all`
- `npm run -s ai:test-question-filter:test-4`
  - Runs deterministic API + UX assertions by default.
  - API-only (no UI server required): `npm run -s ai:test-question-filter:test-4:api`
  - UX-only: `npm run -s ai:test-question-filter:test-4:ux`

### Navigation Smoke

- `npm run -s ai:test-nav:smoke`
- `npm run -s ai:test-nav:smoke:firefox`
- `npm run -s ai:test-nav:smoke:mobile`
- Nav smoke now records and asserts RPC demand thresholds from `debug.rpc` so regressions fail deterministically.
- Optional refresh-resume probe:
  - enable with `E2E_NAV_RESUME_ASSERT_ENABLED=1`
  - writes checkpoint/start-block evidence under `debug.rpcResume` (includes
    `questionsDiscoveryCheckpointBlock`, baseline/resumed start blocks, app-wide per-pass `eth_getLogs` network counts, and filtered per-pass counts from `questionDiscoveryGetLogs`)
  - use the `E2E_NAV_RESUME_MAX_SECOND_GETLOGS_NETWORK*` envs for capped-call assertions.
  - set `E2E_NAV_RESUME_USE_FILTERED_GETLOGS=1` to apply those capped-call assertions to filtered counts.

### AI Smoke (Deterministic)

These flows are intended to run with `E2E_AI_MOCK=1` for determinism:
- `SESSION_SLUG=<existing-session-slug> npm run -s ai:test-ai:invocations`

### AI Smoke (Real Provider, Opt-in)

To verify real provider wiring (non-deterministic output, slower, can fail if your worker has no AI secrets):
- Ensure `SESSION_WORKER_URL` points at a `sessionCorsWorker` with `scopes.ai=true` and provider keys configured (or set local AI keys in the UI).
  - See: `docs/session-cors-worker.md`
- Ensure `SESSION_SLUG` points at an existing session with the expected Polis data available.
- Run without the client-side mock:
  - `SESSION_SLUG=<existing-session-slug> E2E_AI_MOCK=0 npm run -s ai:test-ai:invocations`
  - `SESSION_SLUG=<existing-session-slug> E2E_SUITE_INCLUDE_AI=1 E2E_AI_MOCK=0 npm run -s ai:node -- scripts/run-e2e-suite.js`

### Agent Mode (JSON-driven)

Agent Mode is dev/e2e-only and exposes `window.__ceAgent` when enabled.

Enable it either by:
- query param `?agent=1` (example: `/agent?agent=1`)
- or localStorage `ce-agent-enabled=1` (then reload)

Current runtime methods:
- `window.__ceAgent.getState()`
- `window.__ceAgent.describe()`
- `window.__ceAgent.perform(action)`
- `window.__ceAgent.run(actions)`

Use `window.__ceAgent.describe()` first when you want the current action/tool contract rather than guessing. It returns the supported actions, higher-level tools, activation keys, and the canonical doc paths for this surface.

Smoke runner:
- `SESSION_SLUG=<existing-session-slug> npm run -s ai:test-agent:interface`

Example JSON actions (works via `/agent` panel or `window.__ceAgent.run(...)`):
```json
[
  { "type": "navigate", "to": "/compare/" },
  { "type": "fill", "testId": "ce-compare-address-a", "value": "0x0000000000000000000000000000000000000001" },
  { "type": "fill", "testId": "ce-compare-address-b", "value": "0x0000000000000000000000000000000000000002" },
  { "type": "click", "testId": "ce-compare-run" },
  { "type": "assertVisible", "testId": "ce-compare-result" },

  { "type": "invokeAi", "tool": "PolisReport", "params": { "sessionSlug": "<existing-session-slug>" } }
]
```

### Gate Lifecycle + Worker Scopes

These are intentionally gate-modifying runners you can slot into larger sequences:
- `npm run -s ai:test-gates:any-all`
  - creates 2 fresh gate SBTs and verifies `Any` admits both distinct single-gate holders while `All` denies both single-gate holders and admits the wallet holding both.
- `npm run -s ai:test-gate-revocation:decrypt`
- `npm run -s ai:test-worker-scopes:matrix`

### Admin (`/admin`)

- `npm run -s ai:test-admin:gate-update` (updates the SessionRegistry default gate on-chain via the `/admin` UI as the admin wallet and asserts it is disabled for a non-admin wallet)

Optional suite preflight:
- `E2E_SUITE_PREFLIGHT_GATES=1 npm run -s ai:node -- scripts/run-e2e-suite.js`
  - runs `ai:test-gates:any-all` before the 3-flow encryption-gates suite.

## Artifacts

Each runner writes:
- JSON report: `artifacts/session-workflows/<flow>-<runTag>.json`
- Screenshot: `artifacts/screenshots/<flow>-<runTag>.png`
- Error screenshot (UI failures): `artifacts/screenshots/<flow>-<runTag>-error.png`

The private suite runner (`npm run -s ai:node -- scripts/run-e2e-suite.js`) also writes a suite-level report:
- `artifacts/e2e-suites/e2e-suite-<runTag>.json`

RPC measurement fields:
- Per-flow JSON reports now include:
  - `debug.rpc` (scan summary; totals/method counts/getLogs block-range groups)
  - `debug.rpcByFilter` (optional filtered scan summaries when a flow requests them)
  - `debug.rpcSnapshot` (raw method/outcome snapshot)
  - `debug.rpcLegacy` (`window.__RPC_STATS__` high-level counters)
- Suite report includes:
  - `steps[].rpc` (per-step extracted summary, when available)
  - `rpc` (aggregated totals across steps with metrics)

Quick checks:
- Per flow:
  - `jq '.debug.rpc.totals, .debug.rpc.methods.eth_getLogs, .debug.rpc.getLogs.uniqueRanges' artifacts/session-workflows/<flow>-<runTag>.json`
- Suite aggregate:
  - `jq '.rpc.totals, .rpc.methods.eth_getLogs, .rpc.stepsMissingMetrics' artifacts/e2e-suites/e2e-suite-<runTag>.json`

Standardized report top-level keys:
- `flowId`
- `runner`
- `createdAt`
- `runTag`
- `chain`
- `inputs`
- `contracts`
- `wallets`
- `steps`
- `assertions`
- `cleanup`
- `outputs`
