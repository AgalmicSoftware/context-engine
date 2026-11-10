# Lit Protocol in Context Engine

Context Engine installs no Lit SDK packages. When a session selects Lit
encryption, the browser encrypts content locally with a fresh content key, and
the session Worker calls Lit's Chipotle REST API to wrap and release that key
behind an SBT gate. Lit-gated content is not end-to-end encrypted: the Worker
sees the content key in plaintext, and Lit account administrators remain trusted.
New authorities require Worker-signed authorization, so a scoped usage API key
alone cannot impersonate an SBT holder. See
[`lit-v3-design.md`](lit-v3-design.md) for the trust boundary.

This file records the current wiring plus background on the Lit platform.

Primary docs:
- What is Lit: https://developer.litprotocol.com/what-is-lit
- Chipotle API (OpenAPI): https://api.chipotle.litprotocol.com/core/v1/openapi.json

---

## Current CE Chipotle wiring

- Lit runs through **worker-mediated Chipotle execution**:
  - browser/session authoring stores non-secret Lit config in worker config
  - worker secrets store the Lit API key material when a per-session account or per-session override is needed
  - the worker can fall back to a deployment-level server env key for sponsored/shared-account setups
- Current worker/runtime split:
  - worker env fallback: `LIT_USAGE_API_KEY` runs the Action (falling back to `LIT_ACCOUNT_API_KEY`); `LIT_ACCOUNT_API_KEY` provisions authorities (`lit-chipotle-provision` alone falls back to `LIT_USAGE_API_KEY`; without an account key, `lit-chipotle-bootstrap-session` creates a new Lit account); `LIT_API_BASE` overrides the API base
  - per-session worker secrets: `litAccountApiKey`, `litUsageApiKey`, and the Worker-generated `litAuthorizationPrivateKey`
  - per-session Worker-private config: `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid, litAuthorizationVersion, litAuthorizationSigner }`; the public `/session-config` response strips this entire descriptor
- Runtime security contract:
  - `op: "encrypt"` wraps a CEK for the configured audience but does not require the author to hold the target SBT
  - `op: "check"` and `op: "decrypt"` still require the requester to satisfy the SBT gate
  - Chipotle wrapped keys are v2 JSON payloads containing `{ v: 2, cekHex, policyFingerprint, policy }`; the action returns the CEK only when the embedded policy fingerprint matches the worker-approved policy
  - legacy v1 / bare-hex Chipotle wrapped keys are rejected by default and should be recreated, not migrated in-place
  - check/decrypt RPC selection is a worker trust decision: request `rpcUrl` / `customRpcUrl` is rejected unless it exactly matches a worker-approved URL, the action verifies `provider.getNetwork().chainId`, and stored Chipotle metadata does not carry RPC URLs
- These fields are intentionally treated differently:
  - `litAccountApiKey`, `litUsageApiKey`, and `litAuthorizationPrivateKey` are secrets
  - `litApiBase`, `litGroupId`, `litPkpId`, and `litActionCid` are not cryptographic secrets, but still operational metadata and should stay in worker config rather than public session metadata by default
  - the real security boundary is still API-key scope + group membership + Lit Action code; hiding IDs alone is not a sufficient protection model
  - the Action verifies a 60-second Worker signature over the requester, policy, approved HTTPS RPC, operation, and reply key before any gate or key operation; decrypt replies are encrypted to the original Worker request. Account management credentials remain trusted because they can alter permissions. See [authorization and cutover](lit-worker-authorization.md).
  - all permission paths available to untrusted execution keys must restrict the relevant PKP to its Worker-authorized Action: no wildcard Action/PKP grants or another unsigned Action attached to that PKP. CE creates its narrow group but does not audit or repair account-wide permissions; broad account management authority remains trusted
- Current Chipotle endpoints:
  - prod API: `https://api.chipotle.litprotocol.com`
  - prod dashboard: `https://dashboard.chipotle.litprotocol.com/dapps/dashboard/`
  - dev API: `https://api.dev.litprotocol.com`
  - dev docs: `https://docs.dev.litprotocol.com`
  - local self-hosted dev node: `http://localhost:8000`
  - OpenAPI surface: `https://api.chipotle.litprotocol.com/core/v1/openapi.json`
