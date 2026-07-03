# Lit Protocol - Primitives + SDK + Payments (agent-ready)

This file contains legacy background plus current and planned app wiring. The
runtime section below describes the code currently in this repo; it does not
imply the corresponding hosted Lit network still exists.

Primary docs:
- What is Lit: https://developer.litprotocol.com/what-is-lit
- v7→v8 migration guide: https://developer.litprotocol.com/sdk/migration-guide
- Lit Client setup (v8): https://developer.litprotocol.com/sdk/getting-started/lit-client
- AuthManager / authContext (v8): https://developer.litprotocol.com/sdk/getting-started/auth-manager
- Encryption & access control (v8): https://developer.litprotocol.com/sdk/access-control/encryption
- Payment Manager / Ledger model (v8): https://developer.litprotocol.com/sdk/getting-started/payment-manager-setup

---

## Current CE Chipotle plan (2026-05-09)

- Context Engine cannot preserve its old browser-native Naga auth-context / ACC flow as-is on Chipotle.
- The current migration direction is therefore **worker-mediated Chipotle execution**:
  - browser/session authoring stores non-secret Lit config in worker config
  - worker secrets store the Lit API key material when a per-session account or per-session override is needed
  - the worker can still fall back to a deployment-level server env key for sponsored/shared-account setups
- Current worker/runtime split:
  - worker env fallback: `LIT_ACCOUNT_API_KEY` (or `LIT_USAGE_API_KEY` when self-hosts prefer a usage-only env key)
  - per-session worker secrets: `litAccountApiKey`, `litUsageApiKey`
  - per-session worker config: `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid }`
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
- Re-provisioning note: any edit to the default CE Lit Action source changes the
  derived `litActionCid`. Chipotle-enabled sessions must re-run
  `lit-chipotle-provision` or `lit-chipotle-bootstrap-session` before live
  v2 wrapped-key encrypt/decrypt is expected to work. CE intentionally does not
  fall back to older insecure action CIDs.
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

The rest of this document contains legacy background plus repo context that is
still useful for understanding the older Naga-era implementation.

---

## Context Engine runtime status (Chipotle cutover)

- Worker-mediated Chipotle execution is now the active CE Lit runtime for supported sessions.
- The frontend still keeps the generic Lit SDK helpers for legacy envelope compatibility and tests, but `MainSite` and `/session/new` no longer invent a default hosted Lit network when no Chipotle runtime is configured.
- `window.__litHooks` are now published only when the active session or wizard has a real Chipotle runtime:
  - worker URL
  - `litApiBase`
  - `litGroupId`
  - `litPkpId`
  - `litActionCid`
- `/session/new` now treats Lit setup in two distinct modes:
  - bootstrap authority: `litApiBase` + `litAccountApiKey`
  - scoped runtime: `litApiBase` + `litGroupId` + `litPkpId` + `litActionCid` + `litUsageApiKey`
- `/admin` Lit quick tests now run against the currently active hook runtime rather than assuming a hidden legacy default.
- When passkey EOA soft-session mode is enabled and the current page has an
  unlocked in-memory signer, typed-data signatures are auto-signed, so worker
  auth and any remaining direct Lit SDK auth flows can run without extra
  passkey prompts. Passive wallet restores only hydrate account metadata; they
  do not make automatic decrypt paths interactive.
- For non-creator gated metadata decrypts, CE prefers Lit SBT recipients before
  trying the self EIP-712 unwrap path, avoiding a needless self-sign attempt
  when the viewer should use the SBT gate.

---

## External Lit platform state (research baseline: 2026-04-28)

- Naga is no longer a future migration concern; it is sunset. The repo still contains Naga-era wiring, but the hosted Naga path should be treated as legacy.
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

## 2) Primitives (definitions + identifiers + where used)

