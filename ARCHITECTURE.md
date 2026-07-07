# Context Engine — Architecture

> Single-page system overview. For detailed specs see [`spec.md`](spec.md) and [`docs/`](docs/README.md).

## System Diagram

### Public / Decentralized Deployment (current)

```
                              ┌──────────────────────────────┐
                              │    EVM Chain (configurable)   │
                              │    Optimism / Base / etc.     │
                              │                              │
                              │  SessionRegistry  ◄── gates  │
                              │  Surveys          ◄── hashes │
                              │  CustomSBT        ◄── tokens │
                              │  SBTFactory       ◄── deploy │
                              └──────────┬───────────────────┘
                                         │ ethers.js
┌────────────────────┐          ┌────────┴─────────┐
│     Arweave        │◄─────────┤   React SPA      │
│                    │  upload   │   (client/)      │
│  session metadata  │          │                  │
│  survey payloads   │  read    │  Redux + hooks   │
│  question content  │─────────▸│  managed cache   │
│  SBT tokenURI     │          │  (IDB + LS fb)   │
│  doc library       │          └──┬──────┬────────┘
└────────────────────┘             │      │
                                   │      │ fetch + auth token
                          Lit SDK  │      │
                    ┌──────────────┘      │
                    ▼                     ▼
          ┌─────────────────┐   ┌─────────────────────────┐
          │  Lit Protocol   │   │  CORS Worker (CF)       │
          │                 │   │  sessionCorsWorker      │
          │  encrypt/decrypt│   │                         │
          │  SBT-gated ACC  │   │  /auth/nonce + /login   │
          └─────────────────┘   │  /ai  /transcribe       │
                                │  /arweave/upload         │
          ┌─────────────────┐   │  /admin/set-config      │
          │ contextEngine-cc│   │  request_test_eth        │
          │ (Claude Code)   │   │  fetch_url / fetch_image│
          │                 │   │                         │
          │ hook + passkey  │   │  KV: config + secrets   │
          │ terminal survey │   └─────────────────────────┘
          └─────────────────┘
```

### Corporate / Private Deployment (planned)

```
                              ┌──────────────────────────────┐
                              │    Local PoA Chain            │
                              │    (private EVM network)      │
                              │                              │
                              │  SessionRegistry  ◄── gates  │
                              │  Surveys          ◄── hashes │
                              │  CustomSBT        ◄── tokens │
                              │  SBTFactory       ◄── deploy │
                              └──────────┬───────────────────┘
                                         │ ethers.js
┌────────────────────┐          ┌────────┴─────────┐
│  Private Storage   │◄─────────┤   React SPA      │
│  (pluggable)       │  write    │   (client/)      │
│                    │          │                  │
│  SQLite / Postgres │  read    │  Same UI + Redux │
│  or S3 / MinIO     │─────────▸│  private session │
│                    │          │  source adapters │
│  same JSON shapes  │          └──┬──────┬────────┘
└────────────────────┘             │      │
                                   │      │ fetch + auth token
               ┌───────────────────┘      │
               ▼                          │
     ┌─────────────────┐                  │
     │  Local Encryption│                  │
     │  (pluggable)     │                  │
     │                  │                  │
     │  Option A: key   │                  │
     │    server (AES)  │                  │
     │  Option B: TEE / │                  │
     │    SGX enclave   │                  │
     │  Option C: AWS   │                  │
     │    KMS           │                  │
     └─────────────────┘                  ▼
                                ┌─────────────────────────┐
                                │  CORS Worker             │
                                │  (self-hosted Docker)    │
                                │                         │
                                │  same endpoints          │
                                │  storage: DB/S3 adapter  │
                                │  secrets: local config   │
                                └─────────────────────────┘
```

Key difference from public mode: planned private deployments swap public registry-backed session reads for private session-source adapters (for example a local DB) while keeping the same auth-capable worker surface. The `/new` wizard writes session configs to that private backend instead of relying on public registry lookups. Same UI, same contracts, different storage + encryption backends.

The corporate deployment roadmap remains in private planning until the public deployment mode is ready to document here.

## Layer Descriptions

| Layer | What it does | Primary location |
|-------|-------------|-----------------|
| **Client** | React SPA: survey authoring, response collection, SBT management, encryption gates, admin, session wizard | `client/src/` |
| **CORS Worker** | Cloudflare Worker: SIWE auth, AI proxy, Arweave uploads, transcription, faucet, resource gating via on-chain gates | `workers/sessionCorsWorker/` |
| **Contracts** | Solidity on any EVM chain: session registry (gates + metadata pointers), surveys (hash anchoring), SBTs (membership tokens), factory | `contracts/` |
| **Arweave** | Immutable JSON storage: session metadata, survey/question payloads, SBT tokenURI, doc library files | N/A (external) |
| **Lit Protocol** | Client-side encrypt/decrypt with SBT-gated access control conditions (ACC) | N/A (external SDK) |
| **contextEngine-cc** | Claude Code extension: passkey auth, terminal-based survey UX via hook protocol | `contextEngine-cc/` |

