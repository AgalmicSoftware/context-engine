# E2E Testing Reference

Moved from root README.md for readability.

The stripped `release-public` OSS copy intentionally omits the private repo-level E2E workflow entrypoints under `scripts/test-*.js`, `scripts/test-*.ui.js`, and `scripts/lib/e2e/`. Use the detailed workflow references below with the full dev repo or a restored private pack, not the stripped public release artifact.

The maintained public smoke path is Vite-compatible and runs against an already running client:

- Start the client from `client/`: `npm run dev`
- Run desktop route/style smoke from the repo root: `BASE_URL=http://127.0.0.1:3000 npm run test:e2e`
- Run the same smoke at the mobile viewport: `BASE_URL=http://127.0.0.1:3000 npm run ai:test-nav:smoke:mobile`

`test:e2e` and `test:e2e:quick` intentionally point at this public smoke runner in stripped checkouts. The private encryption/gating runners remain documented below for full dev environments.

## AI Wallet Test Workflow (OP Sepolia)

Use these scripts for repeatable blockchain testing from the same deterministic
passkey EOA-style test wallet.

- Show the derived wallet address (and optional balance/hash info):
  - `npm run ai:wallet`
- Dry-run SBT mint (estimates gas, checks funds, does not send):
  - `npm run ai:mint-test-sbt:dry`
- Send real test SBT create tx:
  - `npm run ai:mint-test-sbt`
- Build a full all-path UX workflow run bundle (session setup, SBT create/collect,
  survey authoring/response) with versioned non-identifying fixtures:
  - `npm run ai:ux-workflows`
  - Output: `artifacts/session-workflows/ux-runs/<run-tag>/summary.json`
- Include deterministic chain context (wallet + dry-run SBT create):
  - `npm run ai:ux-workflows:chain-dry`
- Include deterministic chain context and send a real create tx:
  - `npm run ai:ux-workflows:chain-live`
- End-to-end SessionRegistry gate verification (2 SBTs, 2 wallets, OR/AND behavior) against the worker `/auth/login` path:
  - `SESSION_WORKER_URL=https://<your-sessionCorsWorker>.workers.dev npm run ai:test-gates:any-all`
  - Output: `artifacts/session-workflows/gate-any-all-<slug>.json`
- Seed a survey via UI automation (Playwright) with coverage for all core question types:
  - binary, rating, multichoice (multi-select), multichoice (single-select), freeform
  - `npm run ai:seed-survey:question-types`
  - Output:
    - `artifacts/session-workflows/survey-question-types-<run-tag>.json`
    - `artifacts/screenshots/survey-question-types-<run-tag>.png`
- Seed Polis-style binary questions + multi-wallet responses (deterministic wallets A-E):
  - `SESSION_SLUG=<existing-session-slug> npm run ai:seed-polis:binary-multi-wallet`
  - Output:
    - `artifacts/session-workflows/polis-binary-multi-wallet-<run-tag>.json`
- End-to-end gated decrypt verification (SBT-gated question prompts/tags + encrypted responses) across all question types:
  - `npm run ai:test-gated-decrypt:all-types`
  - Also asserts post-submit SurveyTool UX latch behavior (full + pile): no `Submit (N)` after success, and no re-submit on second click without edits.
  - Output:
    - `artifacts/session-workflows/gated-decrypt-all-types-<run-tag>.json`
    - `artifacts/screenshots/gated-decrypt-all-types-<run-tag>.png`