### 2.1 LitNodeClient (network client)
- **What it is**: JS client that connects your app to Lit nodes.
- **Where used**: required for most operations (encryption/decryption, actions, signing, payments).
- **Historical note**: CE no longer uses this client directly in the browser runtime after the Chipotle cutover.
- **Lifecycle**: `connect()` establishes connection; `disconnect()` stops listeners.

Docs:
- Connect: https://developer.litprotocol.com/connecting-to-a-lit-network/connecting
- Install: https://developer.litprotocol.com/sdk/installation

---

### 2.2 Access Control Conditions (ACCs)
- **What it is**: a policy describing who can decrypt/sign.
- **Where used**: encryption/decryption, policy-gated operations.
- **Inputs**: EVM calls like `eth_getBalance`, ERC721 `balanceOf`, etc. (depends on condition type).

Docs:
- Encryption + ACCs: https://developer.litprotocol.com/sdk/access-control/encryption

---

### 2.3 Unified Access Control Conditions (Unified ACCs)
- **What it is**: a normalized structure used by some SDK methods (commonly for Lit Actions / decrypt in-actions).
- **Where used**: action-side decrypt flows often reference Unified ACCs.

Docs entry point:
- Encryption page references unified conditions & serialization helper: https://developer.litprotocol.com/sdk/access-control/encryption

---

### 2.4 Ciphertext + Metadata (what you store)
Lit does **not** store your content. You store:
- `ciphertext` (base64)
- `dataToEncryptHash` (base64)
- conditions (`accessControlConditions` / `unifiedAccessControlConditions` / etc)
- `chain`
...in any datastore you choose (IPFS/Arweave/DB/etc).

Docs:
- Encryption walkthrough: https://developer.litprotocol.com/sdk/access-control/encryption

---

### 2.5 AuthSig + SessionSigs (authentication)
- **AuthSig**: signature over a SIWE-style message (often with capability "recaps").
- **SessionSigs**: scoped, time-bounded session signatures used to authenticate requests to Lit nodes.
- **Rule**: do not cache SessionSigs; generate on-demand.
- **Nonce**: often uses `litNodeClient.getLatestBlockhash()` as nonce in examples.

Docs:
- Lit Actions quick start (SessionSigs example): https://developer.litprotocol.com/sdk/serverless-signing/quick-start
- Delegated payment SessionSigs example: https://developer.litprotocol.com/paying-for-lit/using-delegated-auth-sig
- Resources & abilities model: https://developer.litprotocol.com/sdk/authentication/session-sigs/resources-and-abilities

---

### 2.6 Lit Resources + Lit Abilities (capability model)
Lit identifies resources and abilities so SessionSigs can be restricted.
- **Resources** include:
  - access control condition
  - PKP NFT
  - Capacity Credit NFT
  - Lit Action (by IPFS CID)
- **Abilities** include:
  - threshold decrypt from an ACC
  - threshold signing (ACC / PKP)
  - Lit Action execution
  - capacity credit auth for higher rate limits
  - signing of Lit Action code

Docs:
- Resources & Abilities: https://developer.litprotocol.com/sdk/authentication/session-sigs/resources-and-abilities

---

### 2.7 Lit Actions (decentralized compute)
- **What it is**: JS code executed on Lit nodes.
- **How stored**: inline string or IPFS CID.
- **How executed**: `litNodeClient.executeJs({ sessionSigs, code|ipfsId, jsParams })`
- **Notes**:
  - Naga-dev is positioned as "payment not required"; Naga-test recommended for production-ready dev; Naga for production.

Docs:
- Lit Actions quick start: https://developer.litprotocol.com/sdk/serverless-signing/quick-start

---

### 2.8 PKPs (Programmable Key Pairs)
- **What it is**: programmable keypairs used for signing (often with Lit Actions).
- **Where used**: threshold signing, programmable accounts, etc.
- **Payment**: signing with a PKP requires Capacity Credits (network usage).

Docs (overview + payment table):
- Payments overview: https://developer.litprotocol.com/paying-for-lit/overview

---

