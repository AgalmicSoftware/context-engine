# chainGateway / contractScripts Map

## Quick Reference
- Canonical barrel file: `client/src/utilities/web3/chainGateway.ts`
- Legacy compatibility shim: `client/src/utilities/web3/contractScripts.js`
- Primary implementation: `client/src/utilities/web3/contractScripts.impl.ts`
- Session registry helper: `client/src/utilities/web3/sessionRegistry.ts`
- Split helper modules:
  - `client/src/utilities/web3/contractHelpers.ts`
  - `client/src/utilities/web3/chainEventStreams.ts`
  - `client/src/utilities/web3/profileChainReads.ts`
  - `client/src/utilities/web3/chainEventScans.ts`
  - `client/src/utilities/web3/chainMetadataResolution.ts`
  - `client/src/utilities/web3/contractScripts.surveyEventReadMethods.ts`
  - `client/src/utilities/web3/contractScripts.surveyPayloadReadMethods.ts`
  - `client/src/utilities/web3/contractScripts.surveyWriteMethods.ts`
  - `client/src/utilities/web3/contractScripts.sbtRegistryMethods.ts`
  - `client/src/utilities/web3/contractScripts.sbtMintMethods.ts`
- Current lengths:
  - `chainGateway.ts`: **86 lines**
  - `contractScripts.js`: **13 lines**
  - `contractScripts.ts`: **70-line compatibility alias**
  - `contractScripts.impl.ts`: **1,166 lines**
  - `contractScripts.surveyEventReadMethods.ts`: **756 lines**
  - `contractScripts.surveyPayloadReadMethods.ts`: **822 lines**
  - `contractScripts.surveyWriteMethods.ts`: **665 lines**
  - `contractScripts.sbtRegistryMethods.ts`: **1,224 lines**
  - `contractScripts.sbtMintMethods.ts`: **859 lines**
  - `sessionRegistry.ts`: **2,571 lines**
  - `contractHelpers.ts`: **1,040 lines**
  - `chainEventStreams.ts`: **554 lines**
  - `contractEventListeners.ts`: **2-line compatibility alias**
  - `profileChainReads.ts`: **1,151 lines**
  - `contractProfile.ts`: **5-line compatibility alias**
  - `chainEventScans.ts`: **511 lines**
  - `contractScriptsEventScans.ts`: **5-line compatibility alias**
  - `chainMetadataResolution.ts`: **797 lines**
  - `contractScriptsMetadataResolution.ts`: **9-line compatibility alias**
- This map intentionally avoids exact line numbers. Phase 4 TypeScript extraction and helper splits move code frequently, so name-based navigation stays more accurate than stale ranges.
- `sessionRegistry.ts` and `contractScripts.impl.ts` typecheck without `@ts-nocheck`. The typed web3-core milestone was verified on OP Sepolia with the gate and gated-decrypt E2E suites; Lit v3 remains chain-configured and is not tied to a single testnet.

```text
chainGateway.ts  [canonical CJS-compatible barrel for jest.spyOn]
  -> contractScripts.impl.ts  [main export object + shared helpers]
     -> sessionRegistry.ts                 [session registry reads / cache / config]
     -> createContractHelperMethods(...)        [provider / block-window / cache helpers]
     -> createContractEventListenerMethods(...) [SBT / survey chain event streams]
     -> createProfileChainReadMethods(...)     [SBT universe + user activity/profile scans]
     -> chainEventScans.ts                     [stateless event-scan helpers]
     -> chainMetadataResolution.ts             [metadata read / resolution helpers]
     -> contractScripts.survey*Methods.ts      [survey/question read-write method maps]
     -> contractScripts.sbt*Methods.ts         [SBT registry/mint method maps]
```

`chainGateway` is the main web3 integration layer between React and chain, Arweave, Lit, and registry state. The legacy `contractScripts.js` and `contractScripts.ts` names remain as compatibility aliases while callers migrate. The TypeScript split moved reusable helper families plus stateless event-scan and metadata-resolution helpers out of the monolith; `contractScripts.impl.ts` still owns session resolution, provider selection, decrypt policy, survey/question writes, SBT flows, and the final default export wiring.
The remaining stateful survey/SBT methods live in factory modules that receive the same runtime dependency bundle and are spread back onto the default export, preserving call-time `this` lookup and `jest.spyOn()` seams.

Route/page code now reaches selected chain gateway operations through purpose ports under `client/src/domains/**` when that boundary has been modernized. Those adapters deliberately use call-time property lookup against the shared barrel object so `jest.spyOn(contractScripts, ...)` and `jest.spyOn(chainGateway, ...)` remain supported test seams.