## Data Flows

### 1. Session Creation (`/session/new`)
```
Wizard UI  ──▸  Deploy worker (via deploy-helper)
           ──▸  Upload metadata JSON to Arweave (optionally Lit-encrypted fields)
           ──▸  SessionRegistry.createSession(slug, sessionId, chainId, metadataURI)
           ──▸  SessionRegistry.setSessionFields(slug, [corsWorkerUrl, sponsored_*])
           ──▸  SessionRegistry.setResourceGates(slug, gates[])
           ──▸  Worker /admin/set-config + /admin/set-secrets (signed, no token)
```

Sponsored bootstrap deploys now target the sponsoring `sessionCorsWorker` first:

```
Browser  ──▸  source sessionCorsWorker /sponsored/redeem-deploy
         ──▸  embedded deploy-helper core inside source worker
         ──▸  fallback standalone deploy-helper only if embedded deploy is disabled or retryable failure occurs
```

### 2. Survey Response
```
User submits ──▸  Client encrypts fields (Lit, if gated)
             ──▸  Worker /arweave/upload (auth token) ──▸ Arweave tx
             ──▸  Surveys.submitResponses(questionIds, hashes) on-chain
```

### 3. SBT Mint
```
User claims ──▸  CustomSBT.mint() / .claimWithPassword() / .claimWithSignature()
            ──▸  Token metadata stored on Arweave (via SBTFactory or direct)
```

### 4. Gate Check (Worker Login)
```
Client ──▸  POST /auth/nonce { address, sessionSlug }
       ──▸  Sign SIWE message
       ──▸  POST /auth/login { address, message, signature, sessionSlug }
              Worker reads SessionRegistry.getResourceGate() per resource
              Worker checks CustomSBT.balanceOf() for each gate SBT
              Returns { token, exp } with scoped access (ai, arweave, transcribe, faucet, fetch)
```

### 5. Encryption / Gated Decrypt
```
Encrypt:  Client ──▸ Lit SDK encrypt(data, SBT access conditions) ──▸ Arweave (encrypted payload)
Decrypt:  Client ──▸ Lit SDK decrypt(payload) ──▸ Lit nodes verify SBT ownership ──▸ plaintext
```

## Corpus Data

- `ai-discourse-corpus/` is a tracked top-level dataset with reusable JSON sub-corpuses covering AI policy, safety research, technical evaluations, science fiction, debates, practitioner interviews, and enriched social-media discourse.
- The corpus is kept outside the client so it can be versioned and reused independently of the client demo runtime.

## Key File Map

### Client (`client/src/`)

| Area | Files |
|------|-------|
| Entry / routing | `components/MainSite/AppShell.tsx` |
| Home tab shell | `components/MainContent/MainAreaTabs.tsx`, `ToolExplorer.tsx`, `OnboardingWalkthrough.tsx` |
| Account / login settings | `components/Account/LoginAndSettingsModal.tsx`, `LoginButton.tsx` |
| Session wizard | `components/Sessions/SessionWizard.tsx` |
| Session page shell | `components/OnePageSession/OnePageSession.tsx` |
| Demo-only views | `components/DemoViews/DemosIndex.tsx`, `RiskMatrixDemo.tsx`, `CorpusViewer.tsx`, `components/DemoViews/DemoAnalysis/`, `components/DemoViews/DebateHUD/` |
| Document library | `components/DocumentLibrary/SessionDocumentsPage.tsx`, `DocumentLibraryPanel.tsx` |
| Admin | `components/Admin/AdminPage.tsx` |
| About page | `components/About/AboutPage.tsx` |
| Survey tool | `components/SurveyTool/SurveyTool.tsx`, `CreateQuestionsAndSurveys.tsx`, `SurveyResults.tsx` |
| Shared UI | `components/Shared/AudioInput/AudioInput.tsx`, `components/Shared/Json/JsonControls.tsx`, `components/Shared/Json/JsonDisplay.tsx` |
| SBT management | `components/SBTs/SBTsList.tsx`, `SBTPage.tsx`, `CreateSBTGroup.tsx` |
| Gate components | `components/Gates/` |
| **Utilities** | |
| Web3 / contracts | `utilities/web3/chainGateway.ts`, `contractScripts.impl.ts`, `contractHelpers.ts`, `chainEventStreams.ts`, `profileChainReads.ts`, `sessionRegistry.ts` |
| Wallet | `client/src/wallet/` passkey EOA wallet config, encrypted keystore, EIP-1193 provider, and soft-session worker |
| Crypto / Lit | `utilities/crypto/litProtocol.js`, `cryptography.js`, `encryptedFields.js` |
| Arweave | `utilities/arweave/arweaveClient.js`, `arweaveUrls.js` |
| Session helpers | `utilities/session/sessionNaming.js`, `sessionMetadata.js`, `resourceKeys.js`, `sessionModeProfile.ts`, `sessionBackendKind.ts`, `agentClientLogin.ts`, `telegramAgentData.ts`, `telegramSessionBackend.ts` |
| Worker auth | `utilities/worker/workerAuth.js`, `corsProxy.js` |
| Cache | `utilities/cache/cacheScripts.js`, `storageManager.js` |
| AI | `utilities/ai/aiClient.js`, `aiSettings.js` |
| Survey logic | `utilities/survey/questionRouting.js`, `filterStateUtils.js`, `compareUsers.js` |
| **Config / variables** | |
| Feature flags | `variables/appConfig.js` |
| Chain config | `variables/chains.js` |
| Session fallback | `variables/demo/demo_sessions.json` |