### 2.9 Wrapped Keys (encrypted external keys used via Lit)
- **What it is**: encrypted key material usable under Lit policy constraints.
- **Payment**: several wrapped-key operations require Capacity Credits and/or on-chain gas (see payment table).

Docs:
- Payments overview (wrapped keys table): https://developer.litprotocol.com/paying-for-lit/overview

---

## 3) SDK installation (JS)

### 3.1 Browser or general JS
```bash
yarn add @lit-protocol/lit-node-client
# or
npm i @lit-protocol/lit-node-client
```

Optional/commonly used packages in guides:

```bash
yarn add @lit-protocol/constants @lit-protocol/auth-helpers @lit-protocol/contracts-sdk
# or
npm i @lit-protocol/constants @lit-protocol/auth-helpers @lit-protocol/contracts-sdk
```

Docs:
- Install: https://developer.litprotocol.com/sdk/installation
- Encryption guide package list: https://developer.litprotocol.com/sdk/access-control/encryption
- Lit Actions quick start package list: https://developer.litprotocol.com/sdk/serverless-signing/quick-start

---

### 3.2 Node.js server usage

Use the Node-only client:

```bash
yarn add @lit-protocol/lit-node-client-nodejs
# or
npm i @lit-protocol/lit-node-client-nodejs
```

Notes:
- Server-side client class is `LitNodeClientNodeJs` (different from browser class).

Docs:
- Install + node notes: https://developer.litprotocol.com/sdk/installation
- Encryption guide node notes: https://developer.litprotocol.com/sdk/access-control/encryption

---

## 4) Historical SDK example

```ts
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK } from "@lit-protocol/constants";

const litNodeClient = new LitNodeClient({
  litNetwork: LIT_NETWORK.DatilDev, // historical SDK example
});
await litNodeClient.connect();

// later, to stop listeners:
await litNodeClient.disconnect();
```

Network notes:
- Docs list Datil networks and warn older Chronicle-based networks (habanero/manzano/cayenne) are deprecated.

Docs:
- Connect: https://developer.litprotocol.com/connecting-to-a-lit-network/connecting

---

## 5) Encryption & decryption primitives

### 5.1 Encryption (client-side)

Encryption can be fully client-side and outputs:
- `ciphertext` (base64)
- `dataToEncryptHash` (base64)

Common helpers:
- `encryptString()`
- `encryptFile()`
- `encryptUint8Array()`
- `encryptToJson()` (serialize metadata + ciphertext into JSON)

Docs:
- Encryption page: https://developer.litprotocol.com/sdk/access-control/encryption

Example (string):

```ts
import * as LitJsSdk from "@lit-protocol/lit-node-client";

const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
  { accessControlConditions, dataToEncrypt: "hello" },
  litNodeClient
);

// store ciphertext + dataToEncryptHash + accessControlConditions + chain
```

### 5.2 Decryption (requires network)

Decryption typically calls a helper like `decryptToString()` and requires:
- conditions
- `ciphertext`
- `dataToEncryptHash`

Docs:
- Encryption page: https://developer.litprotocol.com/sdk/access-control/encryption

---

## 6) SessionSigs (auth) primitive pattern

SessionSigs are required for:
- Lit Action execution
- Decrypt requests
- Signing requests
...depending on the operation.

Minimal pattern (Lit Actions quick start style):

```ts
import { LIT_ABILITY } from "@lit-protocol/constants";
import { LitActionResource, createSiweMessage, generateAuthSig } from "@lit-protocol/auth-helpers";

const sessionSigs = await litNodeClient.getSessionSigs({
  chain: "ethereum",
  expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  resourceAbilityRequests: [
    { resource: new LitActionResource("*"), ability: LIT_ABILITY.LitActionExecution },
  ],
  authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
    const toSign = await createSiweMessage({
      uri,
      expiration,
      resources: resourceAbilityRequests,
      walletAddress: await signer.getAddress(),
      nonce: await litNodeClient.getLatestBlockhash(),
      litNodeClient,
    });
    return generateAuthSig({ signer, toSign });
  },
});
```

