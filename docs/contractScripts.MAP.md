# contractScripts Map

## Quick Reference
- Barrel file: `client/src/utilities/web3/contractScripts.js`
- Primary implementation: `client/src/utilities/web3/contractScripts.impl.js`
- Split helper modules:
  - `client/src/utilities/web3/contractHelpers.js`
  - `client/src/utilities/web3/contractEventListeners.js`
  - `client/src/utilities/web3/contractProfile.js`
- Current lengths:
  - `contractScripts.js`: **35 lines**
  - `contractScripts.impl.js`: **7,596 lines**
  - `contractHelpers.js`: **428 lines**
  - `contractEventListeners.js`: **343 lines**
  - `contractProfile.js`: **615 lines**
- Practical hierarchy:

```text
contractScripts.js  [CJS compatibility barrel for jest.spyOn]
  -> contractScripts.impl.js  [main export object + shared helpers]
     -> createContractHelperMethods(...)      [provider/block-window/cache helpers]
     -> createContractEventListenerMethods(...) [SBT/survey listener wiring]
     -> createContractProfileMethods(...)     [SBT universe + user activity/profile scans]
```

- Summary: `contractScripts` is the web3 integration layer that sits between React and chain/Arweave/Lit state. The large `contractScripts.impl.js` file still owns session resolution, provider selection, Arweave fetch/upload, decrypt gating, transaction submission, SBT CRUD/claim flows, and the final default export. The split helper modules carve out the most reusable read helpers, listener wiring, and profile scans.

## Navigation Rules
- Start in `contractScripts.js` only if you need barrel-export behavior or `jest.spyOn` compatibility.
- Start in `contractHelpers.js` for block windows, latest block/gas, read-provider behavior, or faucet helpers.
- Start in `contractEventListeners.js` for long-lived listeners and cleanup.
- Start in `contractProfile.js` for user-profile scans, SBT universe discovery, or memoized per-user holdings.
- Start in `contractScripts.impl.js` for everything else: Arweave metadata IO, decrypt policy, survey/question reads, tx submission, SBT creation/claim flows, and the dependency wiring that composes the split modules.

## File Index

### `contractScripts.js`
| Section | Lines | Purpose | Key Exports |
|---|---:|---|---|
| Module header | 1-7 | Explains why the barrel stays CJS-style | `default`, `getSessionConfigBySlug`, `getReadProviderForGroup` |
| `_impl` bridge + named re-exports | 9-35 | Re-exports configurable properties for Jest spying | `default`, `normalizeSessionSlug`, `getSessionConfigBySlugOrDefault`, `__test__contractScripts*` |

### `contractScripts.impl.js`
| Section | Lines | Purpose | Key Methods / Helpers |
|---|---:|---|---|
| Imports and constants | 1-117 | ABI imports, worker/Arweave/Lit/session deps, gas fallback constants, listener maps | `GAS_FALLBACKS`, `sbtListenerMap`, `surveyListenerMap` |
| Retry, decrypt, and gate helpers | 118-884 | RPC retry wrapper, decrypt context, gate-aware decrypt suppression, response normalization | `recordRateLimitError`, `decryptEnvelopeCached`, `shouldAttemptGateDecrypt`, `maybeDecryptSurveyPayload`, `maybeDecryptQuestionPayload`, `callWithRetry` |
| Session config and provider resolution | 885-2525 | Session lookup, demo fallback, chain/provider selection, PATH RPC policy, error summarization, session block window helpers | `resolveSession`, `normalizeSessionSlug`, `getSessionConfigBySlug`, `getReadProviderForGroup`, `fetchLogsSmartWithProvider` |
| Read caches and dependency wiring | 2526-3585 | Lightweight Arweave/hash/inflight caches, scope helpers, cache invalidation, dependency bundles for split modules | `READ_MEMO`, `READ_INFLIGHT`, `downloadArweaveTextForGroup`, `clearReadCachesForGroup`, `contractHelperDeps` |
| Mixed-in helper/event entry points | 3586-3604 | Default export bootstrap, cache invalidation, helper spreads | `invalidateReadCachesForGroup`, `...createContractHelperMethods(...)`, `...createContractEventListenerMethods(...)` |
| Question/survey event scans and response lookups | 3605-4457 | Survey/question ID scans, response log aggregation, address-centric history queries | `fetchAllQuestionIDs`, `getAllQuestionIDsChunkedWithCallback`, `getQuestionResponsesChunkedWithCallback`, `getQuestionResponsesByAddress`, `fetchUserSubmittedSurveyIDs`, `fetchAllSurveyResponses` |
| Arweave metadata reads and survey/question writes | 4458-5515 | Metadata fetch/decrypt, upload + submit flows, response hash/data reads | `getSurveyDataById`, `getSurveyResponse`, `addSurveyWithQuestions`, `addQuestions`, `submitResponses`, `getResponse`, `getQuestionData`, `getSurveyData` |
| SBT creation, discovery, metadata, and claim flows | 5516-6957 | SBT factory txs, SBT metadata fetch, password/invite/group-signature claims, `SBTActivity` history reads, summary-count reads, ownership checks | `createSBT`, `getSbtsCreated`, `getSbtMetadata`, `claimWithInvite`, `getGroupPasswordHash`, `mintWithGroupSignature`, `getSbtHistorySummary`, `userHasSBT`, `getSbtMintBurnCountsByAddress` |
| Profile mixin, provider utilities, test exports | 6958-7070 | Profile-method spread, signer-provider selection, BigNumber helpers, exported test seams | `...createContractProfileMethods(...)`, `getProviderLocation`, `decimalEighteen`, `__test__contractScriptsArweaveCache`, `export default contractScripts` |