- Expanded CE E2E backlog coverage runners:
  - PRD 648 close-out smokes:
    - `BASE_URL=http://127.0.0.1:3000 npm run ai:test-prd648:telegram-client`
    - `BASE_URL=http://127.0.0.1:3000 npm run ai:test-prd648:new-mode`
    - `BASE_URL=http://127.0.0.1:3000 npm run ai:test-prd648:session-demo`
    - `BASE_URL=http://127.0.0.1:3000 npm run ai:test-prd648:closeout-smoke`
  - PRD 649/650 Cloudflare storage, envelope encryption, and worker groups:
    - `npm run ai:test-prd649:worker-envelope`
    - `npm run ai:test-prd650:worker-groups`
    - `npm run ai:test-prd649-650:group-envelope`
    - `npm run ai:test-prd649:key-lifecycle`
    - `npm run ai:test-cf-envelope:all`
    - These live suites deploy a dedicated session worker through the same deploy helper used by `/new`, pass a Cloudflare `storageProfile`, register a non-identifying test session on the configured SessionRegistry, and then exercise worker routes against the fresh worker.
    - Assertions cover `/new` worker-envelope selectability, `worker_envelope` ciphertext-only storage/export, admin envelope export, worker group CRUD and visibility, `group_gate`, `group_allowlist`, `worker_group` conditions, removal/deletion revocation, envelope rotation, deployment-KEK rewrap, and no plaintext marker leakage in denied/export responses.
  - Session setup:
    - `npm run ai:test-session-setup:default-worker`
    - `npm run ai:test-session-setup:custom-worker-secrets`
    - `npm run ai:test-session-setup:custom-worker-no-secrets` (intentional stub for now)
    - `npm run ai:test-session-setup:sponsored-inline-sbt`
  - SBT:
    - `npm run ai:test-sbt-create:variants`
    - `npm run ai:test-sbt-collect:variants`
    - `npm run ai:test-sbt-contract:boundaries`
    - `npm run ai:test-sbt:onchain:all-functions`
    - `npm run ai:test-profile:sbt-multi-session`
    - `npm run ai:test-profile:activity-multi-session`
  - Docs:
    - `SESSION_SLUG=<existing-session-slug> npm run ai:test-doc-library:session:multi-gate`
    - `SESSION_SLUG=<existing-session-slug> npm run ai:test-doc-library:url-records`
    - `npm run ai:test-tool-explorer:doc-save`
  - Surveys/gated decrypt:
    - `npm run ai:test-survey-authoring:encryption-matrix`
    - `npm run ai:test-survey-response:encryption-matrix`
    - `npm run ai:test-survey-gated-decrypt:any-all`
    - `npm run ai:test-question-filter:test-4`
      - Runs API + UX phases by default (`TEST4_RUN_API=1`, `TEST4_RUN_UI=1`)
      - API-only: `npm run ai:test-question-filter:test-4:api`
      - UX-only: `npm run ai:test-question-filter:test-4:ux`
  - Admin:
    - `npm run ai:test-admin:gate-update`
- Gate lifecycle + worker scope:
  - `SESSION_SLUG=<existing-session-slug> npm run ai:test-gate-revocation:decrypt`
  - `SESSION_SLUG=<existing-session-slug> npm run ai:test-worker-scopes:matrix`

### E2E env file (recommended)

For repeatable runs across machines, keep E2E configuration in a local file:

1. `cp .env.e2e.example .env.e2e`
2. Fill common values:
   - `RPC_URL`
   - `ARWEAVE_JWK_PATH` for Arweave/doc/manual-follow-up flows
   - For fresh full private runs, set `CLOUDFLARE_API_TOKEN` and let session setup create the session worker URL
   - For reuse-only runs, set both `SESSION_SLUG` and `SESSION_WORKER_URL` from a recent successful E2E session setup
3. Run any `ai:*` command normally (scripts auto-load `.env.e2e.local`, then `.env.e2e`).

For OP Sepolia on-chain runs, the built-in fallback is the first public RPC from the shared manifest. Set `RPC_URL` to your own reliable endpoint for longer E2E or seed runs because public RPCs can rate-limit or time out.

Override env-file path when needed:

- `E2E_ENV_FILE=/abs/path/to/custom.env npm run ai:test-survey-response:encryption-matrix`

The example includes deterministic test wallet fixture addresses (derived from passkey fixtures):
- wallet A: `0x1E9a72A127dAB666fd47dFAFAe15CCd9e08505eE`
- wallet B: `0x00f78571FfcEF1D74BFF37705cbC6aaB6747A255`
- wallet C: `0x2DF08cBf5d092c6A723Ca698f44317232EB6546b`
- wallet D: `0x9c568865a326e4637c5A8884CcA60F6521541410`
- wallet E: `0x9543FBD63eaa632D492E8F8bc4eCeE4f6A08b008`

Environment variables supported by `ai:mint-test-sbt`:

- `RPC_URL` (default: OP Sepolia public RPC)
- `SBT_FACTORY` (default: `0x8CBeE1EE46603b446b499cb32F63fa9860a50478`)
- `GROUP_PASSWORD` (default: `browserUse`)
- `SBT_METADATA_URI` (required tokenURI metadata location; accepts `ar://<txId>`, Arweave gateway URL, or raw txId and normalizes to `ar://`)
- `E2E_SBT_METADATA_URI` (optional alias used by profile-driven E2E scripts; `ai:mint-test-sbt` still prefers `SBT_METADATA_URI`)
- `AI_TEST_PRIVATE_KEY` (optional override; otherwise derived through the passkey-derived mock PRF/HKDF path)
- `PASSKEY_RAW_ID_B64URL` (optional deterministic fixture credential ID used to mock passkey PRF output)
- `DRY_RUN=1` (enabled via `ai:mint-test-sbt:dry`)

