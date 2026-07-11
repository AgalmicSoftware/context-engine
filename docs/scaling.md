# Scaling

Context Engine is designed to scale from small community sessions to large enterprise and hosted deployments by separating write-path settlement, read-path indexing, encryption/private-compute backends, and deployment profile defaults.

## Current Default

The current default is a public EVM deployment on OP Sepolia with synchronous writes, Arweave storage, optional Lit Protocol encryption, and direct RPC reads. This is the simplest and most trust-minimized operating mode. It supports hundreds to low thousands of concurrent participants per session.

Unless a mode is explicitly labeled available below, it describes a target architecture rather than a turnkey released deployment. In particular, company-operated private-chain, Postgres/SQLite follower, Local Key Release, and app-rollup profiles are still in development or planned.

## Write Path

Chain execution defines where writes land. `public-evm` writes directly to a public EVM chain. `private-poa` writes to an operator-run EVM network for lower cost and higher throughput. `app-rollup` writes first to an application-specific sequencer or rollup, with final settlement handled separately.

Settlement defines when an action is treated as complete. `sync` waits for canonical submission and receipt. `async` accepts a signed intent or job and settles it later. `batch` groups multiple writes before submission. `periodic-anchor` accepts state off-chain first and anchors checkpoints on a schedule.

Write gateway defines who accepts the write. `direct` sends writes from browser or wallet to the execution layer. `worker` accepts signed payloads and settles them through an API or queue. `sequencer` accepts ordered intents and commits them to the underlying execution layer.

The planned escalation path is `public-evm + sync` first, then `private-poa + sync`, then async or batch settlement where product semantics allow it, then `app-rollup` for the highest-scale hosted path.

| Mode | Throughput potential | Trust model | Cost profile | Best for |
|---|---|---|---|---|
| `public-evm + sync` | lowest | strongest public-chain default | highest per write | OSS/public default |
| `private-poa + sync` | high | operator-run chain | low marginal write cost | planned enterprise/self-hosted CE |
| `public-evm + async` | modest improvement | gateway or sequencer adds trust | gas still public | planned hosted public deployments |
| `private-poa + batch` | very high | operator-run chain plus queue or sequencer | low | planned large enterprise/private communities |
| `app-rollup + sync` | high | sequencer trust or permissioned trust | medium | planned high-scale hosted CE |

## Read Path

Repeated RPC reads do not scale. Recomputing logs, gate checks, and page hydration in many browsers and worker requests creates unnecessary fanout and latency.

The target scaling model is an open-source index follower that normalizes on-chain state plus Arweave-backed metadata and payload references into queryable read models. The follower would build that state once and serve browsers, workers, and read APIs from indexed tables instead of repeated raw RPC scans.

The planned follower has two deployment forms. `Follower Core` is the target self-hosted canonical deployment, backed by Postgres or SQLite. `Cloudflare Lite mirror` is the lighter shared or sponsored target using Cloudflare Workers with D1 and optional R2 mirrors. Neither should be read as a generally available turnkey follower package yet. Gate snapshots are optional and come later: worker auth should remain live and on-chain authoritative until read parity is stable.

## Encryption and Private Compute

Encryption backend defines key custody and the decrypt control plane. `lit-public` is the default public path. For enterprise/private deployments, the V1 direction is **Local Key Release** plus client-side crypto: strict passkey-private mode where WebAuthn PRF is available, and KMS/Vault/OpenBao-backed release where a conventional enterprise trust model is acceptable. A vendor-backed Lit cluster is only a later research option if licensing, private-chain support, offline behavior, SDK semantics, and deployment guidance are written down. `tee` moves decrypt authority behind attested enclave-backed services for later advanced workloads. `threshold-private` is the later permissioned threshold path.

Private compute mode defines where gated decrypt and protected computation run. `client` is the default and keeps decrypt on the user device. `tee` enables authorized server-side compute inside enclaves. `threshold` is the later networked private-compute path.

Private query capability defines what indexed systems may do with protected data. `off` disables private query. `metadata-only` indexes ciphertext and public metadata only. `authorized-search` allows trusted or attested backends to search private fields for authorized callers. `authorized-aggregation` allows private summaries, filters, and analytics for authorized callers.

| Mode | Trust model | Scale benefit | Best for | Feasibility |
|---|---|---|---|---|
| `lit-public` | public Lit network | baseline | public OSS/default | already shipped |
| `key-release-passkey-private` | passkey-sealed user keys plus Local Key Release policy service | strong normal-path user privacy when WebAuthn PRF works | enterprise/private V1 strict mode | high after adapter work |
| `key-release-kms` | customer KMS/Vault/OpenBao trust plus Local Key Release policy checks | modest, supportable | enterprise/private V1 compatibility mode | high |
| `vendor-backed-lit-cluster` | Lit-style threshold crypto operated under explicit vendor terms | moderate decrypt throughput and availability gain | later advanced option only if vendor-backed | deferred |
| `tee` | enclave-backed operator infra | high for private query, decrypt, and search | advanced enterprise/private workloads | medium |
| `local-kms` | trusted operator | modest | simple enterprise install / compatibility mode | high |
| `aws-kms` | AWS-managed HSM trust | modest | AWS-native enterprise | high |
| `threshold-private` | permissioned threshold trust | potentially high, especially with private query | maximally decentralized private compute | low/medium initially |

## Deployment Profiles

The profile names below describe architecture targets; they are not literal current configuration identifiers. The current session wizard offers `Fast & Cheap (Cloudflare)` and `Trustless & Public (Decentralized)` as its two initial presets, then records Advanced per-axis changes as `Custom`. See the [session creation guide](session-creation-guide.md#session-creation-walkthrough) for the implemented choices. Planned rows describe intended packaging and must not be presented as installable releases yet.

| Profile | Availability | Audience | Read path | Write path | Encryption / private compute | Hosting style |
|---|---|---|---|---|---|---|
| `oss-default` | Conceptual name; current public reference path exists | OSS users, small communities | direct RPC reads | public sync | optional `lit-public`, client decrypt | simple public deploy |
| `sponsored-cloudflare` | Partial: worker and sponsorship building blocks exist; packaged Lite mirror remains planned | maintainer-run shared sessions | current worker-backed reads; Lite mirror remains planned | public sync or supported worker intake | optional `lit-public`; Local Key Release only for future private profiles | Cloudflare-first |
| `enterprise-private` | Planned; design work underway | self-hosted orgs / regulated installs | planned full OSS follower core | planned private PoA sync or batch | planned key-release passkey-private or KMS/Vault/OpenBao compatibility; TEE later | Docker, VPC, or on-prem |
| `max-scale-rollup` | Planned | future hosted large-scale CE | planned full follower core plus specialized read APIs | app rollup plus batch or async settlement | `tee` or future `threshold-private` | serious hosted infra |

The intended profile sequences are `oss-default -> sponsored-cloudflare -> max-scale-rollup` for public deployments and `oss-default -> enterprise-private` for company-operated deployments. These are roadmap sequences, not automatic or currently turnkey migrations.

## Related

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [spec.md](../spec.md)
- Internal planning notes cover implementation detail for these scaling layers.