Docs:
- Lit Actions quick start: https://developer.litprotocol.com/sdk/serverless-signing/quick-start
- Delegated payment SessionSigs example (capabilityAuthSigs): https://developer.litprotocol.com/paying-for-lit/using-delegated-auth-sig

---

## 7) Lit Actions primitive pattern

### 7.1 Store code (inline or IPFS CID)

Docs show inline code turned into a string:

```ts
const _litActionCode = async () => {
  // use LitActions.* inside
  LitActions.setResponse({ response: "ok" });
};
const code = `(${_litActionCode.toString()})();`;
```

### 7.2 Execute

```ts
const res = await litNodeClient.executeJs({
  sessionSigs,
  code,              // or ipfsId: "<CID>"
  jsParams: { ... }, // optional
});
```

Docs:
- Lit Actions quick start (executeJs): https://developer.litprotocol.com/sdk/serverless-signing/quick-start

---

## 8) Paying for Lit (how payment works)

### 8.1 Payment types (two layers)

Lit separates:
1. **Capacity Credits** (for *network operations* like decrypting, executing Lit Actions, signing)
2. **Lit test tokens** (for *on-chain transactions* on the Chronicle Yellowstone rollup, like minting Capacity Credits and PKPs)

Docs:
- Capacity Credits concept: https://developer.litprotocol.com/paying-for-lit/capacity-credits
- Paying overview + tables: https://developer.litprotocol.com/paying-for-lit/overview

---

### 8.2 What requires payment (summary)

From Lit's payment overview tables (high level):
- No payment: connect to network, generate SessionSigs, read from Lit contracts, encrypt data
- Requires Capacity Credits: Lit Action execution, decrypting data, signing with PKPs, many wrapped-key operations
- Requires on-chain gas (Lit test token): minting credits, minting PKPs, some wrapped-key lifecycle ops, payment delegation setup, etc.

Docs:
- Full matrix: https://developer.litprotocol.com/paying-for-lit/overview

---

### 8.3 Quick path payment flow (direct capacity credits)

#### Step 1 - get test tokens for the rollup (if needed)

Lit docs say the `tstLPX` test token is used on the Chronicle Yellowstone rollup for gas + minting PKPs/Credits, obtainable via a faucet.

Docs:
- Paying overview (tstLPX + faucet): https://developer.litprotocol.com/paying-for-lit/overview

#### Step 2 - mint a Capacity Credit NFT (reserve capacity)

You mint Capacity Credits (NFTs) and then reference their Token ID in paid requests.
Mint options:
- via Lit Explorer
- via NFT contract / contracts SDK

Example (contracts-sdk):

```ts
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LIT_NETWORK } from "@lit-protocol/constants";

const contractClient = new LitContracts({
  signer: dAppOwnerWallet,      // wallet that will own the credit
  network: LIT_NETWORK.Datil,
});
await contractClient.connect();

const { capacityTokenIdStr } = await contractClient.mintCapacityCreditsNFT({
  requestsPerKilosecond: 80,
  daysUntilUTCMidnightExpiration: 2,
});
```

Docs:
- Capacity credits: https://developer.litprotocol.com/paying-for-lit/capacity-credits
- Minting via SDK example: https://developer.litprotocol.com/sdk/access-control/encryption

#### Step 3 - create a Capacity Delegation Auth Sig (delegate use of the credit)

To use a Capacity Credit for network requests, you create a **Capacity Delegation Auth Sig** that:
- proves authorization to use a specific Capacity Credit
- is scoped to `delegateeAddresses`
- can be limited by `uses` and `expiration`

Example:

```ts
const { capacityDelegationAuthSig } =
  await litNodeClient.createCapacityDelegationAuthSig({
    dAppOwnerWallet: ownerSigner,     // MUST own the capacity credit NFT
    capacityTokenId,                  // token id of the Capacity Credit NFT
    delegateeAddresses: [userAddr],   // authorized callers
    uses: "1",
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
  });
```