Environment variables supported by `ai:test-gates:any-all`:

- `SESSION_WORKER_URL` (optional; legacy `WORKER_URL` is accepted only when it does not look like `agentBridgeWorker`; otherwise defaults to SessionRegistry `corsWorkerUrl` for the slug if set, then `CLOUDFLARE_CORS_WORKER_URL` from `client/src/variables/appConfig.js`)
- `RPC_URL` (default: OP Sepolia public RPC)
- `CHAIN_ID` (default: `11155420`)
- `SESSION_REGISTRY` (default: OP Sepolia SessionRegistry)
- `SBT_FACTORY` (default: OP Sepolia SBTFactory)
- `PASSKEY_A` and `PASSKEY_B` (deterministic fixture credential IDs used to mock passkey PRF output)
- `SESSION_SLUG` (optional explicit slug; default is `e2e-gates-<timestamp>`)
- `FUND_WALLET_B` (ETH amount transferred from walletA to walletB if walletB is empty)
- `METADATA_URI` (string stored in `createSession`; gates do not depend on it)
- `GATE_SET_RETRY_ATTEMPTS`, `GATE_SET_RETRY_DELAY_MS` (optional retries for `setResourceGate` when RPC read-after-write is lagging)
- `GATE_LOGIN_RETRY_ATTEMPTS`, `GATE_LOGIN_RETRY_DELAY_MS` (optional retries for worker `/auth/login` assertions)

Environment variables supported by `ai:seed-survey:question-types`:

- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `CHAIN` / `CHAIN_ID` (optional shared chain selector; defaults to the app default chain, currently OP Sepolia `11155420`)
- `RPC_URL` (optional browser rewrite target / preferred RPC override for the resolved chain)
- `RPC_REWRITE_FROM` (optional advanced comma-separated override for rewrite sources; otherwise derived from the resolved chain's public, PATH, and faucet fallback RPC defaults)
- `AI_RUN_TAG` / `RUN_TAG` (optional explicit run tag; default is timestamp)
- `PASSKEY_RAW_ID_B64URL` (optional deterministic fixture credential ID used to mock passkey PRF output)
- `PLAYWRIGHT_CORE_PATH` (optional override for resolving the Playwright module)
- `PLAYWRIGHT_EXECUTABLE_PATH` (optional override for Chromium; defaults to Playwright-managed Chromium)
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (optional; e.g. `mac-arm64` to force arm64 browser resolution)
- `PLAYWRIGHT_LAUNCH_ATTEMPTS`, `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`, `PLAYWRIGHT_LAUNCH_BACKOFF_MS` (optional launch retry tuning)
- `PLAYWRIGHT_LAUNCH_STRATEGY` (`explicit-only|multi`; default is `explicit-only` on macOS arm64, `multi` elsewhere)
- `PLAYWRIGHT_ALLOW_FALLBACK=1|0` (optional explicit override for fallback behavior)

Environment variables supported by `ai:seed-polis:binary-multi-wallet`:

- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `SESSION_SLUG` (required; existing session slug)
- `AI_RUN_TAG` / `RUN_TAG` (optional explicit run tag; default is timestamp)
- `BINARY_QUESTION_COUNT` (default: `4`; range `1..12`)
- `PASSKEY_A`, `PASSKEY_B`, `PASSKEY_C`, `PASSKEY_D`, `PASSKEY_E` (deterministic fixture credential IDs used to mock passkey PRF output)
- `FUND_AMOUNT_ETH` (default `0.001`; walletA -> walletB/C/D/E top-up amount when recipients are under threshold)
- `MIN_BALANCE_ETH` (default `0.0002`; recipient balance threshold for top-up checks)

Environment variables supported by `ai:test-gated-decrypt:all-types`:

- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `SESSION_SLUG` (optional explicit slug; when unset, the runner generates a fresh timestamped slug)
- `RPC_URL`, `CHAIN_ID`, `SESSION_REGISTRY`, `SBT_FACTORY` (OP Sepolia defaults)
- `PASSKEY_A` and `PASSKEY_B` (deterministic fixture credential IDs used to mock passkey PRF output)
- `SESSION_WORKER_URL` (optional override; legacy `WORKER_URL` is accepted only for sessionCorsWorker URLs; by default read from on-chain `corsWorkerUrl`)
- `FUND_WALLET_B` (ETH amount transferred from walletA to walletB if walletB is empty)
- `PLAYWRIGHT_CORE_PATH` and `PLAYWRIGHT_EXECUTABLE_PATH` (optional UI phase overrides)
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (optional; e.g. `mac-arm64` to force arm64 browser resolution)
- `PLAYWRIGHT_LAUNCH_ATTEMPTS`, `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`, `PLAYWRIGHT_LAUNCH_BACKOFF_MS` (optional launch retry tuning)
- `PLAYWRIGHT_LAUNCH_STRATEGY` (`explicit-only|multi`; default is `explicit-only` on macOS arm64, `multi` elsewhere)
- `PLAYWRIGHT_ALLOW_FALLBACK=1|0` (optional explicit override for fallback behavior)
- `SKIP_UI=1` (run only the chain/worker gate + scope checks)
- `SKIP_AI_SMOKE=1` (skip the worker `/ai` negative-gate probe)

Environment variables supported by `ai:ux-workflows`:

- `AI_RUN_TAG` (optional explicit run tag; default is timestamp)
- `AI_WORKFLOW_OUTPUT_DIR` (optional output root)
- `AI_INCLUDE_CHAIN=1` (run wallet + mint smoke section)
- `AI_LIVE_CHAIN=1` (when chain section is enabled, send real `createSBT` tx)
- `AI_WALLET_ADDRESS` (optional override for SBT-collect fixtures)
- `AI_SBT_ADDRESS` (optional override for SBT-collect fixtures)
- `AI_SURVEY_ID` (optional target survey id for response fixtures)

Environment variables used by the new CE E2E runners:

- `AI_RUN_TAG`, `BASE_URL`, `CHAIN_ID`, `RPC_URL`, `SESSION_REGISTRY`, `SBT_FACTORY`, `SESSION_SLUG`, `NO_CLEANUP=1`
- Current committed boundary-mode surface: `E2E_CHAIN_MODE=onchain|local` (used by `ai:test-sbt-contract:boundaries`, default `onchain`)
- Manual fork workaround: start a local Anvil fork yourself, point `RPC_URL` at it, and keep `CHAIN` / `CHAIN_ID` / contract overrides aligned to the upstream chain
- First-class `E2E_CHAIN_MODE=fork` orchestration is not yet in the committed runners; track that follow-up in private planning.
- `ARWEAVE_JWK_PATH` (required for doc upload/decrypt flows)

Session slug handoff options:

- Use env for cross-command reuse: `SESSION_SLUG=<slug> npm run -s <command>`
- Or pass CLI overrides (CLI wins over env) on these scripts:
  - `npm run -s ai:test-gates:any-all -- --session-slug <slug>`
  - `npm run -s ai:seed-survey:question-types -- --session-slug <slug>`
  - `npm run -s ai:seed-polis:binary-multi-wallet -- --session-slug <slug>`
  - `npm run -s ai:test-ai:invocations -- --session-slug <slug>`
  - `npm run -s ai:test-agent:interface -- --session-slug <slug>`
  - `npm run -s ai:test-gated-decrypt:all-types -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:session -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:session:filetypes -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:session:multi-gate -- --session-slug <slug>`
  - `npm run -s ai:test-doc-library:url-records -- --session-slug <slug>`
  - `npm run -s ai:test-gate-revocation:decrypt -- --session-slug <slug>`
  - `npm run -s ai:test-worker-scopes:matrix -- --session-slug <slug>`

Full-session worker handoff:

- Fresh full E2E runs should generate their own worker URL by starting with `npm run -s ai:test-session-setup:custom-worker-secrets`.
- Feed both values from that successful setup into later steps:
  - `SESSION_SLUG=<slug>`
  - `SESSION_WORKER_URL=<sessionCorsWorker URL>`
- If the setup artifact does not include `workerUrl`, read the on-chain SessionRegistry `corsWorkerUrl` for that slug and use that worker URL.
- Reuse an existing worker only when it came from a recent successful E2E session setup and still authenticates for the same `SESSION_SLUG`.
- For `ai:test-survey-response:encryption-matrix`, set `SURVEY_RESPONSE_REUSE_SESSION_SLUG=1` or pass `--session-slug <slug>`; otherwise the runner may generate a fresh slug instead of using the established worker-backed session.
- Do not use the shared demo/default worker as the worker URL for a newly generated full response run unless that worker was explicitly established for the same slug.

Useful env vars for `ai:wallet`:

- `SHOW_PRIVATE_KEY=1` to include the deterministic private key and local-only
  passkey EOA fixture material for automation seeding.
