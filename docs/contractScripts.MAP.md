# contractScripts Map

## Quick Reference
- Barrel file: `client/src/utilities/web3/contractScripts.js`
- Primary implementation: `client/src/utilities/web3/contractScripts.impl.ts`
- Session registry helper: `client/src/utilities/web3/sessionRegistry.ts`
- Split helper modules:
  - `client/src/utilities/web3/contractHelpers.ts`
  - `client/src/utilities/web3/chainEventStreams.ts`
  - `client/src/utilities/web3/contractProfile.ts`
  - `client/src/utilities/web3/chainEventScans.ts`
  - `client/src/utilities/web3/chainMetadataResolution.ts`
- Current lengths:
  - `contractScripts.js`: **12 lines**
  - `contractScripts.impl.ts`: **4,691 lines**
  - `sessionRegistry.ts`: **2,571 lines**
  - `contractHelpers.ts`: **1,040 lines**
  - `chainEventStreams.ts`: **554 lines**
  - `contractEventListeners.ts`: **2-line compatibility alias**
  - `contractProfile.ts`: **1,151 lines**
  - `chainEventScans.ts`: **511 lines**
  - `contractScriptsEventScans.ts`: **5-line compatibility alias**
  - `chainMetadataResolution.ts`: **797 lines**
  - `contractScriptsMetadataResolution.ts`: **9-line compatibility alias**
- This map intentionally avoids exact line numbers. Phase 4 TypeScript extraction and helper splits move code frequently, so name-based navigation stays more accurate than stale ranges.
- `sessionRegistry.ts` and `contractScripts.impl.ts` typecheck without `@ts-nocheck`. The typed web3-core milestone was verified on OP Sepolia with the gate and gated-decrypt E2E suites; Lit v3 remains chain-configured and is not tied to a single testnet.

```text
contractScripts.js  [CJS compatibility barrel for jest.spyOn]
  -> contractScripts.impl.ts  [main export object + shared helpers]
     -> sessionRegistry.ts                 [session registry reads / cache / config]
     -> createContractHelperMethods(...)        [provider / block-window / cache helpers]
     -> createContractEventListenerMethods(...) [SBT / survey chain event streams]
     -> createContractProfileMethods(...)       [SBT universe + user activity/profile scans]
     -> chainEventScans.ts                     [stateless event-scan helpers]
     -> chainMetadataResolution.ts             [metadata read / resolution helpers]
```

`contractScripts` is still the main web3 integration layer between React and chain, Arweave, Lit, and registry state. The TypeScript split moved reusable helper families plus stateless event-scan and metadata-resolution helpers out of the monolith; `contractScripts.impl.ts` still owns session resolution, provider selection, decrypt policy, survey/question writes, SBT flows, and the final default export wiring.

Route/page code now reaches selected `contractScripts` operations through purpose ports under `client/src/domains/**` when that boundary has been modernized. Those adapters deliberately use call-time property lookup against the shared barrel object so `jest.spyOn(contractScripts, ...)` remains a supported test seam.

## Navigation Rules
- Start in `contractScripts.js` only if you need barrel-export behavior or `jest.spyOn` compatibility.
- Start in `sessionRegistry.ts` for session registry lookups, registry cache behavior, session config normalization, or chain-aware session metadata.
- Start in `contractHelpers.ts` for block windows, latest block/gas, read-provider behavior, or faucet helpers.
- Start in `chainEventStreams.ts` for long-lived listener registration and cleanup.
- Start in `contractProfile.ts` for user-profile scans, SBT universe discovery, and memoized holdings/activity views.
- Start in `chainEventScans.ts` for stateless historical event-scan helpers delegated from the main export object.
- Start in `chainMetadataResolution.ts` for metadata URI resolution and stateless metadata read helpers delegated from the main export object.
- Start in `contractScripts.impl.ts` for everything else: session lookup, decrypt policy, Arweave IO, tx submission, SBT creation/claim flows, and dependency wiring.
- Start in `client/src/domains/sbts/`, `client/src/domains/chain/`, `client/src/domains/profiles/`, `client/src/domains/surveys/`, or `client/src/domains/worker/` when a page already uses a purpose port for a narrow read/write/listener/faucet operation.

## File Index

### `contractScripts.js`
- Compatibility barrel.
- Keeps CommonJS property assignment so `jest.spyOn()` can patch named exports.
- Re-exports the default object plus high-value named helpers and `__test__` seams from `contractScripts.impl.ts`.

### `contractScripts.impl.ts`
- Declares shared constants, gas fallbacks, listener registries, and internal cache maps.
- Owns retry helpers, decrypt context creation, SBT-gate checks, and gate-aware decrypt suppression.
- Resolves sessions, chains, addresses, PATH RPC policy, and provider selection.
- Wires Arweave/hash/inflight caches plus the dependency bundles passed into the split helper modules.
- Exposes the main survey/question read and write flows, including Arweave metadata fetch, upload, submit, and response decoding.
- Exposes SBT factory, claim, password, invite, signature, metadata, burn, and history workflows.
- Builds the final `contractScripts` export object and exposes `__test__contractScripts*` fixtures for targeted tests.

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

### `contractProfile.ts`
- Owns token-owner lookups, SBT universe discovery, per-user holdings memoization, minimal SBT summaries, and cross-domain activity aggregation.

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
- If a bug is about profile or SBT universe scans, inspect `contractProfile.ts` before expanding `contractScripts.impl.ts`.
- If a test needs to spy on named exports, remember the stable entry point is still `contractScripts.js`, not `contractScripts.impl.ts`.