### `contractHelpers.js`
| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Module header + dependency intake | 1-39 | Declares helper role and destructures shared deps | `createContractHelperMethods` |
| Block/gas/provider cache helpers | 40-192 | Cached latest block, gas price, and per-block read memo | `getLatestBlockNumber`, `getGasPrice`, `getBlockWithCaching` |
| Smart log fetch + native balance helper | 193-254 | Range-splitting `getLogs` plus wallet native-balance reads | `fetchLogsSmart`, `getNativeBalance` |
| Session block-window policy | 255-335 | Resolves `blockLimits.start/end`, session scope skips, registry fallback | `getRelevantBlockWindowForFilter` |
| Worker-side faucet + display formatting | 336-427 | Requests test ETH via worker auth and formats gas price for UI | `sendTestnetFunds`, `getGasPriceToDisplay` |

### `contractEventListeners.js`
| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Module header + dependency intake | 1-26 | Declares listener specialization and shared deps | `createContractEventListenerMethods` |
| SBT factory listeners | 27-77 | Attach/remove `SBTCreated` listeners per factory address + chain | `listenForSBTEvents`, `removeSBTEventListener` |
| SBT instance listeners | 79-248 | Attach/remove per-SBT `SBTActivity` listeners with registry dedupe | `listenForSBTInstanceEvents`, `removeSBTInstanceEventsListener` |
| Survey contract listeners | 250-342 | Attach/remove `SurveyAdded`, `QuestionsAdded`, `ResponsesSubmitted` listeners | `listenForSurveyEvents`, `removeSurveyEventsListener` |

### `contractProfile.js`
| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Module header + dependency intake | 1-34 | Declares profile/discovery specialization and shared deps | `createContractProfileMethods` |
| Token owner lookups | 35-87 | Reads owner/token relationships for an SBT | `getSBTTokenIdByOwner`, `getOwnerByTokenId` |
| SBT universe + net holdings memo | 89-296 | Discovers session SBT universe and computes per-user holdings with memoized log scans | `getAllSbtAddressesCached`, `getUserSbtNetHoldings` |
| Minimal SBT profile views | 298-435 | Builds user-facing SBT summaries, optionally with metadata | `getUserSBTsMinimal`, `getSBTsForUser` |
| Cross-domain user activity aggregation | 437-577 | Gathers SBTs, authored surveys/questions, and response history | `getUserActivity` |

## Method Index (Grouped by Responsibility)

### Session, chain, and provider resolution
- `resolveSession` (`contractScripts.impl.js`: 895-949)
- `normalizeSessionSlug` (`contractScripts.impl.js`: 979-988)
- `getSessionConfigBySlug` (`contractScripts.impl.js`: 1003-1022)
- `getSessionConfigBySlugOrDefault` (`contractScripts.impl.js`: 1029-1035)
- `getSessionChainId` (`contractScripts.impl.js`: 1176-1185)
- `getSessionNetwork` (`contractScripts.impl.js`: 1187-1201)
- `getSessionAddresses` (`contractScripts.impl.js`: 1701-1764)
- `_getCachedProvider` (`contractScripts.impl.js`: 1926-2082)
- `getReadProviderForGroup` (`contractScripts.impl.js`: 2093-2119)

### RPC, log-range, and Arweave/cache plumbing
- `callWithRetry` (`contractScripts.impl.js`: 867-883)
- `fetchLogsSmartWithProvider` (`contractScripts.impl.js`: 2331-2524)
- `downloadArweaveTextForGroup` (`contractScripts.impl.js`: 3342-3494)
- `clearReadCachesForGroup` (`contractScripts.impl.js`: 3496-3517)
- `getLatestBlockNumber` (`contractHelpers.js`: 40-104)
- `getRelevantBlockWindowForFilter` (`contractHelpers.js`: 255-335)

### Survey/question discovery and response scans
- `fetchAllQuestionIDs` (`contractScripts.impl.js`: 3605-3647)
- `getAllQuestionIDsChunkedWithCallback` (`contractScripts.impl.js`: 3649-3772)
- `getResponsesByQuestionID` (`contractScripts.impl.js`: 3774-3845)
- `getSurveyResponsesByAddress` (`contractScripts.impl.js`: 3958-3992)
- `getSurveyResponses` (`contractScripts.impl.js`: 3994-4037)
- `getQuestionResponses` (`contractScripts.impl.js`: 4073-4143)
- `getQuestionResponsesChunkedWithCallback` (`contractScripts.impl.js`: 4145-4282)
- `getQuestionResponsesByAddress` (`contractScripts.impl.js`: 4326-4399)
- `fetchAllSurveyResponses` (`contractScripts.impl.js`: 4458-4542)