## Navigation Rules
- Start in `chainGateway.ts` when adding or auditing barrel-export behavior.
- Start in `contractScripts.js` or `contractScripts.ts` only when maintaining legacy import-path compatibility.
- Start in `sessionRegistry.ts` for session registry lookups, registry cache behavior, session config normalization, or chain-aware session metadata.
- Start in `contractHelpers.ts` for block windows, latest block/gas, read-provider behavior, or faucet helpers.
- Start in `chainEventStreams.ts` for long-lived listener registration and cleanup.
- Start in `profileChainReads.ts` for user-profile scans, SBT universe discovery, and memoized holdings/activity views.
- Start in `chainEventScans.ts` for stateless historical event-scan helpers delegated from the main export object.
- Start in `chainMetadataResolution.ts` for metadata URI resolution and stateless metadata read helpers delegated from the main export object.
- Start in `contractScripts.impl.ts` for everything else: session lookup, decrypt policy, Arweave IO, tx submission, SBT creation/claim flows, and dependency wiring.
- Start in `client/src/domains/sbts/`, `client/src/domains/chain/`, `client/src/domains/profiles/`, `client/src/domains/surveys/`, or `client/src/domains/worker/` when a page already uses a purpose port for a narrow read/write/listener/faucet operation.

## File Index

### `chainGateway.ts`
- Canonical barrel.
- Keeps CommonJS property assignment so `jest.spyOn()` can patch named exports.
- Re-exports the default object plus high-value named helpers and `__test__` seams from `contractScripts.impl.ts`.

### `contractScripts.js` / `contractScripts.ts`
- Naming-migration aliases for legacy callers.
- Preserve the same spyable default and named export surface while callers move to `chainGateway`.

### `contractScripts.impl.ts`
- Declares shared constants, gas fallbacks, listener registries, and internal cache maps.
- Owns retry helpers, decrypt context creation, SBT-gate checks, and gate-aware decrypt suppression.
- Resolves sessions, chains, addresses, PATH RPC policy, and provider selection.
- Wires Arweave/hash/inflight caches plus the dependency bundles passed into the split helper modules.
- Spreads stateful survey/question and SBT method maps back onto the default export.
- Builds the final `contractScripts` export object and exposes `__test__contractScripts*` fixtures for targeted tests.

### `contractScripts.surveyEventReadMethods.ts`
- Owns survey/question event discovery and response-event scan methods that still depend on the default export's block-window and payload-read methods.

### `contractScripts.surveyPayloadReadMethods.ts`
- Owns survey/question/response hash reads, payload-pointer reads, metadata payload decoding, and decrypt-in-place helpers.

### `contractScripts.surveyWriteMethods.ts`
- Owns survey/question creation, question addition, response submission, payload upload, and post-write cache invalidation methods.

### `contractScripts.sbtRegistryMethods.ts`
- Owns SBT factory prediction/creation, factory event reads, mint/burn activity scan state, user SBT discovery, and SBT metadata hydration.

### `contractScripts.sbtMintMethods.ts`
- Owns SBT claim, password, invite, signature, burn, ownership, and cached mint/burn-address helper methods.

### `sessionRegistry.ts`
- Owns session registry reads, cache hydration, and typed normalization of registry-derived session metadata.
- Preserves configured chain and Lit chain values when resolving sessions so OP Sepolia stays the default target while Base Sepolia remains best-effort for legacy and local development.
- Provides the session-config surface consumed by `contractScripts.impl.ts` before provider, decrypt, worker, and contract-address decisions.

### `contractHelpers.ts`
- Contains block, gas, and provider-cache helpers shared by the main implementation.
- Owns smart log fetching, native-balance reads, session block-window policy, and faucet display/write helpers.

### `chainEventStreams.ts`
- Owns SBT factory listeners, per-SBT activity listeners, and survey listeners.
- Central place for attach/remove logic and listener dedupe behavior.
- `contractEventListeners.ts` remains as a naming-migration alias for existing imports while callers move to the canonical stream name.

### `profileChainReads.ts`
- Owns token-owner lookups, SBT universe discovery, per-user holdings memoization, minimal SBT summaries, and cross-domain activity aggregation.
- `contractProfile.ts` remains as a naming-migration alias for existing imports while callers move to the canonical profile-read name.

### `chainEventScans.ts`
- Owns stateless historical event-scan helpers split from the main implementation while preserving call-time delegation through the `contractScripts` object.
- `contractScriptsEventScans.ts` remains as a naming-migration alias for existing imports while callers move to the canonical scan name.

### `chainMetadataResolution.ts`
- Owns stateless metadata URI resolution, fetch, and normalization helpers split from the main implementation while preserving call-time delegation through the `contractScripts` object.
- `contractScriptsMetadataResolution.ts` remains as a naming-migration alias for existing imports while callers move to the canonical metadata name.

