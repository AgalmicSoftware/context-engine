# Scaling

Context Engine separates four choices: where the web app is hosted, whether a
session is public or private, which infrastructure profile owns the session, and
which scaling techniques that profile uses. Hosting the static client does not determine the
session's authority, storage, access policy, or settlement path.

## Profiles

[Session Infrastructure Profiles](run-modes.md#session-infrastructure-profiles)
describes the profiles, what each needs, and who can read its data. This guide
covers how each one scales.

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

Public Worker response hydration reads at most 100 pages per refresh (10,000 stored response revisions). At that limit it keeps the loaded rows and displays a partial-results warning; results and exports may omit answers or later edits. The public cache is not marked fully ready. Interviews load the signed-in participant's saved answers independently and follow every own-answer page before allowing submission, so a partial public cache does not block a completed own-answer load. A failed own-answer read keeps submission waiting and offers a retry. Ordinary complete public loads clear the warning.

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

`worker_envelope` is optional in Hosted & Fast. It encrypts payloads at rest in
the session-worker trust domain and releases them according to worker-evaluated
roles or conditions. The operator and Cloudflare runtime remain inside that
trust boundary.

The stock Trustless & Slower profile defaults to no payload encryption. Lit is
an implemented opt-in when SBT-gated key release is desired; selecting it adds
Lit and chain/RPC requirements. Content keys pass through the session Worker,
and the Worker operator and Lit account administrators remain trusted, so it is
not end-to-end encryption.

Company-Operated encryption and private compute remain planned. Intended
adapters include passkey-backed or organizational identity, KMS/Vault/OpenBao
key release, and later TEE or threshold services. These are target directions,
not shipped packages.

| Mode | Availability | Trust model | Best fit |
| --- | --- | --- | --- |
| `worker_envelope` | Implemented opt-in for Hosted & Fast | Session operator and Cloudflare worker runtime | Cloudflare-backed private sessions |
| `lit` | Implemented opt-in | Session Worker operator, Lit account administrators, and Lit's Chipotle service checking SBT ownership on the selected EVM chain | SBT-gated data in Arweave-backed sessions |
| `none` | Implemented; default for new sessions and the decentralized preset | Storage visibility and session policy | Intentionally public data |
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

## Operating Limits

The limits a Worker-canonical session runs into, for whoever runs one. Each
is described in full in the [Cloudflare worker reference](session-cors-worker.md).

| What | Limit | Past it |
|---|---|---|
| Answers AI builds read (AI Views, the atlas, the risk matrix and the Session Agent's Detailed answers) | 10,000 stored question and answer versions, and about 8 MiB of answer text; an answer replaced by a newer stamped answer to the same question counts instead toward 50,000 listed | The build stops with a plain message and the last good one stays; the Session Agent leaves members' answers out. `GET /admin/diagnostics` shows the count as `storedVersions`; the admin page shows it and warns from 8,000. |
| One AI Views build | About 4.6 million characters of views and the answers they cover | `413`, saying how large it was; the last AI Views stays |
| One person's versions of one answer | 20 | `422` `response_limit_versions` |
| One person's answers in all | Five times the session's question count | `422` `response_limit_rows` |
| One batch read (`/storage/read-batch`) | 100 records, about 8 MiB of text | Records past 8 MiB come back `413`, to be read on their own |
| Members of one group | 1,000, or the session's `groupMemberCeiling` (at most 10,000) | Joins are refused; lowering it removes no one |
| One-use codes added at once | 500 | Add them in more than one batch |
| Context the session's AI reads | Looks at 300 context rows, admins' first, and reads at most 16 sources | The rest are left out; only the Session Agent says so |
| Context one person adds | 20 files and links; admins aren't limited | Refused |
| Signed-in requests a day (`limits.perWalletPerDay`) | Per address per 24 hours, counted for each kind of route; saving, listing and reading answers share one count. Empty or `0` sets no limit | `429` |
| Signed-in AI calls a day (`limits.aiPerWalletPerDay`) | When set, the `/ai` route, Session Agent questions and Agent HTTP's AI together, per address per 24 hours | `429`; when unset, AI calls count under `perWalletPerDay` |
| Feedback about the app | 5 per person a day, 200 per session a UTC day, 2,000 stored | `429`, or `409` when full until an admin clears some |

The per-person counts above live in the session's coordinator and its rate
limit objects, not in backups, so a session restored from a backup starts
them at zero. Session Agent opt-outs are in backups.

## Related

- [Architecture overview](architecture-overview.md)
- [Session creation guide](session-creation-guide.md#session-creation-walkthrough)
- [Cloudflare worker reference](session-cors-worker.md)
- [Top-level architecture](../ARCHITECTURE.md)
- [Public roadmap](../ROADMAP.md)