- Worker admin actions: `lit-chipotle-status`, `lit-chipotle-provision`, `lit-chipotle-bootstrap-session`.
- Authorities created before Worker-signed authorization fail closed. Preserve
  any plaintext you need **before updating the Worker**, then follow
  [the upgrade runbook](lit-worker-authorization.md#upgrade-and-cutover).
- Default setup: each session gets its own group, PKP, and scoped runtime usage
  key. When no account key is supplied, the Worker also creates a new Lit account
  for the session.

### Environments and keys

- The Worker accepts only `https://api.chipotle.litprotocol.com` as the API base,
  plus a loopback base such as the local node when
  `LIT_CHIPOTLE_ALLOW_LOCAL_API_BASE` is set.
- Public prod and public dev both report Base mainnet (see External Lit platform
  state below), so isolate staging from production with separate production
  Chipotle accounts. Treat the hosted dev API and docs as preview materials, not a
  staging substitute.
- Chipotle auth is account-key + usage-key based:
  - account key = master credential; keep it server-side only
  - usage key = scoped operational secret; rotate/delete it instead of exposing the account key
  - billing is credit-based; read-only management calls are free while action execution and mutating management calls are metered
- The Worker runs the session's registered Action by `ipfs_id` (`litActionCid`) and resubmits the canonical Action `code` on a cache miss. CE registers the Action and attaches it, with the PKP, to the session group.
- Chipotle's public docs do not describe custom RPC injection, so CE passes custom RPCs as app-supplied, Worker-managed inputs.

The sections below cover the current runtime, the Lit platform state, brief
Lit background with the concepts Context Engine uses, and the repo wiring.

---

## Context Engine runtime status

- Worker-mediated Chipotle execution is the CE Lit runtime for supported sessions.
- The frontend has no Lit SDK client. `MainSite` and `/session/new` do not invent a default hosted Lit network when no Chipotle runtime is configured.
- `window.__litHooks` are published only when the active session or wizard has a Chipotle runtime: a session Worker URL plus complete `litCredentials`, a `chipotle` network hint, configured SBT gate addresses, or a validated worker-canonical Lit profile.
- `/session/new` presents the Lit setup as one manual field, **Lit API key**:
  - bootstrap authority: `litAccountApiKey` / `LIT_ACCOUNT_API_KEY`
  - the worker uses the default Chipotle API base unless worker config/env overrides it, then derives and persists `litApiBase`, `litGroupId`, `litPkpId`, `litActionCid`, and `litUsageApiKey`
  - scoped-runtime identifiers are worker-side, admin, or sponsored-bundle config; they are not entered in the `/new` Lit card
- `/admin` Lit quick tests run against the currently active hook runtime.
- `/admin` Lit status preserves `needsFreshAuthority` even when no execution
  API key is configured, so operators can distinguish authority replacement
  from an ordinary ready runtime. The fresh-authority control requires signed
  status from an updated Worker, saved secret changes, and explicit
  acknowledgement on every attempt. A missing account key produces guidance
  to save one; failures do not automatically retry provisioning. An allocated account
  and its key survive a fresh-authority switch. A saved group, PKP or action blocks
  the switch with its identifiers and a Resume instruction. Saved progress is
  discarded only when Lit confirms it is gone: if Lit refuses the saved account
  key, or its complete group or wallet list no longer includes the saved group or
  PKP, the pending record is cleared (keeping an account Lit still accepts) and
  the next attempt starts over. Network errors, timeouts, 5xx, rate limits and
  billing refusals keep it. A supplied key alone, without an account wallet or any
  remote resource, does not reserve a resource and can be corrected. Both endpoints
  check supplied keys against saved resources before beginning an attempt, and
  repeat that check under the coordinator lock. Conflicts never expose keys: restore
  the prior credentials and Resume. Checkpoint writes survive content-only
  config revisions while still checking the attempt token and authority epoch;
  finalization continues to require current config authority.
- When passkey EOA soft-session mode is enabled and the current page has an
  unlocked in-memory signer, typed-data signatures are auto-signed, so worker
  auth can run without extra passkey prompts. Passive wallet restores only
  hydrate account metadata; they do not make automatic decrypt paths
  interactive.
- For non-creator gated metadata decrypts, CE prefers Lit SBT recipients before
  trying the self EIP-712 unwrap path, avoiding a needless self-sign attempt
  when the viewer should use the SBT gate.

---

## External Lit platform state (research baseline: 2026-04-28)

- Naga is sunset. The only Naga-era code left normalizes old network labels (such as `naga-dev` or `datil`) to `chipotle` when old session metadata is read or rewritten.
- Chipotle production is live at:
  - `https://api.chipotle.litprotocol.com`
  - `https://dashboard.chipotle.litprotocol.com/dapps/dashboard/`
- Public Chipotle dev materials still exist, but they do **not** recreate the old hosted multi-environment split CE used to assume:
  - `https://api.dev.litprotocol.com` is still published
  - `https://docs.dev.litprotocol.com` is still published
  - the public dev dashboard warns that the DEV site is shut down and offers no uptime or state guarantees
- The strongest environment signal currently published is `GET /core/v1/get_node_chain_config`:
  - public prod and public dev both report `chain_name: "Base"`, `chain_id: 8453`, `testnet: false`
  - the environments differ by contract address/state, not by blockchain identity
- There is no documented Chipotle equivalent of a decentralized/public staging network with the old Naga semantics.
- Re-check official Lit docs before implementation; the hosted docs still move and contain contradictions around dev support level and IPFS/action semantics.

---

## 0) One-line definition (what Lit is)

Lit Protocol is a decentralized key management network for **programmable signing and encryption**, designed to avoid a single point of failure/central custodian; it uses threshold cryptography so secrets remain encrypted and distributed across the network.
Source: https://developer.litprotocol.com/what-is-lit

---

## 1) Core use-case buckets (high level)

From Lit's own framing:
- **Private Data**: encryption + access control via Access Control Conditions (ACCs) for private data marketplaces, secure data sharing, sealed-bid auctions, locked NFTs, etc.
- **Decentralized Identity & Authentication**: portable, user-owned auth patterns (no centralized provider).
- **Custody-Resistant Secrets**: secure credentials (API keys, records, config secrets) with recovery/continuity without one custodian.

Source: https://developer.litprotocol.com/what-is-lit

---

## 2) Lit concepts used here

### 2.1 Access Control Conditions (ACCs)
- **What it is**: a policy describing who can decrypt or sign.
- **How CE uses it**: the client builds SBT `balanceOf` conditions, then sends only their SBT addresses, gate mode, and chain ID to the session Worker; the Lit Action evaluates that gate.

---

### 2.2 What CE stores
Lit does **not** store content. The content itself is AES-GCM ciphertext kept
on Arweave or in Cloudflare storage, as the session profile decides. Each
`lit-sbt-v1` recipient in a CE envelope stores, under its `lit` object:
- `ciphertext`: the content key wrapped by the Chipotle action
- `dataToEncryptHash`: a policy-bound sentinel, not a Lit SDK hash
- `chipotle`: version-2 policy metadata (`litActionCid`, `litPkpId`, `sbtAddresses`, `gateMode`, `chainId`, `policyFingerprint`, `policy`)
- the access control conditions and chain used to build that policy

---

### 2.3 Lit Actions
- **What it is**: JS code that Lit runs for you; on Chipotle it runs inside a single TEE.
- **How CE uses it**: the session Worker calls `POST /core/v1/lit_action` with the session's registered action CID (`litActionCid`). The action wraps a content key for the configured gate, which does not require the author to hold the SBT, and releases a wrapped key only after the requester passes the SBT gate.

---

### 2.4 PKPs (Programmable Key Pairs)
- **What it is**: programmable keypairs used for signing, often from Lit Actions.
- **How CE uses it**: each Chipotle-enabled session uses a PKP (`litPkpId`) scoped to its group and usage key.
- **Billing**: Chipotle meters action execution and mutating management calls against the Lit account's credits.

---

## Repo wiring (contextEngine)

- Global hooks: `window.__litHooks` (saveKey/getKey) are set from `MainSite` only when the active session has worker-mediated Chipotle runtime credentials.
- Dev helpers (development builds only; production builds never publish `window.__litTools`):
  - `window.__litTools.encryptForSbt({ value, sbtAddresses, contextLabel })` returns a v1 envelope string.
  - `window.__litTools.decryptEnvelope(envelopeJson)` decrypts a v1 envelope (if you hold the gate SBT).
- `/admin` uses worker-mediated Lit status/bootstrap/provision checks; there is no generic admin execute helper.
- The `/new` Session Wizard has no Lit quick-test panel or scoped runtime fields; rewriting old Lit metadata normalizes legacy network labels to `chipotle`.
- Each session authority uses its own PKP and group containing only its Worker-authorized Action. Never add an older unsigned Action to that PKP/group. The SBT gate remains in the signed policy and Action logic.
- Bootstrap checks a reused Action CID against the canonical source specialized
  for the pinned Worker signer, session, and PKP. A change to that source changes
  the CID and needs another fresh-authority cutover; see
  [the upgrade runbook](lit-worker-authorization.md#upgrade-and-cutover).
- Chipotle setup runs from the canonical CE action source in two modes:
  - existing-account mode: `lit-chipotle-provision` uses the same fresh-authority bootstrap path, preferring a stored session `litAccountApiKey` and falling back to deployment-level `LIT_ACCOUNT_API_KEY`; replacing an existing authority requires `freshAuthority: true`
  - bootstrap mode: use `lit-chipotle-bootstrap-session` with a stored/session/deployment `litAccountApiKey` to derive the missing default group, PKP, usage key, and CE action before persisting the returned `litCredentials`; if no account key is available, the worker can still create a brand-new session account
