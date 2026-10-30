# Lit Protocol in Context Engine

Context Engine installs no Lit SDK packages. When a session selects Lit
encryption, the browser encrypts content locally with a fresh content key, and
the session Worker calls Lit's Chipotle REST API to wrap and release that key
behind an SBT gate. Lit-gated content is not end-to-end encrypted: the Worker
sees the content key in plaintext, and Lit account administrators remain trusted.
New authorities require Worker-signed authorization, so a scoped usage API key
alone cannot impersonate an SBT holder. See
[`lit-v3-design.md`](lit-v3-design.md) for the trust boundary.

This file records the current wiring plus platform background from the move
off the former Naga-era browser SDK. It does not imply that any older hosted
Lit network still exists.

Primary docs:
- What is Lit: https://developer.litprotocol.com/what-is-lit
- Chipotle API (OpenAPI): https://api.chipotle.litprotocol.com/core/v1/openapi.json

---

## Current CE Chipotle plan (2026-05-09)

- Context Engine cannot preserve its old browser-native Naga auth-context / ACC flow as-is on Chipotle.
- The current migration direction is therefore **worker-mediated Chipotle execution**:
  - browser/session authoring stores non-secret Lit config in worker config
  - worker secrets store the Lit API key material when a per-session account or per-session override is needed
  - the worker can still fall back to a deployment-level server env key for sponsored/shared-account setups
- Current worker/runtime split:
  - worker env fallback: `LIT_ACCOUNT_API_KEY` (or `LIT_USAGE_API_KEY` when self-hosts prefer a usage-only env key)
  - per-session worker secrets: `litAccountApiKey`, `litUsageApiKey`, and the Worker-generated `litAuthorizationPrivateKey`
  - per-session Worker-private config: `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid, litAuthorizationVersion, litAuthorizationSigner }`; the public `/session-config` response strips this entire descriptor
- Runtime security contract:
  - `op: "encrypt"` wraps a CEK for the configured audience but does not require the author to hold the target SBT
  - `op: "check"` and `op: "decrypt"` still require the requester to satisfy the SBT gate
  - Chipotle wrapped keys are v2 JSON payloads containing `{ v: 2, cekHex, policyFingerprint, policy }`; the action returns the CEK only when the embedded policy fingerprint matches the worker-approved policy
  - legacy v1 / bare-hex Chipotle wrapped keys are rejected by default and should be recreated, not migrated in-place
  - check/decrypt RPC selection is a worker trust decision: request `rpcUrl` / `customRpcUrl` is rejected unless it exactly matches a worker-approved URL, the action verifies `provider.getNetwork().chainId`, and stored Chipotle metadata does not carry RPC URLs
- These fields are intentionally treated differently:
  - `litUsageApiKey` is a secret
  - `litApiBase`, `litGroupId`, `litPkpId`, and `litActionCid` are not cryptographic secrets, but still operational metadata and should stay in worker config rather than public session metadata by default
  - the real security boundary is still API-key scope + group membership + Lit Action code; hiding IDs alone is not a sufficient protection model
  - the Action verifies a 60-second Worker signature over the requester, policy, approved HTTPS RPC, operation, and reply key before any gate or key operation; decrypt replies are encrypted to the original Worker request. Account management credentials remain trusted because they can alter permissions. See [authorization and cutover](lit-worker-authorization.md).
  - all permission paths available to untrusted execution keys must restrict the relevant PKP to its Worker-authorized Action: no wildcard Action/PKP grants or another unsigned Action attached to that PKP. CE creates its narrow group but does not audit or repair account-wide permissions; broad account management authority remains trusted
- Current Chipotle endpoints/source-of-truth:
  - prod API: `https://api.chipotle.litprotocol.com`
  - prod dashboard: `https://dashboard.chipotle.litprotocol.com/dapps/dashboard/`
  - dev API: `https://api.dev.litprotocol.com`
  - dev docs: `https://docs.dev.litprotocol.com`
  - local self-hosted dev node: `http://localhost:8000`
  - OpenAPI surface: `https://api.chipotle.litprotocol.com/core/v1/openapi.json`
  - public prod/dev node-chain config currently reports Base mainnet (`chain_id: 8453`) for the control plane
