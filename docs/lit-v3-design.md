# Lit v3 Design and Migration Record: Chipotle Worker-Mediated SBT-Gated Encryption

_Last updated: November 6, 2026._

## Why this doc exists

Context Engine's Lit runtime is worker-mediated Chipotle execution. Browser code
reaches it through `createLitHooks()` in
`client/src/utilities/crypto/litProtocol.ts`. Its `saveKey()` and `getKey()` hooks
send key-wrap and key-release requests to the session Worker, which calls Lit's
Chipotle REST API. This document records the design decisions behind that
arrangement and the migration from Lit's former Naga SDK.

The Naga flow passed SBT-gated Access Control Conditions (ACCs) from the browser
straight to Lit, with session auth and payment delegation for decrypt and
sponsored usage. Chipotle cannot take that flow as a simple SDK swap.

## Historical migration constraint

A scoped usage key cannot run arbitrary inline `lit_action` code: Chipotle rejects
it with `The provided API key is not authorized to execute the specified action`.
Real flows therefore need a pre-registered Lit Action CID with the right group,
PKP, and usage-key scope, which CE provisions. CE has no generic admin-side Lit
execute helper.

## Why the v2 model does not map directly

The CE envelope is implemented by `shared/encryption/envelopeV1Core.mjs` and the
browser orchestration in `client/src/utilities/crypto/cryptography.ts`. It stores
per-field AES-GCM ciphertext plus Lit recipient entries of type `lit-sbt-v1`,
which the browser reaches through two hooks:

- `saveKey(cek, { accessControlConditions, chain, ... })`
- `getKey({ accessControlConditions, ciphertext, dataToEncryptHash, ... })`

Under Naga these hooks ran an ACC/BLS flow in the browser. Chipotle is different:

- execution is REST/API-key driven
- authorization is scoped by group, PKP, and Action
- CE runs it from the session Worker, not the browser

So the hooks keep their shape but call the Worker, not Lit ACC encrypt/decrypt
APIs.

## Minimum viable v3 design

The smallest design that keeps key release gated on SBT ownership is below. It
does not hide keys from the session Worker or Lit account administrators; see the
v3 trust boundary.

1. Keep CE's existing local content encryption shape.
2. Move Lit key release / decrypt authority behind the session worker.
3. Use a registered Chipotle Lit Action, not arbitrary inline code.
4. Let that action verify the requester's SBT eligibility on-chain, then unwrap or decrypt the protected CEK inside Lit.

### Chain scope

Lit v3 gate evaluation should be treated as chain-configured across EVM chains,
not Base-specific. Context Engine's default E2E and deployment target is OP
Sepolia (`11155420`), but that is an application default, not a Lit limitation.
Lit access conditions should derive their Lit chain from the session or gate
`chainId` / `litChain` value. Base Sepolia (`84532`) remains a best-effort
legacy/development compatibility target, not an actively supported E2E or
deployment runtime, and it is not currently configured in the canonical CE
contract manifest.

### v3 trust boundary

Browser:

- may still prepare plaintext and local AES-GCM payloads
- never receives a deployment-level Lit credential
- does not call Chipotle directly with a master key

Worker:

- authenticates the requester with existing CE worker auth
- holds or resolves the scoped Chipotle usage key
- forwards only the minimum request payload to the configured Lit Action
- sees the CEK in plaintext: the browser sends it to the Worker to be wrapped,
  and the Worker relays the unwrapped CEK back after a passing decrypt

Lit Action / PKP:

- checks whether the requester satisfies the required SBT gate
- unwraps the protected CEK only after the gate check passes
- verifies Worker-signed authorization before the gate check and encrypts the CEK to the original Worker request; the Worker decrypts and relays it to the authenticated requester

What this means for the `gate` audience: content wrapped for `lit-sbt-v1`
recipients can be read by:

- SBT holders who pass the gate;
- whoever operates the session Worker (normally the session admin);
- Lit account administrators or others able to alter PKP/Action permissions.

New authorities reject direct calls made with a scoped usage key alone. A
signature pinned in the Action binds the authenticated wallet, approved HTTPS
RPC, full request, and ephemeral reply key. Captured signed requests return an
opaque reply to the original Worker. See [the protocol and upgrade runbook](lit-worker-authorization.md).

This is SBT-gated key release, not end-to-end encryption between SBT holders.

## v3 envelope shape

A `lit-sbt-v1` recipient keeps its Lit data under `lit`. Chipotle wrapped-key
recipients fail closed unless they use the policy-bound v2 format:

