# Porto Passkey Wallet - Setup and Networks

This note documents how the Porto passkey wallet is wired in the app, where
the chain configuration lives, and which networks Porto currently supports.

## Where it lives in this repo

- `client/src/utilities/web3/portoFunctions.ts` handles WebAuthn registration/login,
  session storage, and the viem wallet client used for Porto transactions.
- `client/src/components/Account/LoginAndSettingsModal.tsx` wires Porto login/logout,
  restores sessions on load, and syncs Porto to the active group network.
- `client/src/variables/chains.js` defines chain profiles, Porto relay URLs,
  and Porto-specific metadata (fee tokens and interop support).
- `client/src/variables/appConfig.js` contains `PORTO_SESSION_KEY_ENABLED`.

## Passkey flow (high level)

1. User clicks Porto sign up or sign in.
2. WebAuthn creates or retrieves a credential (passkey).
3. A deterministic private key is derived and wrapped by a WebAuthn-backed key.
4. The session is stored in IndexedDB with AES-GCM encryption; there is a
   localStorage fallback for environments without IndexedDB/WebCrypto.
5. `restoreSession()` rehydrates the session on page load.

## Deterministic AI test wallet workflow

For CI-style/manual automation, this repo now includes deterministic wallet
helpers that emulate a stable Porto passkey raw credential id.

Scripts:

- `npm run ai:wallet`
  - Derives and prints the deterministic test wallet address from
    `PASSKEY_RAW_ID_B64URL` (default fixture value).
  - Prints OP Sepolia balance when `RPC_URL` is reachable.
  - With `SHOW_PRIVATE_KEY=1`, also prints a legacy `porto_session_v1` payload
    usable for automation/localStorage seeding.
- `npm run ai:mint-test-sbt:dry`
  - Estimates gas and checks funds for `SBTFactory.createSBT` without sending.
- `npm run ai:mint-test-sbt`
  - Sends a real OP Sepolia `createSBT` tx from the deterministic wallet.
  - Prints tx hash, deployed SBT address, metadata verification, and one-click
    local session URL with encoded group password.
- `npm run ai:ux-workflows`
  - One-command workflow bundle generator for all new UX paths:
    session setup, SBT create, SBT collect, survey authoring, and survey
    response.
  - Generates versioned non-identifying run manifests under
    `artifacts/session-workflows/ux-runs/<run-tag>/`.
- `npm run ai:ux-workflows:chain-dry`
  - Same as above plus deterministic chain context (`ai:wallet` + dry-run mint).
- `npm run ai:ux-workflows:chain-live`
  - Same as above plus deterministic chain context with a live mint tx.
- `npm run ai:test-gates:any-all`
  - Creates 2 deterministic wallets and 2 fresh SBT contracts, then registers a new
    SessionRegistry session and verifies `Any (OR)` and `All (AND)` gate behavior
    by calling the worker `/auth/login` endpoint for wallets holding 1 vs 2 SBTs.
  - Requires `WORKER_URL` pointing to a sessionCorsWorker deployment that supports
    `/admin/set-config` bootstrap (shared workers may not allow this).
- `npm run ai:seed-survey:question-types`
  - UI automation routine (Playwright) that creates a survey containing one question of
    each core type: binary, rating, multichoice (multi-select), multichoice (single-select),
    and freeform.
  - Saves a JSON run report under `artifacts/session-workflows/` and a screenshot under
    `artifacts/screenshots/`.
- `npm run ai:seed-polis:binary-multi-wallet`
  - Seeds Polis-style binary data for one existing session slug:
    - creates standalone binary questions,
    - funds deterministic wallets B/C/D/E from walletA when needed,
    - submits yes/no-style responses from deterministic wallets A-E.
  - Saves a JSON run report under `artifacts/session-workflows/`.
- `npm run ai:test-gated-decrypt:all-types`
  - End-to-end OP Sepolia verification that SBT gates control decrypt access for:
    question prompts, question tags, encrypted response answers, and encrypted additional
    comments across all core question types.
  - Creates 2 deterministic wallets, mints a fresh SBT to walletA only, applies session
    gates (`questionResponses` + `ai`) for an existing session slug, then uses UI automation
    to author questions and submit/decrypt responses.
- Expanded CE E2E matrix runners:
  - Session setup:
    - `npm run ai:test-session-setup:default-worker`
    - `npm run ai:test-session-setup:custom-worker-secrets`
    - `npm run ai:test-session-setup:custom-worker-no-secrets` (intentional stub)
  - SBT:
    - `npm run ai:test-sbt-create:variants`
    - `npm run ai:test-sbt-collect:variants`
    - `npm run ai:test-sbt-contract:boundaries`
  - Docs:
    - `npm run ai:test-doc-library:session:multi-gate`
    - `npm run ai:test-doc-library:url-records`
  - Surveys/gates:
    - `npm run ai:test-survey-authoring:encryption-matrix`
    - `npm run ai:test-survey-response:encryption-matrix`
    - `npm run ai:test-survey-gated-decrypt:any-all`
    - `npm run ai:test-gate-revocation:decrypt`
    - `npm run ai:test-worker-scopes:matrix`