### Survey/question metadata reads and writes
- `getSurveyDataById` (`contractScripts.impl.js`: 4544-4617)
- `getSurveyResponse` (`contractScripts.impl.js`: 4619-4625)
- `addSurveyWithQuestions` (`contractScripts.impl.js`: 4627-4745)
- `addQuestions` (`contractScripts.impl.js`: 4747-4854)
- `submitResponses` (`contractScripts.impl.js`: 4856-5007)
- `getResponseHash` (`contractScripts.impl.js`: 5009-5064)
- `getResponse` (`contractScripts.impl.js`: 5066-5158)
- `getQuestionHash` (`contractScripts.impl.js`: 5160-5237)
- `getSurveyHash` (`contractScripts.impl.js`: 5239-5318)
- `getQuestionData` (`contractScripts.impl.js`: 5358-5434)
- `decryptQuestionPayloadInPlace` (`contractScripts.impl.js`: 5436-5439)
- `decryptSurveyPayloadInPlace` (`contractScripts.impl.js`: 5441-5444)
- `getSurveyData` (`contractScripts.impl.js`: 5446-5514)

### SBT creation, metadata, and claim workflows
- `createSBT` (`contractScripts.impl.js`: 5516-5625)
- `countSBTCreated` (`contractScripts.impl.js`: 5627-5649)
- `getSbtsCreated` (`contractScripts.impl.js`: 5651-5733)
- `getSbtCreationBlockByAddress` (`contractScripts.impl.js`: 5735-5795)
- `getSbtMintBurnCountsByAddress` (`contractScripts.impl.js`: 6150-6348)
- `getSBTsByUserAddress` (`contractScripts.impl.js`: 5956-5977)
- `getSbtMetadata` (`contractScripts.impl.js`: 5979-6299)
- `startClaim` (`contractScripts.impl.js`: 6301-6319)
- `claimWithPassword` (`contractScripts.impl.js`: 6321-6339)
- `claimWithInvite` (`contractScripts.impl.js`: 6341-6517)
- `isPasswordValid` (`contractScripts.impl.js`: 6519-6548)
- `computeGroupPasswordHash` (`contractScripts.impl.js`: 6556-6558)
- `signGroupMintAuthorization` (`contractScripts.impl.js`: 6561-6575)
- `generateInvitePayloads` (`contractScripts.impl.js`: 6577-6610)
- `getGroupPasswordHash` (`contractScripts.impl.js`: 6612-6641)
- `getMintedTokens` (`contractScripts.impl.js`: 6643-6672)
- `computeGroupMintMessageHash` (`contractScripts.impl.js`: 6674-6676)
- `mintWithGroupSignature` (`contractScripts.impl.js`: 6678-6701)
- `claim` (`contractScripts.impl.js`: 6703-6721)
- `addHashedPasswords` (`contractScripts.impl.js`: 6746-6764)
- `burnToken` (`contractScripts.impl.js`: 6766-6785)
- `userHasSBT` (`contractScripts.impl.js`: 6787-6841)
- `getSbtHistorySummary` (`contractScripts.impl.js`: 7089-7119)
- `userCanBurnSBTs` (`contractScripts.impl.js`: 7286-7299)
- `getAddressesWhoMintedSBT` (`contractScripts.impl.js`: 7301-7310)
- `getAddressesWhoBurnedSBT` (`contractScripts.impl.js`: 7312-7321)

### Listener and profile mixins
- `listenForSBTEvents` (`contractEventListeners.js`: 27-58)
- `listenForSBTInstanceEvents` (`contractEventListeners.js`: 79-180)
- `listenForSurveyEvents` (`contractEventListeners.js`: 250-320)
- `getAllSbtAddressesCached` (`contractProfile.js`: 89-167)
- `getUserSbtNetHoldings` (`contractProfile.js`: 169-296)
- `getUserSBTsMinimal` (`contractProfile.js`: 298-397)
- `getUserActivity` (`contractProfile.js`: 437-577)

## Architecture Flows

### Read path (survey/question metadata)
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

### Write path (survey/question response submission)
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
- If a bug is about stale reads, dedupe, or "why is this still cached?", inspect `READ_MEMO`, `READ_INFLIGHT`, and `clearReadCachesForGroup` in `contractScripts.impl.js`.
- If a bug is about missing results because of session scoping, inspect `getRelevantBlockWindowForFilter` in `contractHelpers.js` plus the scope helpers in `contractScripts.impl.js`.
- If a bug is about masked metadata not decrypting, inspect `shouldAttemptGateDecrypt`, `maybeDecryptQuestionPayload`, `maybeDecryptSurveyPayload`, and the `get*Data` methods in `contractScripts.impl.js`.
- If a bug is about listeners double-firing or leaking, inspect `contractEventListeners.js` before touching `MainSite`.
- If a bug is about profile or SBT universe scans, inspect `contractProfile.js` before expanding `contractScripts.impl.js`.
- If a test needs to spy on named exports, remember the stable entry point is still `contractScripts.js`, not `contractScripts.impl.js`.