- `ciphertext`: the Chipotle-wrapped content key, whose plaintext is JSON `{ v: 2, cekHex, policyFingerprint, policy }`
- `dataToEncryptHash`: a policy-bound sentinel, not a Lit SDK hash
- `chipotle`: `{ version: 2, litActionCid, litPkpId, sbtAddresses, gateMode, chainId, policyFingerprint, policy }`
- `policy`: canonical SBT gate policy `{ chainId, gateMode, sbtAddresses, litActionCid, litPkpId }`
- no stored RPC URL: the Worker picks the check/decrypt RPC from its approved list, and the Action verifies `provider.getNetwork().chainId`

This keeps the user data format close to CE's existing envelope model and swaps
only the Lit recipient mechanism.

Operationally, unsigned authorities require an explicit fresh PKP/group/usage-key
cutover. Worker source is specialized with session/signing constants before CID
derivation; participant source is never authoritative. Old ciphertext and old
permissions require separate retirement decisions, described in the runbook.

## Callsite inventory

The current browser Lit runtime fans out from `client/src/utilities/crypto/litProtocol.ts` into these major surfaces.

### Core runtime and helpers

- `shared/encryption/envelopeV1Core.mjs`
- `client/src/utilities/crypto/litProtocol.ts`
- `client/src/utilities/crypto/cryptography.ts`
- `client/src/utilities/crypto/encryptedFields.ts`
- `client/src/components/MainSite/litSessionConfig.ts`
- `client/src/utilities/session/sessionMetaController.ts`

### Session metadata and AppShell

- `client/src/components/MainSite/AppShell.tsx`
- `client/src/components/Sessions/SessionWizard.tsx`

### SBT metadata

- `client/src/components/SBTs/CreateSBTGroup.tsx`
- `client/src/components/SBTs/SBTPage.tsx`

### Document library

- `client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx`

### Survey and question flows

- `client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx`
- `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx`
- `client/src/components/SurveyTool/SurveyQuestions.tsx`
- `client/src/components/SurveyTool/SurveyResults.tsx`
- `client/src/components/SurveyTool/surveyToolResponseGateController.ts`
- `client/src/components/SurveyTool/surveyToolRatingEnvelopeSubmitController.ts`
- `client/src/utilities/web3/contractScripts.impl.ts`

## Provisioning note

CE needs no third-party IPFS upload service. The Chipotle API exposes
`POST /core/v1/get_lit_action_ipfs_id` to derive the Action CID deterministically
from canonical source, `POST /core/v1/add_action` to register metadata for that
CID, and `POST /core/v1/add_action_to_group` plus `POST /core/v1/add_pkp_to_group`
for group binding.

The Worker runs the Action by `ipfs_id` (the session's `litActionCid`). Lit runs
an `ipfs_id` only if it has the code cached, so on a cache miss ("no cached code
found" or "cache miss for ipfs id") the Worker resubmits the canonical Action
`code` once, and Lit caches it by IPFS hash.

## Group model

CE treats the Lit **account** as the session boundary. By default each session
gets:

- one Lit account (new when no account key is supplied)
- one default group inside that account
- one session PKP
- one session runtime usage key

That keeps sessions independently fundable and abandonable for OSS/self-hosted
operators. Groups mark trust boundaries inside the session account, not isolation
between sessions. The SBT gate belongs in the Lit Action logic and request params,
not in the group definition.

## Session setup automation

Session setup has two Chipotle automation paths:

1. **Per-session bootstrap**: when the wizard has only the visible Lit API key, it can call worker admin `lit-chipotle-bootstrap-session` after deploy. The wizard stores that key as the `litAccountApiKey` secret; a Worker-level `LIT_ACCOUNT_API_KEY` env var is the fallback. The worker uses the default Chipotle API base unless worker config/env overrides it, then:
   - creates a new Lit account, only if no account key is available
   - stores `litAccountApiKey` and `litUsageApiKey` as session secrets
   - creates the default group
   - creates the session PKP
   - derives/registers the canonical CE Lit action
   - attaches the action and PKP to the group
   - creates the scoped runtime usage key
   - writes the resulting `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid, litAuthorizationVersion, litAuthorizationSigner }` into worker config

2. **Existing-account provisioning**: `lit-chipotle-provision` uses the same bootstrap path. An explicit `freshAuthority: true` request creates a new group, PKP, and scoped usage key under the existing account. It never attaches hardened source to an old authority. The independent Worker signer stays in encrypted session secrets and is reused on retries.

This keeps account/master credentials server-side and removes the manual Lit Dashboard setup loop.

## Action catalog

The default CE Lit action lives in repo code, not in an out-of-band dashboard snippet:

- name: `ce-sbt-gated-crypto-v4`
- source: `shared/litChipotleAction.mjs`; the client catalog re-exports it
- bundled params example: `DEFAULT_CHIPOTLE_ACTION_PARAMS_EXAMPLE`
