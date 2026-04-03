# Scaling

Context Engine is designed to scale from small community sessions to large enterprise and hosted deployments by separating write-path settlement, read-path indexing, encryption/private-compute backends, and deployment profile defaults.

## Current Default

The current default is a public EVM deployment on OP Sepolia with synchronous writes, Arweave storage, Lit Protocol encryption, and direct RPC reads. This is the simplest and most trust-minimized operating mode. It supports hundreds to low thousands of concurrent participants per session.

## Write Path

Chain execution defines where writes land. `public-evm` writes directly to a public EVM chain. `private-poa` writes to an operator-run EVM network for lower cost and higher throughput. `app-rollup` writes first to an application-specific sequencer or rollup, with final settlement handled separately.

Settlement defines when an action is treated as complete. `sync` waits for canonical submission and receipt. `async` accepts a signed intent or job and settles it later. `batch` groups multiple writes before submission. `periodic-anchor` accepts state off-chain first and anchors checkpoints on a schedule.

Write gateway defines who accepts the write. `direct` sends writes from browser or wallet to the execution layer. `worker` accepts signed payloads and settles them through an API or queue. `sequencer` accepts ordered intents and commits them to the underlying execution layer.

The recommended escalation path is `public-evm + sync` first, then `private-poa + sync`, then async or batch settlement where product semantics allow it, then `app-rollup` for the highest-scale hosted path.

| Mode | Throughput potential | Trust model | Cost profile | Best for |
|---|---|---|---|---|
| `public-evm + sync` | lowest | strongest public-chain default | highest per write | OSS/public default |
| `private-poa + sync` | high | operator-run chain | low marginal write cost | enterprise/self-hosted CE |
| `public-evm + async` | modest improvement | gateway or sequencer adds trust | gas still public | hosted public deployments |
| `private-poa + batch` | very high | operator-run chain plus queue or sequencer | low | large enterprise/private communities |
| `app-rollup + sync` | high | sequencer trust or permissioned trust | medium | serious hosted CE |

## Read Path

Repeated RPC reads do not scale. Recomputing logs, gate checks, and page hydration in many browsers and worker requests creates unnecessary fanout and latency.

The scaling model is an open-source index follower that normalizes on-chain state plus Arweave-backed metadata and payload references into queryable read models. The follower builds that state once and serves browsers, workers, and read APIs from indexed tables instead of repeated raw RPC scans.

The follower has two deployment forms. `Follower Core` is the self-hosted canonical deployment, backed by Postgres or SQLite. `Cloudflare Lite mirror` is a lighter shared or sponsored deployment using Cloudflare Workers with D1 and optional R2 mirrors. Gate snapshots are optional and come later: worker auth should remain live and on-chain authoritative until read parity is stable.

## Encryption and Private Compute

Encryption backend defines key custody and the decrypt control plane. `lit-public` is the default public path. `lit-private` keeps the Lit threshold model on private infrastructure. `tee` moves decrypt authority behind attested enclave-backed services. `local-kms` and `aws-kms` are simpler trusted-operator custody modes. `threshold-private` is the later permissioned threshold path.

Private compute mode defines where gated decrypt and protected computation run. `client` is the default and keeps decrypt on the user device. `tee` enables authorized server-side compute inside enclaves. `threshold` is the later networked private-compute path.

Private query capability defines what indexed systems may do with protected data. `off` disables private query. `metadata-only` indexes ciphertext and public metadata only. `authorized-search` allows trusted or attested backends to search private fields for authorized callers. `authorized-aggregation` allows private summaries, filters, and analytics for authorized callers.

| Mode | Trust model | Scale benefit | Best for | Feasibility |
|---|---|---|---|---|
| `lit-public` | public Lit network | baseline | public OSS/default | already shipped |
| `lit-private` | threshold crypto on private infra | moderate decrypt throughput and availability gain | private hosted CE with minimal app changes | high |
| `tee` | enclave-backed operator infra | high for private query, decrypt, and search | enterprise/private deployments and high-scale private compute | high |
| `local-kms` | trusted operator | modest | simple enterprise install | high |
| `aws-kms` | AWS-managed HSM trust | modest | AWS-native enterprise | high |
| `threshold-private` | permissioned threshold trust | potentially high, especially with private query | maximally decentralized private compute | low/medium initially |

## Deployment Profiles

Deployment profiles package the scaling layers into named defaults. They are presets, not hard locks: operators can start from a coherent profile and override lower-level infrastructure choices as needed.

| Profile | Audience | Read path | Write path | Encryption / private compute | Hosting style |
|---|---|---|---|---|---|
| `oss-default` | OSS users, small communities | RPC or optional indexed-lite | public sync | `lit-public`, client decrypt | simple public deploy |
| `sponsored-cloudflare` | maintainer-run shared sessions | Cloudflare Lite mirror | public sync or light async intake | `lit-public` now, `lit-private` optional later | Cloudflare-first |
| `enterprise-private` | self-hosted orgs / regulated installs | full OSS follower core | private PoA sync or batch | `tee`, `local-kms`, `aws-kms`, or `lit-private` | Docker, VPC, or on-prem |
| `max-scale-rollup` | future hosted large-scale CE | full follower core plus specialized read APIs | app rollup plus batch or async settlement | `tee` or future `threshold-private` | serious hosted infra |

Migration paths are straightforward. Public deployments move `oss-default -> sponsored-cloudflare -> max-scale-rollup`. Private deployments move `oss-default -> enterprise-private`.

## Related

- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [spec.md](../spec.md)
- PRDs 277-280 in [`TODO/PRDs/`](../TODO/PRDs/) contain implementation detail for these scaling layers.
