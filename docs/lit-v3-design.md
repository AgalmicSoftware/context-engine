# Lit v3 Design and Migration Record: Chipotle Worker-Mediated SBT-Gated Encryption

_Last updated: July 10, 2026._

## Why this doc exists

Context Engine's active Lit runtime is worker-mediated Chipotle execution for
supported sessions. This document records the migration from the former
Naga-era browser runtime and the design decisions that shaped the current
implementation.

The legacy runtime replaced by this design was built around:

- `createLitHooks()` in `client/src/utilities/crypto/litProtocol.ts`
- browser `saveKey()` / `getKey()` calls against Lit ACC encryption APIs
- session auth/payment delegation for decrypt and sponsored usage
- SBT-gated Access Control Conditions (ACCs) passed directly from the browser

That model could not be carried over to Chipotle as a simple SDK swap.

## Historical migration constraint

On April 29, 2026, the dedicated Chipotle worker smoke test reached the real
Chipotle API with a valid usage key, while a scoped key rejected arbitrary
inline action execution. This observation informed the registered-action design
that is now implemented.

Observed live result:

- worker-mediated `lit-chipotle-status`: reached the API successfully
- worker-mediated `lit-chipotle-execute` with inline `code`: failed with `The provided API key is not authorized to execute the specified action`

Practical meaning:

- CE should not assume arbitrary inline actions are allowed for real production-style usage keys
- CE should assume real flows need a pre-registered Lit Action CID plus the correct group / PKP / usage-key scope relationship
- CE should remove generic admin-side Lit execute helpers rather than treating them as a supported runtime surface

## Why the v2 model does not map directly

The current CE envelope format in `client/src/utilities/crypto/cryptography.ts` stores per-field AES-GCM ciphertext plus Lit recipient entries of type `lit-sbt-v1`. Those entries currently depend on browser Lit hooks with this contract:

- `saveKey(cek, { accessControlConditions, chain, ... })`
- `getKey({ accessControlConditions, ciphertext, dataToEncryptHash, ... })`

That is the old ACC/BLS-style browser flow.

Chipotle's current model is different:

- execution is REST/API-key driven
- authorization is group + PKP + action scoped
- CE should prefer worker-mediated execution
- current Lit migration guidance no longer treats the old browser ACC/auth-context flow as the target runtime

So the exact v2 contract `browser -> Lit ACC encrypt/decrypt APIs` is not the right compatibility target for v3.

## Minimum viable v3 design

The smallest design that preserves "only holders of this SBT can decrypt" is:

1. Keep CE's existing local content encryption shape.
2. Move Lit key release / decrypt authority behind the session worker.
3. Use a registered Chipotle Lit Action, not arbitrary inline code.
4. Let that action verify the requester's SBT eligibility on-chain, then unwrap or decrypt the protected CEK inside Lit.

### v3 trust boundary

Browser:

- may still prepare plaintext and local AES-GCM payloads
- never receives a deployment-level Lit credential
- does not call Chipotle directly with a master key

Worker:

- authenticates the requester with existing CE worker auth
- holds or resolves the scoped Chipotle usage key
- forwards only the minimum request payload to the configured Lit Action

Lit Action / PKP:

- checks whether the requester satisfies the required SBT gate
- unwraps or decrypts the protected CEK only after the gate check passes
- returns either decrypted plaintext or a requester-specific release payload, depending on the final CE envelope design

## Proposed v3 envelope direction

The current v2 envelope should remain readable for non-Chipotle recipients, but
Chipotle wrapped-key recipients now fail closed unless they use the v2
policy-bound wrapped-key format.

Recommended v3 envelope shape:

- ciphertext: existing CE AES-GCM encrypted payload
- cekWrap: Chipotle ciphertext wrapping a JSON plaintext `{ v: 2, cekHex, policyFingerprint, policy }`
- policy: canonical SBT gate policy `{ chainId, gateMode, sbtAddresses, litActionCid, litPkpId }`
- litV: explicit wrapped-key version `2`
- rpc: no stored request-selected RPC URL; check/decrypt RPC is chosen from the worker allowlist and verified by `provider.getNetwork().chainId`

This keeps the user data format close to CE's current envelope model while swapping only the Lit recipient mechanism.

Operationally, default Lit Action source changes require re-running
`lit-chipotle-provision` or `lit-chipotle-bootstrap-session` for each
Chipotle-enabled session. The worker verifies submitted action source against
the configured `litActionCid` and does not fall back to old action CIDs.

## First real vertical slice

The first Chipotle-backed flow should be small and already use explicit SBT gates.

Best first candidate:

- encrypted SBT metadata or session metadata field decrypt

Why this is the best first slice:

- smaller than survey response encryption/decryption fan-out
- already uses explicit SBT-gated metadata envelopes
- easy to test with one known SBT contract and one locked field
- gives us a real end-to-end author -> store -> decrypt proof before touching survey response matrices

Suggested proof flow:

1. Lock one test value to one SBT gate.
2. Store it using the v3 worker-mediated Lit path.
3. Attempt decrypt as an allowed wallet.
4. Attempt decrypt as a denied wallet.
5. Keep existing v2 readers in place until this passes reliably.

## Callsite inventory

The current browser Lit runtime fans out from `client/src/utilities/crypto/litProtocol.ts` into these major surfaces.

### Core runtime and helpers

- `client/src/utilities/crypto/litProtocol.ts`
- `client/src/utilities/crypto/cryptography.ts`
- `client/src/utilities/crypto/encryptedFields.ts`
- `client/src/components/MainSite/litSessionConfig.ts`
- `client/src/utilities/session/sessionMetaController.js`

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

## Recommended migration order

1. Introduce the v3 adapter boundary in `litProtocol.ts` and the worker.
2. Prove one SBT-gated encrypt/decrypt flow end to end.
3. Migrate metadata decrypt surfaces that already consume `encryptedFieldsUtils`.
4. Migrate SBT metadata writes/reads.
5. Migrate document-library encrypted payloads.
6. Migrate survey/question authoring and response encryption.
7. Remove legacy payment delegation assumptions from browser Lit hooks.
8. Remove Naga-only docs, warnings, rollout flags, and v2-only plumbing.

## Immediate next implementation task

Build one worker-mediated Chipotle action path for:

- `encrypt one value for gate X`
- `decrypt that value as requester Y if Y holds gate X`

That requires a real configured Lit action, not just a raw usage key.

## Live-test inputs still needed

To run the first real v3 Lit test against Chipotle, CE needs:

- `litUsageApiKey` with execute permission for the intended group
- `litGroupId`
- `litPkpId`
- `litActionCid`
- one real SBT contract/address to use as the gate target
- the target chain RPC path the action should trust for SBT balance checks

Until those are available, the worker/status and local test harness work is ready, but the real gated encrypt/decrypt proof cannot complete.

## Provisioning note

CE does not need a separate third-party IPFS upload service for the first Chipotle rollout. The current Chipotle API exposes `POST /core/v1/get_lit_action_ipfs_id` to deterministically derive the action CID from canonical source, `POST /core/v1/add_action` to register metadata for that CID, and `POST /core/v1/add_action_to_group` plus `POST /core/v1/add_pkp_to_group` for group binding.

Important runtime nuance: the current OpenAPI spec describes `lit_action` `ipfs_id` execution as a lookup in a previously-cached action, while `code` execution is cached by IPFS hash for later reuse. For CE's first rollout, the safest path is to register the CID for permissioning but continue submitting canonical action `code` at execution time until pure `ipfs_id` execution has been verified as operationally durable for our use case.

## Group model

CE now treats the Lit **account** as the default session boundary.

Recommended default:

- one new Lit account per CE session
- one default group inside that account
- one session PKP
- one session runtime usage key

In that model, groups are still useful, but they are now for **internal trust boundaries inside the session account**, not for cross-session isolation. Examples:

- `session-content`
- `survey-responses`
- `admin-ops`

That keeps sessions independently fundable and independently abandonable for OSS/self-hosted operators, while still letting later CE features register additional Lit actions into the same session account.

The SBT gate itself still belongs in the Lit Action logic and request params, not in the group definition.

## Session setup automation

Session Wizard now has two Chipotle automation paths:

1. **Per-session account bootstrap**: when the wizard has only the visible Lit API key, it can call worker admin `lit-chipotle-bootstrap-session` after deploy. E2E/deploy env should prefer `LIT_USAGE_API_KEY`; the internal `litAccountApiKey` field and legacy `LIT_ACCOUNT_API_KEY` env fallback remain for backward compatibility. The worker uses the default Chipotle API base unless worker config/env overrides it, then:
   - creates a new Lit account
   - stores `litAccountApiKey` and `litUsageApiKey` as session secrets
   - creates the default group
   - creates the session PKP
   - derives/registers the canonical CE Lit action
   - attaches the action and PKP to the group
   - creates the scoped runtime usage key
   - writes the resulting `litCredentials = { litApiBase, litGroupId, litPkpId, litActionCid }` into worker config

2. **Existing-account provisioning**: when the wizard already has `litGroupId` and `litPkpId`, it can still call worker admin `lit-chipotle-provision` to register the default CE action into an existing Lit account. That route now prefers a stored session `litAccountApiKey` before falling back to a deployment-level worker env key.

This keeps account/master credentials server-side while eliminating the manual Lit Dashboard setup loop for both the default per-session-account flow and future shared-account / sponsored-account flows.

## Action catalog

The default CE Lit action now lives in repo code rather than as an out-of-band dashboard snippet:

- name: `ce-sbt-gated-crypto-v3`
- source: `client/src/components/Sessions/sessionWizardChipotleLitSupport.ts`
- bundled params example: `SESSION_WIZARD_CHIPOTLE_ACTION_PARAMS_EXAMPLE`

That gives CE a code-reviewed action catalog surface for future Lit action families such as group prompting or additional gated decrypt/sign flows.
