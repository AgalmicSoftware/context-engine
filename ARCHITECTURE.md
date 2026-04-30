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

See [PRD 045](TODO/PRDs/045_corporate-private-deployment.md) for the corporate deployment roadmap.

## Layer Descriptions

| Layer | What it does | Primary location |
|-------|-------------|-----------------|
| **Client** | React SPA: survey authoring, response collection, SBT management, encryption gates, admin, session wizard | `client/src/` |
| **CORS Worker** | Cloudflare Worker: SIWE auth, AI proxy, Arweave uploads, transcription, faucet, resource gating via on-chain gates | `workers/sessionCorsWorker/` |
| **Contracts** | Solidity on any EVM chain: session registry (gates + metadata pointers), surveys (hash anchoring), SBTs (membership tokens), factory | `contracts/` |
| **Arweave** | Immutable JSON storage: session metadata, survey/question payloads, SBT tokenURI, doc library files | N/A (external) |
| **Lit Protocol** | Client-side encrypt/decrypt with SBT-gated access control conditions (ACC) | N/A (external SDK) |

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
- [`docs/porto-information.md`](docs/porto-information.md) — Porto passkey wallet
- [`docs/local-chain.md`](docs/local-chain.md) — Local Anvil development
- [`CLAUDE.md`](CLAUDE.md) — AI agent workflow and conventions