### Contracts (`contracts/`)

| Contract | Purpose |
|----------|---------|
| `SessionRegistry.sol` | Session registry, resource gates (Any/All SBT rules), metadata URI pointers |
| `Surveys.sol` | Survey/question registration and response hash anchoring |
| `CustomSBT.sol` | Non-transferable ERC-721 (SBT) with ERC-5192 / ERC-5484-aligned lock + burn-auth surfaces, password/invite/signature mint paths, `SBTActivity` history events, and `getHistorySummary()` for count-only reads. Transfers, approvals, and `safeTransferFrom` revert with `Soulbound()`. |
| `SBTFactory.sol` | Deploys new CustomSBT instances (optionally deterministic via CREATE2) |

### Workers (`workers/`)

| Worker | Purpose |
|--------|---------|
| `sessionCorsWorker/worker.js` | Multi-tenant CORS proxy: auth, AI, Arweave, transcription, faucet |
| `deploy-helper/worker.js` | One-click worker deployment from the session wizard |

### E2E Tests (`scripts/`)

| Script pattern | What it tests |
|----------------|--------------|
| `test-*.ui.js` | Playwright-based E2E automation |

## Contract Addresses

Contracts are chain-agnostic EVM Solidity. Deployments are configured per chain in `client/src/variables/chains.js` (`SESSION_REGISTRY_ADDRESSES`, `SESSION_CONTRACTS_BY_CHAIN`).

| Chain | SessionRegistry | Surveys | SBTFactory |
|-------|----------------|---------|------------|
| OP Sepolia (11155420) | `0xDcB1731984E9F75c6a061c38dD8b67d18De4C0c1` | `0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A` | `0x8CBeE1EE46603b446b499cb32F63fa9860a50478` |
| Base Sepolia (84532) | `0xD55Aa8fb29964d034d59B90DFFD23790f7B34B00` | `0xcccb5c1a96b3e10f395e318ae75db24e45bd3808` | `0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA` |

CustomSBT instances are deployed per-group via SBTFactory.

The current OP Sepolia `SBTFactory` default above was deployed in tx
`0x57b91018ed6b93f64c83d5a44bfb9d0be1920f96929ecc045aa3946ba7cc917e`.

The legacy Base Sepolia `SBTFactory` default above was deployed in tx
`0x4a0428a0fe6d6090fd6112885ea46b30ff84a1a551d0806c0f9afda4b44a5f21`.

To add a new chain: deploy contracts, add entries to `SESSION_REGISTRY_ADDRESSES` and `SESSION_CONTRACTS_BY_CHAIN` in `chains.js`, and add the chain definition to the chain registry.

### Address Discovery

Contract address discovery is currently file-based rather than on-chain.
`client/src/variables/chains.js` imports the base deployment map from `contracts.json`.
`SESSION_REGISTRY_ADDRESSES` maps each supported chain ID to its `SessionRegistry` address.
`SESSION_CONTRACTS_BY_CHAIN` provides the per-chain contract configuration used by the SPA.
That bundle includes addresses such as `SessionRegistry`, `Surveys`, and `SBTFactory`.
For local development, `local-contracts.json` can override the checked-in defaults.
Those local overrides are merged into both exported maps before the client reads them.
This is the current source of truth for contract lookup in the client.
There is no dynamic production discovery step today.
The planned future path is ENS-based discovery via `<chainId>.contracts.contextengine.eth`.
That ENS lookup is not implemented yet.

