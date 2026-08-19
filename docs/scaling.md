# Scaling

Context Engine separates four choices that older deployment descriptions often
collapsed together: where the web app is hosted, whether a session is public or
private, which infrastructure profile owns the session, and which scaling
techniques that profile uses. Hosting the static client does not determine the
session's authority, storage, access policy, or settlement path.

## Current Implemented Profiles

The `/new` chooser opens with no preset automatically selected. Its default and
recommended path is **Hosted & Fast**, labeled `Centralized (Cloudflare)` in
the wizard. **Trustless & Slower**, labeled
`Decentralized (Arweave + EVM)`, is an implemented opt-in path. Advanced
per-axis changes are recorded as `Custom`.

| Profile | Availability | Canonical authority and storage | Creator setup | Chain requirement |
| --- | --- | --- | --- | --- |
| Hosted & Fast | Implemented; default path | Creator-owned per-session Cloudflare Worker, Worker KV/Cloudflare payload storage, `worker_canonical` authority, and `worker_envelope` encryption by default | Cloudflare API token and one AI-provider key | None by default; the passkey-derived EOA signs worker config without submitting a transaction |
| Trustless & Slower | Implemented; opt-in | Public EVM registry/contracts and Arweave | Wallet transaction, gas, RPC access, Arweave JWK, and one AI-provider key | Required; Lit credentials are required only when Lit encryption is selected |
| Company-Operated | Planned; not generally available | Intended organizational IAM, key-release/KMS, storage, AI gateway, networking, and observability adapters | To be defined by the operator's environment | Not required by the architecture; an entirely off-chain deployment is a target, while a private EVM could only be an optional future adapter |

Creators need deployment credentials only while provisioning infrastructure.
Participants joining or using an existing session never need the creator's
Cloudflare token, AI key, Arweave key, or other deployer credentials.

## Write Path

The current default write path is worker-canonical. The browser signs the
canonical session config with the passkey-derived admin EOA, then the
per-session worker persists config and payloads through Cloudflare storage.
There is no public-chain settlement, registry transaction, RPC dependency, gas
payment, or Arweave upload on that default path.

The decentralized profile keeps the public settlement path: metadata and
payloads are written to Arweave, while session registration, gates, and other
selected actions settle synchronously through public EVM contracts. This path
remains supported; it is profile-specific rather than universal.

Future scaling mechanisms remain optional architecture choices:

| Write mode | Status | Trust and cost shape | Intended use |
| --- | --- | --- | --- |
| Worker-canonical Cloudflare | Implemented default | Creator/operator and Cloudflare runtime trust; no per-action gas | Hosted & Fast sessions |
| Public EVM + synchronous settlement | Implemented opt-in | Public-chain settlement and gas | Trustless & Slower sessions |
| Worker intake + periodic public anchor | Planned | Off-chain acceptance with later public checkpoints | Selected hosted/public use cases |
| Private PoA EVM | Possible future adapter, not a requirement | Operator-run chain | Organizations that explicitly choose EVM compatibility |
| Application rollup, async, or batch settlement | Planned research/scale target | Sequencer or gateway trust varies by design | Future high-volume public deployments |

`sync`, `async`, `batch`, and `periodic-anchor` describe settlement timing.
`direct`, `worker`, and `sequencer` describe who accepts a write. They are
building blocks, not a mandatory progression from public EVM to private EVM.

## Read Path

Hosted & Fast reads canonical session config and payload indexes from the
session worker and its Cloudflare bindings. Small payload envelopes can use the
KV-only fallback; an existing R2 bucket is an explicit advanced option rather
than a default requirement.

Trustless & Slower currently reads registry/contracts through RPC and resolves
Arweave-backed metadata and payloads. Repeated raw RPC scans do not scale, so an
open-source index follower remains a useful planned optimization for this
profile. The proposed follower would normalize on-chain state and Arweave
references into Postgres or SQLite read models. A Cloudflare Lite mirror using
Workers with D1 and optional R2 is also planned; neither follower package is a
generally available release yet.

Company-Operated targets organization-owned storage and query adapters. Those
adapters may serve entirely off-chain state; they do not require an EVM follower
or an Arweave mirror.

## Encryption and Private Compute

`worker_envelope` is the Hosted & Fast default. It encrypts payloads at rest in
the session-worker trust domain and releases them according to worker-evaluated
roles or conditions. The operator and Cloudflare runtime remain inside that
trust boundary.

The stock Trustless & Slower profile defaults to no payload encryption. Lit is
an implemented opt-in when public-chain access conditions and client-side
decrypt are desired; selecting it adds Lit and chain/RPC requirements.

Company-Operated encryption and private compute remain planned. Intended
adapters include passkey-backed or organizational identity, KMS/Vault/OpenBao
key release, and later TEE or threshold services. These are target directions,
not shipped packages.

| Mode | Availability | Trust model | Best fit |
| --- | --- | --- | --- |
| `worker_envelope` | Implemented default for Hosted & Fast | Session operator and Cloudflare worker runtime | Cloudflare-backed private sessions |
| `lit` | Implemented opt-in | Public Lit network plus selected EVM access conditions | Decentralized gated data |
| `none` | Implemented; decentralized preset default | Storage visibility and session policy | Intentionally public data |
| Organizational KMS/key release | Planned | Customer IAM and key-service policy | Company-operated environments |
| TEE or permissioned threshold compute | Planned research | Attested operator or permissioned threshold trust | Advanced private query and compute |

### Planned Private Query Capability

Private-query controls remain useful future scaling semantics, but none is a
generally available packaged service today:

- `off` disables private query.
- `metadata-only` indexes ciphertext and public metadata without private-field
  access.
- `authorized-search` would let a trusted or attested adapter search private
  fields for authorized callers.
- `authorized-aggregation` would let such an adapter produce authorized private
  summaries, filters, and analytics.

These capabilities can sit behind Company-Operated adapters or other future
private-compute services. They do not require a public or private EVM.

## Profile-Specific Scaling

- Hosted & Fast scales first through per-session worker isolation, Cloudflare KV
  and optional R2, then future shared-worker/index services if they ship.
- Trustless & Slower scales read fanout through followers and caches while
  preserving public EVM and Arweave as its authority and durable-storage path.
- Company-Operated is intended to scale through organization-selected IAM,
  storage, AI, networking, key-release, and observability adapters. A private
  EVM or rollup is optional, never foundational.

## Related

- [Architecture overview](architecture-overview.md)
- [Session creation guide](session-creation-guide.md#session-creation-walkthrough)
- [Cloudflare worker reference](session-cors-worker.md)
- [Top-level architecture](../ARCHITECTURE.md)
- [Public roadmap](../ROADMAP.md)