## Method Guide

### Session, chain, and provider resolution
- `resolveSession`
- `normalizeSessionSlug`
- `getSessionConfigBySlug`
- `getSessionConfigBySlugOrDefault`
- `getSessionChainId`
- `getSessionNetwork`
- `getSessionAddresses`
- `_getCachedProvider`
- `getReadProviderForGroup`

### RPC, log-range, and cache plumbing
- `callWithRetry`
- `fetchLogsSmartWithProvider`
- `downloadArweaveTextForGroup`
- `clearReadCachesForGroup`
- `getLatestBlockNumber`
- `getRelevantBlockWindowForFilter`

### Survey/question discovery and response reads
- `fetchAllQuestionIDs`
- `getAllQuestionIDsChunkedWithCallback`
- `getResponsesByQuestionID`
- `getSurveyResponsesByAddress`
- `getSurveyResponses`
- `getQuestionResponses`
- `getQuestionResponsesChunkedWithCallback`
- `getQuestionResponsesByAddress`
- `fetchAllSurveyResponses`

### Survey/question metadata reads and writes
- `getSurveyDataById`
- `getSurveyResponse`
- `addSurveyWithQuestions`
- `addQuestions`
- `submitResponses`
- `getResponseHash`
- `getResponse`
- `getQuestionHash`
- `getSurveyHash`
- `getQuestionData`
- `decryptQuestionPayloadInPlace`
- `decryptSurveyPayloadInPlace`
- `getSurveyData`

### SBT creation, metadata, and claim workflows
- `createSBT`
- `countSBTCreated`
- `getSbtsCreated`
- `getSbtCreationBlockByAddress`
- `getSbtMintBurnCountsByAddress`
- `getSBTsByUserAddress`
- `getSbtMetadata`
- `startClaim`
- `claimWithPassword`
- `claimWithInvite`
- `isPasswordValid`
- `computeGroupPasswordHash`
- `signGroupMintAuthorization`
- `generateInvitePayloads`
- `getGroupPasswordHash`
- `getMintedTokens`
- `computeGroupMintMessageHash`
- `mintWithGroupSignature`
- `claim`
- `addHashedPasswords`
- `burnToken`
- `userHasSBT`
- `getSbtHistorySummary`
- `userCanBurnSBTs`
- `getAddressesWhoMintedSBT`
- `getAddressesWhoBurnedSBT`

### Listener and profile mixins
- `listenForSBTEvents`
- `listenForSBTInstanceEvents`
- `listenForSurveyEvents`
- `getAllSbtAddressesCached`
- `getUserSbtNetHoldings`
- `getUserSBTsMinimal`
- `getUserActivity`

## Architecture Flows

### Read path
```text
session slug / cfg
  -> resolveSession + getSessionAddresses
  -> getReadProviderForGroup / getReadProviderForChain
  -> getSurveyHash / getQuestionHash / getResponseHash
  -> downloadArweaveTextForGroup
  -> JSON parse + normalizeSessionNameFields / normalizeQuestionFlags
  -> optional maybeDecryptSurveyPayload / maybeDecryptQuestionPayload
  -> cloneJsonSafe return
```

### Write path
```text
UI payload
  -> normalize ids to bytes32
  -> upload JSON to Arweave
  -> resolveTxGasOverrides / estimate fallback
  -> send contract tx
  -> wait for receipt
  -> clearReadCachesForGroup
```

### SBT profile path
```text
getAllSbtAddressesCached
  -> getUserSbtNetHoldings
  -> getUserSBTsMinimal
  -> getUserActivity
```

## Edit Heuristics
- If a bug is about stale reads, dedupe, or "why is this still cached?", inspect `READ_MEMO`, `READ_INFLIGHT`, and `clearReadCachesForGroup` in `contractScripts.impl.ts`.
- If a bug is about missing results because of session scoping, inspect `getRelevantBlockWindowForFilter` in `contractHelpers.ts` plus the scope helpers in `contractScripts.impl.ts`.
- If a bug is about masked metadata not decrypting, inspect `shouldAttemptGateDecrypt`, `maybeDecryptQuestionPayload`, `maybeDecryptSurveyPayload`, and the `get*Data` methods in `contractScripts.impl.ts`.
- If a bug is about listeners double-firing or leaking, inspect `chainEventStreams.ts` before touching `MainSite`.
- If a bug is about profile or SBT universe scans, inspect `profileChainReads.ts` before expanding `contractScripts.impl.ts`.
- If a test needs to spy on named exports, use `chainGateway.ts` for new tests and keep `contractScripts.js` coverage for legacy import-path compatibility.