Docs:
- Delegating a credit: https://developer.litprotocol.com/paying-for-lit/delegating-credit

#### Step 4 - attach the delegation auth sig to SessionSigs

For paid network requests, include the delegation auth sig inside SessionSigs:

```ts
const sessionSigs = await litNodeClient.getSessionSigs({
  chain: "ethereum",
  expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  capabilityAuthSigs: [capacityDelegationAuthSig],
  resourceAbilityRequests: [
    { resource: new LitActionResource("*"), ability: LIT_ABILITY.LitActionExecution },
  ],
  authNeededCallback: async (...) => { ... },
});
```

Docs:
- Using a Delegation Auth Sig: https://developer.litprotocol.com/paying-for-lit/using-delegated-auth-sig

#### Step 5 - use SessionSigs for paid operations

Use those `sessionSigs` in:
- `executeJs` (Lit Actions)
- decrypt calls
- signing calls
...depending on the operation.

---

### 8.4 Payment tooling options (to reduce friction)

Lit documents two tools to simplify payment integration:
- **Lit Relayer**: open-source service hosted by Lit to facilitate onboarding; may subsidize some interactions like minting PKPs; availability not guaranteed.
- **Payment Delegation Database**: service (from Relayer) for managing payers/payees and capacity delegation at scale.

Docs:
- Paying overview (tools): https://developer.litprotocol.com/paying-for-lit/overview

---

## 9) Operational notes / common pitfalls

- **Do not cache SessionSigs**; generate on demand.
- **Nonce** in examples uses `litNodeClient.getLatestBlockhash()`.
- **Disconnect** when done (`litNodeClient.disconnect()`) to stop listeners.
- Docs mention stale `authSig` / `sessionSigs` can cause errors; clearing local storage / disconnect patterns are referenced in guides.

Docs:
- Lit Actions quick start: https://developer.litprotocol.com/sdk/serverless-signing/quick-start
- Encryption guide notes: https://developer.litprotocol.com/sdk/access-control/encryption

Key official pages used for traceability: see [Lit Protocol Developer Docs](https://developer.litprotocol.com/) — topics referenced include: What is Lit, SDK installation, connecting to a Lit network, encryption and access control, Lit Actions and SessionSigs, payments overview, capacity credits, delegation auth sigs, and resources/abilities.

---

## Repo wiring (contextEngine)

- Global hooks: `window.__litHooks` (saveKey/getKey) are set from `MainSite` only when the active session has worker-mediated Chipotle runtime credentials.
- Dev helper: `window.__litTools.encryptForSbt({ value, sbtAddresses, contextLabel })` returns a v1 envelope string.
- Dev helper: `window.__litTools.decryptEnvelope(envelopeJson)` decrypts a v1 envelope (if you hold the gate SBT).
- `/admin` now uses worker-mediated Lit status/bootstrap/provision checks; there is no supported generic admin execute helper.
- `/new` Session Wizard no longer shows a Lit quick-test panel; when old Lit metadata is rewritten it normalizes legacy network labels onto `chipotle`.
- Demo session secrets live in `client/src/variables/demo/demo_sessions.json` under the `test` session.

- CE should default to one reusable group per environment or trust boundary, not one group per session. The SBT gate itself belongs in Lit Action code and request params. Session-specific groups remain an optional isolation choice, not the default migration target.
- Session Wizard can now automate both Chipotle setup modes from canonical CE action source:
  - existing-account mode: use `lit-chipotle-provision` to register the default CE action into a configured group/PKP, preferring a stored session `litAccountApiKey` and falling back to deployment-level `LIT_ACCOUNT_API_KEY`
  - bootstrap mode: use `lit-chipotle-bootstrap-session` to either create a brand-new Lit account or, when a session/deployment `litAccountApiKey` already exists, derive the missing default group, PKP, usage key, and CE action inside that existing account before persisting the returned `litCredentials`