Key env vars for minting:

- `SBT_FACTORY` (optional override; otherwise resolved from shared E2E chain defaults via `resolveChainDefaults()`)
- `GROUP_PASSWORD` (default `browserUse`)
- `SBT_METADATA_URI` (required tokenURI metadata location; accepts `ar://<txId>`, Arweave gateway URL, or raw txId and normalizes to `ar://`)
- `E2E_SBT_METADATA_URI` (optional alias used by profile-driven E2E scripts; falls back to `SBT_METADATA_URI`)
- `AI_TEST_PRIVATE_KEY` (optional explicit key override)
- `PASSKEY_RAW_ID_B64URL` (deterministic rawId source)
- `RPC_URL` / `CHAIN_ID` / `CHAIN` (optional overrides; otherwise resolved from shared E2E chain defaults)
- `DRY_RUN=1` (already set by `ai:mint-test-sbt:dry`)

Deterministic passkey fixture defaults used across E2E runners:

- `PASSKEY_A=AQIDBAUGBwgJCgsMDQ4PEA` -> `0x1E9a72A127dAB666fd47dFAFAe15CCd9e08505eE`
- `PASSKEY_B=EBESExQVFhcYGRobHB0eHw` -> `0x00f78571FfcEF1D74BFF37705cbC6aaB6747A255`
- `PASSKEY_C=ICEiIyQlJicoKSorLC0uLw` -> `0x2DF08cBf5d092c6A723Ca698f44317232EB6546b`
- `PASSKEY_D=MDEyMzQ1Njc4OTo7PD0-Pw` -> `0x9c568865a326e4637c5A8884CcA60F6521541410`
- `PASSKEY_E=QEFCQ0RFRkdISUpLTE1OTw` -> `0x9543FBD63eaa632D492E8F8bc4eCeE4f6A08b008`

Key env vars for `ai:test-gates:any-all`:

- `WORKER_URL` (required in practice)
- `PASSKEY_A`, `PASSKEY_B` (wallet raw ids; defaults are fixture values)
- `SESSION_SLUG` (optional explicit slug)
- `FUND_WALLET_B` (optional funding amount)
- `GATE_SET_RETRY_ATTEMPTS`, `GATE_SET_RETRY_DELAY_MS` (optional retries for `setResourceGate` when RPC read-after-write is lagging)
- `GATE_LOGIN_RETRY_ATTEMPTS`, `GATE_LOGIN_RETRY_DELAY_MS` (optional retries for worker `/auth/login` assertions)

Key env vars for `ai:seed-survey:question-types`:

- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `CHAIN` / `CHAIN_ID` (optional shared chain selector; defaults to the app default chain, currently OP Sepolia `11155420`)
- `RPC_URL` (optional browser rewrite target / preferred RPC override for the resolved chain)
- `RPC_REWRITE_FROM` (optional advanced comma-separated override for rewrite sources; otherwise derived from the resolved chain's public, PATH, and faucet fallback RPC defaults)
- `AI_RUN_TAG` / `RUN_TAG` (optional explicit run tag; default is timestamp)
- `PASSKEY_RAW_ID_B64URL` (optional deterministic rawId source, default fixture value)
- `PLAYWRIGHT_CORE_PATH` (optional override for locating `playwright-core`)
- `PLAYWRIGHT_EXECUTABLE_PATH` (optional override for Chromium)
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (optional; e.g. `mac-arm64` to force arm64 browser resolution)
- `PLAYWRIGHT_LAUNCH_ATTEMPTS`, `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`, `PLAYWRIGHT_LAUNCH_BACKOFF_MS` (optional launch retry tuning)
- `PLAYWRIGHT_LAUNCH_STRATEGY` (`explicit-only|multi`; default `explicit-only` on macOS arm64, `multi` elsewhere)
- `PLAYWRIGHT_ALLOW_FALLBACK=1|0` (optional explicit override for fallback behavior)

Key env vars for `ai:seed-polis:binary-multi-wallet`:

- `SESSION_SLUG` (required; existing session slug)
- `BINARY_QUESTION_COUNT` (default `4`)
- `PASSKEY_A`, `PASSKEY_B`, `PASSKEY_C`, `PASSKEY_D`, `PASSKEY_E`
- `FUND_AMOUNT_ETH` (default `0.001`)
- `MIN_BALANCE_ETH` (default `0.0002`)

Key env vars for `ai:test-gated-decrypt:all-types`:

- `BASE_URL` (default: `http://127.0.0.1:3000`)
- `SESSION_SLUG` (optional explicit slug; when unset, the runner generates a fresh timestamped slug)
- `WORKER_URL` (optional override; otherwise pulled from on-chain `corsWorkerUrl`)
- `PASSKEY_A`, `PASSKEY_B` (wallet raw ids; defaults are fixture values)
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (optional; e.g. `mac-arm64` to force arm64 browser resolution)
- `PLAYWRIGHT_LAUNCH_ATTEMPTS`, `PLAYWRIGHT_LAUNCH_TIMEOUT_MS`, `PLAYWRIGHT_LAUNCH_BACKOFF_MS` (optional launch retry tuning)
- `PLAYWRIGHT_LAUNCH_STRATEGY` (`explicit-only|multi`; default `explicit-only` on macOS arm64, `multi` elsewhere)
- `PLAYWRIGHT_ALLOW_FALLBACK=1|0` (optional explicit override for fallback behavior)
- `SKIP_UI=1` (skip the Playwright phase)
- `SKIP_AI_SMOKE=1` (skip the worker `/ai` negative-gate probe)

Workflow-runner env vars:

- `AI_RUN_TAG` (optional run label)
- `AI_WORKFLOW_OUTPUT_DIR` (optional output root)
- `AI_INCLUDE_CHAIN=1` (include wallet + mint section)
- `AI_LIVE_CHAIN=1` (live tx mode when chain section is enabled)
- `AI_WALLET_ADDRESS` (optional fixture override)
- `AI_SBT_ADDRESS` (optional fixture override)
- `AI_SURVEY_ID` (optional survey target override)

Common env vars for the new CE E2E runners:

- `AI_RUN_TAG`, `BASE_URL`, `CHAIN_ID`, `RPC_URL`, `SESSION_REGISTRY`, `SBT_FACTORY`, `SESSION_SLUG`, `NO_CLEANUP=1`
- Current committed boundary-mode surface: `E2E_CHAIN_MODE=onchain|local` (used by `ai:test-sbt-contract:boundaries`)
- Manual fork workaround: start a local Anvil fork yourself, point `RPC_URL` at it, and keep `CHAIN` / `CHAIN_ID` / contract overrides aligned to the upstream chain
- First-class `E2E_CHAIN_MODE=fork` orchestration is tracked in [PRD 236](../TODO/PRDs/236_e2e-first-class-local-fork-mode.md)
- `ARWEAVE_JWK_PATH` required for doc upload/decrypt flows
- `.env.e2e` / `.env.e2e.local` are auto-loaded by `ai:*` scripts (copy from `.env.e2e.example`)
- `E2E_ENV_FILE=/abs/path/to/custom.env` can override the auto-discovery path
- committed E2E scripts do not read fallback secrets from `.e2e-secrets/*`

### Session key mode

- `PORTO_SESSION_KEY_ENABLED = true` allows silent signing after one
  verification (session key mode).
- When disabled, the user must verify via passkey for each signing operation.
- Automatic decrypt flows only treat Porto as non-interactive after session-key
  mode has an in-memory signer. A passive page-load restore hydrates the
  address for reads but does not unlock signing, so gated prompts stay masked
  until the user explicitly decrypts or signs in with an unlocked session.

## Chain selection (Porto sidecar)

Porto uses the active group network as its chain source:

- `getGroupNetwork()` resolves the chain from group config.
- `LoginAndSettingsModal.tsx` calls `setPortoChain()` with that chain.
- `portoFunctions.ts` creates a viem wallet client using the resolved chain
  and `getPortoRelayUrl()` from `chains.js`.

To add or change Porto RPCs, edit:
- `portoRelayUrlRegistry` in `client/src/variables/chains.js`
- `rpcUrls.public` and `rpcUrls.default` for the chain entry

Note: Porto uses explicit relay URLs and avoids PATH defaults to keep wallet send-tx behavior stable.
Avoid Pocket/PATH public endpoints for Porto relay when possible; they have proven incompatible with Porto wallet send-tx flows in practice.

## Porto supported networks

The following list is sourced from Porto's published network support table.
Fee tokens are accepted for execution fees; interop tokens are supported for
cross-chain relay.

| Network | Chain ID | Fee Token Support | Interop Support |
| --- | --- | --- | --- |
| Base | 8453 | ETH, USDC, USDT | ETH, USDC, USDT |
| Optimism | 10 | ETH, USDC, USDT | ETH, USDC, USDT |
| Arbitrum | 42161 | ETH, USDC, USDT | ETH, USDC, USDT |
| Ethereum | 1 | ETH, USDC, USDT | ETH, USDC, USDT |
| Celo | 42220 | CELO, USDC, USDT | USDC, USDT |
| BNB Chain | 56 | BNB, USDT | none |
| Polygon | 137 | POL, USDC, USDT | USDC, USDT |
| Katana | 747474 | ETH | none |
| Base Sepolia | 84532 | tETH, EXP1, EXP2 | tETH, EXP1, EXP2 |
| Optimism Sepolia | 11155420 | tETH, EXP1, EXP2 | tETH, EXP1, EXP2 |
| Arbitrum Sepolia | 421614 | tETH | none |

## Adding a new network

1. Add a chain definition in `client/src/variables/chains.js`.
2. Add the chain to `chainRegistry`.
3. Add a relay URL in `portoRelayUrlRegistry` (or ensure `rpcUrls` is set).
4. Add Porto metadata (`porto.feeTokens`, `porto.interopTokens`).