## Auth Model

```
┌──────────┐    1. POST /auth/nonce        ┌───────────────────┐
│  Client   │──────────────────────────────▸│   CORS Worker     │
│  (wallet) │                               │                   │
│           │◄──────────────────────────────│   returns nonce   │
│           │    nonce                       │                   │
│           │                               │                   │
│           │    2. Sign SIWE message        │                   │
│           │       (personal_sign)          │                   │
│           │                               │                   │
│           │    3. POST /auth/login         │   Verify sig      │
│           │──────────────────────────────▸│   Check gates:    │
│           │    { address, message,         │     SessionRegistry│
│           │      signature, sessionSlug }  │     .getResourceGate()
│           │                               │     CustomSBT     │
│           │◄──────────────────────────────│     .balanceOf()  │
│           │    { token, exp }              │                   │
│           │                               │   Mint token:     │
│           │    4. Authenticated requests   │   { sub, slug,    │
│           │    Authorization: Bearer <tok> │     scopes, exp } │
│           │──────────────────────────────▸│   HMAC-signed     │
└──────────┘                               └───────────────────┘

Token format: base64url(payload) + "." + base64url(hmac(payload))
Scopes: ai, arweave, transcribe, faucet, fetch
TTL: 24 hours
```

## Session Config Data Shape

Session config lives in three places with different authority:

| Store | Authority | Shape docs |
|-------|-----------|-----------|
| **SessionRegistry** (on-chain) | Gates, metadata URI, admin, sponsored flags | [`docs/session-registry.md`](docs/session-registry.md) |
| **Arweave metadata** | Content, UI defaults, contracts, encryption envelopes | [`docs/session-registry.md` §Arweave](docs/session-registry.md) |
| **Worker KV** (`session:{slug}:config`) | Operational config, scopes, limits | [`docs/session-cors-worker.md`](docs/session-cors-worker.md) |
| **Worker KV** (`session:{slug}:secrets`) | API keys, Arweave JWK, faucet key | [`docs/session-cors-worker.md`](docs/session-cors-worker.md) |

See [`docs/session-registry.md`](docs/session-registry.md) for the full Arweave metadata schema (v1) and [`docs/session-cors-worker.md`](docs/session-cors-worker.md) for the Worker KV layout.

## Storage Model

```
On-chain (authoritative)        Arweave (durable content)       Worker KV (operational)
───────────────────────         ─────────────────────────       ──────────────────────
SessionRegistry                 Session metadata JSON           session:{slug}:config
  sessionId, slug, chainId        slug, sessionName, ai,         registryAddress, rpcUrl,
  metadataURI → Arweave            contracts, blockLimits,        scopes, limits,
  admin address                     encryptedFields,               allowOrigins
  resource gates (Any/All)          contentEncryption            session:{slug}:secrets
  sponsored_* flags               Survey/question payloads        openaiKey, anthropicKey,
Surveys                           SBT tokenURI metadata           arweaveJwk, faucetKey
  question/survey hashes          Doc library files
CustomSBT
  token ownership (balanceOf)   Browser managed cache
SBTFactory                      ────────────────────────────
  deploys CustomSBT instances   dg:sbtCache:{slug}
                                dg:surveysCache:{slug}
                                dg:questionsCache:{slug}
                                dg:bookmarksCache:{slug}
                                dg:filters:{slug}
                                dg:userCache:{slug}
```

## Further Reading

- [`spec.md`](spec.md) — Full feature specification
- [`docs/session-registry.md`](docs/session-registry.md) — On-chain registry + Arweave metadata schema
- [`docs/session-cors-worker.md`](docs/session-cors-worker.md) — Worker endpoints, KV layout, auth flow
- [`docs/arweave-payloads.md`](docs/arweave-payloads.md) — Arweave payload shapes
- [`docs/path-rpc.md`](docs/path-rpc.md) — PATH/provider ordering and overrides
- [`docs/rpc-scan-scope.md`](docs/rpc-scan-scope.md) — scan-scope and profile-scan guardrails
- [`docs/cache/README.md`](docs/cache/README.md) — managed cache backend + namespace guide
- [`docs/lit-protocol-information.md`](docs/lit-protocol-information.md) — Lit Protocol integration
- [`docs/resource-keys.md`](docs/resource-keys.md) — Resource key resolution
- [`docs/passkey-wallet.md`](docs/passkey-wallet.md) — passkey EOA wallet
- [`docs/forking-wallet.md`](docs/forking-wallet.md) — fork-owned RP ID setup
- [`docs/security-model.md`](docs/security-model.md) — embedded wallet security model
- [`docs/local-chain.md`](docs/local-chain.md) — Local Anvil development
