# Scaling

Context Engine separates four choices that older deployment descriptions often
collapsed together: where the web app is hosted, whether a session is public or
private, which infrastructure profile owns the session, and which scaling
techniques that profile uses. Hosting the static client does not determine the
session's authority, storage, access policy, or settlement path.

## Current Implemented Profiles

The current default is a public EVM deployment on OP Sepolia with synchronous writes, Arweave storage, optional Lit Protocol encryption, and direct RPC reads. This is the simplest and most trust-minimized operating mode. It supports hundreds to low thousands of concurrent participants per session.

Unless a mode is explicitly labeled available below, it describes a target architecture rather than a turnkey released deployment. In particular, company-operated private-chain, Postgres/SQLite follower, Local Key Release, and app-rollup profiles are still in development or planned.

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

The planned escalation path is `public-evm + sync` first, then `private-poa + sync`, then async or batch settlement where product semantics allow it, then `app-rollup` for the highest-scale hosted path.

| Mode | Throughput potential | Trust model | Cost profile | Best for |
|---|---|---|---|---|
| `public-evm + sync` | lowest | strongest public-chain default | highest per write | OSS/public default |
| `private-poa + sync` | high | operator-run chain | low marginal write cost | planned enterprise/self-hosted CE |
| `public-evm + async` | modest improvement | gateway or sequencer adds trust | gas still public | planned hosted public deployments |
| `private-poa + batch` | very high | operator-run chain plus queue or sequencer | low | planned large enterprise/private communities |
| `app-rollup + sync` | high | sequencer trust or permissioned trust | medium | planned high-scale hosted CE |

## Read Path

Hosted & Fast reads canonical session config and payload indexes from the
session worker and its Cloudflare bindings. Small payload envelopes can use the
KV-only fallback; an existing R2 bucket is an explicit advanced option rather
than a default requirement.

The target scaling model is an open-source index follower that normalizes on-chain state plus Arweave-backed metadata and payload references into queryable read models. The follower would build that state once and serve browsers, workers, and read APIs from indexed tables instead of repeated raw RPC scans.

The planned follower has two deployment forms. `Follower Core` is the target self-hosted canonical deployment, backed by Postgres or SQLite. `Cloudflare Lite mirror` is the lighter shared or sponsored target using Cloudflare Workers with D1 and optional R2 mirrors. Neither should be read as a generally available turnkey follower package yet. Gate snapshots are optional and come later: worker auth should remain live and on-chain authoritative until read parity is stable.

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

The profile names below describe architecture targets; they are not literal current configuration identifiers. The current session wizard offers `Fast & Cheap (Cloudflare)` and `Trustless & Public (Decentralized)` as its two initial presets, then records Advanced per-axis changes as `Custom`. See the [session creation guide](session-creation-guide.md#session-creation-walkthrough) for the implemented choices. Planned rows describe intended packaging and must not be presented as installable releases yet.

| Profile | Availability | Audience | Read path | Write path | Encryption / private compute | Hosting style |
|---|---|---|---|---|---|---|
| `oss-default` | Conceptual name; current public reference path exists | OSS users, small communities | direct RPC reads | public sync | optional `lit-public`, client decrypt | simple public deploy |
| `sponsored-cloudflare` | Partial: worker and sponsorship building blocks exist; packaged Lite mirror remains planned | maintainer-run shared sessions | current worker-backed reads; Lite mirror remains planned | public sync or supported worker intake | optional `lit-public`; Local Key Release only for future private profiles | Cloudflare-first |
| `enterprise-private` | Planned; design work underway | self-hosted orgs / regulated installs | planned full OSS follower core | planned private PoA sync or batch | planned key-release passkey-private or KMS/Vault/OpenBao compatibility; TEE later | Docker, VPC, or on-prem |
| `max-scale-rollup` | Planned | future hosted large-scale CE | planned full follower core plus specialized read APIs | app rollup plus batch or async settlement | `tee` or future `threshold-private` | serious hosted infra |

The intended profile sequences are `oss-default -> sponsored-cloudflare -> max-scale-rollup` for public deployments and `oss-default -> enterprise-private` for company-operated deployments. These are roadmap sequences, not automatic or currently turnkey migrations.

## Related

- [Architecture overview](architecture-overview.md)
- [Session creation guide](session-creation-guide.md#session-creation-walkthrough)
- [Cloudflare worker reference](session-cors-worker.md)
- [Top-level architecture](../ARCHITECTURE.md)
- [Public roadmap](../ROADMAP.md)