- First worker-backed Chipotle slice now implemented in this repo:
  - worker config/secret schema split for Chipotle fields
  - sponsored-bundle plumbing for those fields
  - worker admin actions:
    - `lit-chipotle-status`
    - `lit-chipotle-provision`
    - `lit-chipotle-bootstrap-session`
- Re-provisioning note: unsigned or incomplete authorities fail closed.
  Preserve required plaintext with the old working runtime **before updating
  the Worker**; the updated Worker cannot decrypt legacy unsigned ciphertext.
  In `/admin`, open **Worker secrets → Lit**, save the account key, refresh
  status, acknowledge the warning, and select **Create fresh Lit authority**.
  This sends the existing signed provision request with `freshAuthority: true`
  to create a new PKP, group, scoped key, and specialized Action. Refresh status
  and verify new content before retiring old permissions separately. Replacing
  any authority cuts off its old ciphertext in this application; no automatic
  content migration is provided. See
  [the upgrade runbook](lit-worker-authorization.md#upgrade-and-cutover).
- Current default CE architecture direction:
  - create one new Lit account per session
  - create one default group inside that account
  - create one session PKP
  - create one scoped runtime usage key
  - keep groups available for later internal trust boundaries such as
    `session-content`, `survey-responses`, or future group-prompting action families
- Live smoke result on April 29, 2026:
  - the current scoped usage-key test can reach Chipotle through the worker
  - arbitrary inline `lit_action` execution was rejected as unauthorized
  - CE should therefore assume real migrations need a registered action CID and matching group scope rather than ad-hoc inline code, and the unsupported generic admin execute helper has been removed

### Immediate migration implications

- Public prod and public dev currently both report `chain_name: "Base"`, `chain_id: 8453`, and `testnet: false`; the current split is different contract state on the same chain, not a separate Chipotle testnet.
- Practical environment guidance:
  - use `http://localhost:8000` when you need a true disposable/local dev surface
  - treat `https://api.dev.litprotocol.com` / `https://docs.dev.litprotocol.com` as preview-style hosted dev materials, not as a durable hosted staging substitute
  - use separate production Chipotle accounts for staging and production isolation
- Current Chipotle auth/billing model is account-key + usage-key based, not AuthManager/session-key/PaymentManager based:
  - account key = master credential; keep it server-side only
  - usage key = scoped operational secret; rotate/delete it instead of exposing the account key
  - billing is credit-based; read-only management calls are free while action execution and mutating management calls are metered
- Current action/runtime migration constraints:
  - Chipotle docs now center `POST /core/v1/lit_action`, `async function main(...)`, and direct return values
  - older Naga runtime helpers such as `getRpcUrl`, `signAndCombine*`, runtime permission lookup helpers, and the old ACC/browser auth-context flow should be treated as legacy-only in CE
  - current primary sources do not document a Chipotle equivalent of arbitrary custom RPC injection at the control-plane layer, so CE should treat custom RPCs as app-supplied worker-managed inputs rather than a guaranteed Lit platform feature
- Current public docs do not document a Naga-to-Chipotle import path for accounts, usage keys, PKPs, groups, permissions, or balances; plan to recreate those resources during migration.
- Current public docs are also internally inconsistent about IPFS action execution. CE should therefore treat inline `code` execution as the most certain worker-mediated path until Lit documents the `ipfs_id` / cached-action model more cleanly.

The sections below cover the current runtime, the Lit platform state, brief
Lit background with the concepts Context Engine uses, and the repo wiring.

---

## Context Engine runtime status (Chipotle cutover)

- Worker-mediated Chipotle execution is now the active CE Lit runtime for supported sessions.
- The frontend has no Lit SDK client. `MainSite` and `/session/new` do not invent a default hosted Lit network when no Chipotle runtime is configured.
- `window.__litHooks` are published only when the active session or wizard has a Chipotle runtime: a session Worker URL plus complete `litCredentials`, a `chipotle` network hint, configured SBT gate addresses, or a validated worker-canonical Lit profile.
- `/session/new` now presents the Lit setup as one manual field:
  - bootstrap authority: `litAccountApiKey` / `LIT_ACCOUNT_API_KEY`
  - the worker uses the default Chipotle API base unless worker config/env overrides it, then derives and persists `litApiBase`, `litGroupId`, `litPkpId`, `litActionCid`, and `litUsageApiKey`
  - scoped-runtime identifiers remain supported as worker-side/admin/sponsored-bundle config, but they are no longer hand-entered in the `/new` Lit card
- `/admin` Lit quick tests now run against the currently active hook runtime rather than assuming a hidden legacy default.
- `/admin` Lit status preserves `needsFreshAuthority` even when no execution
  API key is configured, so operators can distinguish authority replacement
  from an ordinary ready runtime. The fresh-authority control requires signed
  status from an updated Worker, saved secret changes, and explicit
  acknowledgement on every attempt. A missing account key produces guidance
  to save one; failures do not automatically retry provisioning. An allocated account
  and its key survive a fresh-authority switch. A saved group, PKP or action blocks
  the switch with its identifiers and a Resume instruction; no implicit reset
  discards those resources. A supplied key alone, without an account wallet or any
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
- Practical migration planning should assume:
  - true free/local development = self-hosted local node (`http://localhost:8000`)
  - hosted dev API/docs = preview / non-guaranteed environment
  - staging = separate production Chipotle account, not a separate testnet
- CE should therefore treat Chipotle migration as a **re-platform**, not a package bump:
  - Naga: SDK-first, wallet/auth-context/session-manager/payment-manager, multi-node execution
  - Chipotle: REST/API-key first, account/usage-key/group/PKP/action registration, single-TEE execution
- Re-check official Lit docs before implementation; the hosted docs still move and contain contradictions around dev support level and IPFS/action semantics.
- The currently documented safe path is:
  - local node for free/local development
  - separate production Chipotle accounts for staging vs production
  - worker-mediated CE execution using scoped usage keys rather than browser-held master credentials

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
- **How CE uses it**: the client still builds SBT `balanceOf` conditions, then sends only their SBT addresses, gate mode, and chain ID to the session Worker; the Lit Action evaluates that gate.

---

### 2.2 What CE stores
Lit does **not** store content. The content itself is AES-GCM ciphertext kept
on Arweave or in Cloudflare storage, as the session profile decides. Each
`lit-sbt-v1` recipient in a CE envelope stores:
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
- `/admin` now uses worker-mediated Lit status/bootstrap/provision checks; there is no supported generic admin execute helper.
- `/new` Session Wizard no longer shows a Lit quick-test panel or scoped runtime fields; when old Lit metadata is rewritten it normalizes legacy network labels onto `chipotle`.
- Demo session secrets live in `client/src/variables/demo/demo_sessions.json` under the `test` session.

- Each session authority uses its own PKP and group containing only its Worker-authorized Action. Never add an older unsigned Action to that PKP/group. The SBT gate remains in the signed policy and Action logic.
- Reused Action CIDs are checked against the canonical source specialized for
  the pinned Worker signer, session, and PKP before bootstrap accepts a
  completed setup or changes permissions. Changing that source changes the
  CID and requires another fresh-authority cutover, with preservation before
  deployment. Ordinary Worker updates that leave Action source unchanged do
  not themselves require replacement. Fresh authority preserves the Worker
  signing key; this release provides no signer-rotation procedure.
- Session Wizard can now automate both Chipotle setup modes from canonical CE action source:
  - existing-account mode: `lit-chipotle-provision` uses the same fresh-authority bootstrap path, preferring a stored session `litAccountApiKey` and falling back to deployment-level `LIT_ACCOUNT_API_KEY`; legacy authority replacement requires `freshAuthority: true`
  - bootstrap mode: use `lit-chipotle-bootstrap-session` with a stored/session/deployment `litAccountApiKey` to derive the missing default group, PKP, usage key, and CE action before persisting the returned `litCredentials`; if no account key is available, the worker can still create a brand-new session account
