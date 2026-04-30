# MainSite.jsx Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.jsx`
- About route lazy view: `client/src/components/About/AboutPage.tsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.tsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.tsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.tsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.tsx`, `client/src/components/DemoViews/RiskMatrixDemo.tsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.tsx` (mounted by `client/src/components/Navbar/AccountSection.tsx`, outside the route-lazy map)
- Current length: **6,274 lines** (down from 11,465)
- Component type: **React class component** (`MainSite extends Component`)
- Component count in file: **1 class component** (`MainSite`)
- Method inventory: **~212 class members**
- Summary: `MainSite` is the app shell and runtime orchestrator. It resolves active session/group context from URL + Redux, hydrates multi-cache state (SBT/surveys/questions/responses), drives profile deep scans and registry hydration, manages per-group listener lifecycles, coordinates Lit/session metadata refresh, and routes to lazy feature views while gating UI readiness via cache flags.

## Extracted Modules

- `client/src/utilities/cache/sessionCacheReadinessController.js`
  Factory: `createSessionCacheReadinessController(host)`
  Methods: `setReadinessStateIfChanged`, `syncCacheHasLoadedFlagOnTransition`, `scheduleCacheUpdateFlush`, `queueCacheUpdateFlush`, `flushQueuedCacheUpdates`, `queueLocalRevisionUpdate`, `flushLocalRevisionUpdate`, `handleCrossTabCacheUpdateEvent`, `destroy`
  Test: `sessionCacheReadinessController.test.js` (26 tests)
- `client/src/utilities/cache/sessionCachePersistenceController.js`
  Factory: `createSessionCachePersistenceController(host)`
  Methods: `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent`, `destroy`
  Test: `sessionCachePersistenceController.test.js` (11 tests)
- `client/src/utilities/cache/mainSiteDgStorage.js`
  Factory: `createMainSiteDgStorage()`
  Methods: `key`, `read`, `write`, `remove`, `destroy`
  Test: `mainSiteDgStorage.test.js` (5 tests)
  Note: no host DI — all dependencies are module imports
- `client/src/utilities/session/mainSiteSessionScanPolicy.js`
  Factory: `createSessionScanPolicy(host)`
  Pattern: Factory with host dependency injection
  Host interface: `getActiveSessionSlug()`, `getCurrentPath()`, `getSessionSlugHintFromSearch(search)`, `getSessionTokenFromPath(path)`, `isSbtListRoutePath(path)`
  Public methods: `isSbtInstanceListenerEnabledForGroup`, `isSbtHistoryScanEnabled`, `getSessionScanScope`, `getSessionScanScopeContext`, `shouldAutoRunFullSbtScan`, `shouldAttachSbtDetailInstanceListener`, `getScopedSessionSlugs`, `shouldSkipSessionScanForSlug`, `scanScopeNoop`, `getScopeFilteredSlugs`, `isSessionSlugAllowedForScan`, `logScopeSkipOnce`, `destroy`
  Internal state: `didLogSessionScanScope` (once flag), `didLogSbtInstanceListenersSuppressed` (once flag), `scopeSkipLogOnce` (Set)
  Test: `mainSiteSessionScanPolicy.test.js` (17 tests)
  What stays in MainSite: scan/cache entrypoints that consume scope decisions, plus the forwarding wrappers that expose policy methods on the class
- `client/src/utilities/session/sessionProfileScanController.js`
  Factory: `createSessionProfileScanController(host)`
  Pattern: Factory with host dependency injection
  Host interface: `getAccount()`, `getActiveSessionSlug()`, `getNetworkId()`, `getProvider()`, `getScopeFilteredSlugs()`, `getScopedSessionSlugs()`, `getSessionCfg()`, `getSessionChainId()`, `getSessionScanScopeContext()`, `getSessionSlugFromState()`, `isMounted()`, `isSessionSlugAllowedForScan()`, `scanSpecificUserProfile()`
  Public methods: `hasExplicitProfileScanScopeOverride`, `getProfileScanScopeContext`, `readBoolishRuntimeFlag`, `getUserProfileAllSessionsScanMode`, `isUserProfileAllSessionsScanEnabled`, `getActiveProfileScanChainId`, `readProfileScanStepTimeoutMs`, `readProfileScanSbtBurstSize`, `readProfileScanActivityLookbackBlocks`, `readUserProfileAllSessionsFlag`, `readProfileScanRegistryLookupTimeoutMs`, `getRegistrySessionEntryCount`, `getRegistrySessionCoverageCountForChain`, `getRegistryBootstrapScopeKey`, `getProfileScanListScopeSessionConfigCacheKey`, `resolveListScopeSessionConfigFromRegistry`, `ensureRegistryHydratedForProfileScan`, `isOnchainSessionRegistryEnabled`, `refreshSessionUniverseRegistryCache`, `resolveProfileDeepScanPlan`, `getProfileDeepScanSlugs`, `scheduleProfileScanRetryAfterRegistryHydration`, `shouldBackfillGeneralSession`, `enqueueGeneralSessionBackfill`, `runWithGeneralSessionBackfill`, `emitProfileScanTelemetry`, `isProfileScanTelemetryEnabled`, `isProfileScanColdDiagEnabled`, `emitProfileScanColdDiag`, `destroy`
  Internal state: `_registryBootstrapPromise`, `_registryBootstrapScopeKey`, `_profileScanRetryAfterRegistry`, `_generalBackfillQueue`, `_profileScanListScopeSessionConfigCache`
  What stays in MainSite: `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` (full implementations / cache writes), plus forwarding wrappers that delegate into the controller and `_registryBootstrapPromise` / `_registryBootstrapScopeKey` bridge accessors for extracted controller state

- `client/src/components/MainSite/metadataSessionBinding.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `resolveMetadataSessionBinding`, `resolveMetadataSessionSlug`, `resolveScopedMetadataSessionSlug`, `buildMetadataSessionCacheEnvelope`
  Types: `MetadataSessionAuthority`, `MetadataSessionBinding`, `MetadataSessionCacheEnvelope`, `BuildEnvelopeOptions`
  Test: `metadataSessionBinding.test.ts` (20 tests)
  Dependencies: `normalizeSessionSlug` (sessionNaming), `getSessionSlugByName` (sessionConfigResolvers)
  What stays in MainSite: `writeSurveyMetadataToCache`, `writeQuestionMetadataToCache`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` (all call through forwarding wrappers)
- `client/src/components/MainSite/metadataCacheEntryBuilders.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `prepareSurveyMetadataCacheEntry`, `prepareQuestionMetadataCacheEntry`
  Types: `PrepareSurveyMetadataCacheEntryArgs`, `PrepareQuestionMetadataCacheEntryArgs`
  Test: `metadataCacheEntryBuilders.test.ts`
  Dependencies: `buildMetadataSessionCacheEnvelope` (metadataSessionBinding), `normalizeSessionSlug` (sessionNaming)
  What stays in MainSite: `writeSurveyMetadataToCache` (DG write, bucket init), `writeQuestionMetadataToCache` (DG write, bucket init)
- `client/src/utilities/survey/sessionSurveyCacheController.js`
  Factory: `createSessionSurveyCacheController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionSurveyCacheController.test.js` (19 tests)
- `client/src/utilities/survey/sessionQuestionCacheController.js`
  Factory: `createSessionQuestionCacheController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionQuestionCacheController.test.js` (27 tests)
- `client/src/utilities/survey/sessionResponseHydrationController.js`
  Factory: `createSessionResponseHydrationController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionResponseHydrationController.test.js` (24 tests)
- `client/src/utilities/sbt/sessionSbtCacheController.js`
  Factory: `createSessionSbtCacheController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionSbtCacheController.test.js` (29 tests)

All extracted controllers use a factory-function + host-DI pattern (or pure exports for session config / metadata binding). `MainSite` now wires cache/readiness, scan-policy, profile-scan, survey, question, response, and SBT controllers as class-field initializers, leaving route orchestration, deep scans, and a smaller set of event/view methods inline.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-215 | Dependencies, perf helpers, cache utility helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + instance fields | 216-599 | Main runtime state plus controller wiring, host-DI setup, and internal run tokens/queues | `state`, `_cachePersistenceController`, `_cacheReadinessController`, `_scanPolicy`, `_profileScanController`, `_sbtCacheController` |
| Cache management, reinit, and cross-tab coalescing | 600-683 | Cache key normalization, cache reinit run tracking, debounced readiness/cache updates, cross-tab sync handling, and queued survey scan orchestration | `mergeLegacyNumericNetworkKey`, `startCacheReinitRun`, `flushQueuedCacheUpdates`, `handleCrossTabCacheUpdateEvent`, `queueSurveyGroupScan` |
| Session path/slug resolution | 684-1760 | Parse `/session/:token`, resolve ids/slugs, locate groups for surveys/questions/SBT links, and hydrate path-driven registry lookups | `resolveSessionPathId`, `resolveSessionPathSlug`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| DG storage abstraction | 1761-1761 | Per-group storage facade over cache manager/localStorage | `DG.key`, `DG.read`, `DG.write`, `DG.remove` |
| Session config + scan policy + registry bootstrap | 1764-1817 | Chain/session helpers, scope controls, and forwarding wrappers into the extracted profile-scan controller for telemetry, registry hydration, deep-scan planning, and general-session backfill | `getSessionCfg`, `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `resolveProfileDeepScanPlan`, `runWithGeneralSessionBackfill` |
| Deep scans (survey lookup + user profile) | 1818-3396 | Cross-group survey discovery + full activity/SBT profile scanning with cache merges | `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` |
| Persistent readiness flags | 3397-3401 | Read/write per-slug flags and sync `cacheHasLoaded` from persisted state | `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent` |
| Mount/unmount lifecycle | 3403-3883 | Boot sequence, initial cache strategy by route, listener startup, cleanup | `componentDidMount`, `componentWillUnmount` |
| Update lifecycle + deep-link/network handlers | 3885-4435 | React to slug/network/path changes, trigger deep-link scans, readiness recompute, and handle full cache reinit on network changes | `componentDidUpdate`, `handleDeepLinkScan`, `manageAutoHashPersistence`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 4436-4496 | Forwarding wrappers into the extracted SBT cache controller for discovery, refresh, and listener/event handling | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `refreshSbtDataForGroup`, `startSbtEventListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question cache initialization and listeners | 4497-4970 | General-session backfill entrypoints into extracted survey/question/response controllers plus inline survey event reconciliation | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup`, `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + child prop composition | 4977-6165 | Route helpers (`_render*Route`) and main view dispatch with prop wiring into lazy views | `_renderDebateRoute`, `getMainView` |
| Final metadata refresh + render | 6168-6222 | Final refresh helpers, faucet action, and root shell render | `refreshSurveyResponsesByIDForGroup`, `refreshQuestionMetadataForGroup`, `refreshQuestionResponses`, `render` |
| PropTypes + Redux connect | 6224-6274 | Type contracts and `connect(...)` wiring | `MainSite.propTypes`, `mapStateToProps` |

## Method Index (Grouped by Responsibility)

### Cache and readiness orchestration
- `mergeLegacyNumericNetworkKey` (600-614)
- `startCacheReinitRun` (616-621)
- `isCacheReinitRunActive` (623-625)
- `resolveActiveSlugForCacheUpdates` (627-642)
- `setReadinessStateIfChanged` (644-644)
- `syncCacheHasLoadedFlagOnTransition` (646-646)
- `scheduleCacheUpdateFlush` (648-648)
- `queueCacheUpdateFlush` (650-650)
- `flushQueuedCacheUpdates` (652-652)
- `queueLocalRevisionUpdate` (654-654)
- `flushLocalRevisionUpdate` (656-656)
- `handleCrossTabCacheUpdateEvent` (658-658)
- `hasPersistedManagedCacheData` (3400-3400)
- `syncCacheHasLoadedFlagFromPersistent` (3401-3401)
- `checkAllCachesReady` (4393-4434)

### Session routing and group resolution
- `getSessionTokenFromPath` (684-688)
- `resolveSessionSlugFromPathToken` (690-702)
- `resolveSessionPathId` (704-814)
- `resolveSessionPathSlug` (816-905)
- `getInitialGroupSlugFromPath` (907-916)
- `getSessionSlugFromProps` (968-989)
- `getSessionSlugFromState` (1038-1038)
- `getActiveSessionSlug` (1040-1042)
- `getSbtAddressFromPath` (1120-1127)
- `getUserAddressFromPath` (1155-1166)
- `findGroupSlugForSurvey` (1495-1566)
- `getQuestionRouteSessionSlugHint` (1580-1587)
- `getQuestionRouteSessionIdHint` (1589-1601)
- `findGroupSlugForQuestion` (1603-1672)
- `resolveGroupSlugForSbtAddress` (1674-1754)
- `handleDeepLinkScan` (4156-4193)
- `manageAutoHashPersistence` (4198-4237)

### Session metadata + Lit + gated prompt recovery
- `syncLitHooks` (1180-1213)
- `getSessionInfoForGroup` (1215-1231)
- `getSessionNameForGroup` (1233-1249)
- `hasEncryptedSessionField` (1251-1270)
- `getSessionHeaderForGroup` (1272-1301)
- `refreshSessionInfo` (1303-1326)
- `refreshSessionMetaFields` (1328-1360)
- `refreshGroupCredentials` (1362-1366)
- `resolveMetadataSessionBinding` (1392-1394) — forwarding wrapper → `metadataSessionBinding.ts`
- `resolveMetadataSessionSlug` (1396-1398) — forwarding wrapper → `metadataSessionBinding.ts`
- `resolveScopedMetadataSessionSlug` (1400-1402) — forwarding wrapper → `metadataSessionBinding.ts`
- `buildMetadataSessionCacheEnvelope` (1404-1406) — forwarding wrapper → `metadataSessionBinding.ts`
- `hasMaskedQuestionPayloadInCache` (6180-6180)
- `buildQuestionDecryptContext` (6182-6182)
- `refreshEncryptedQuestionPayloadsForGroup` (6184-6184)
- `refreshQuestionMetadataForGroup` (6186-6186)

### Scan scope, registry hydration, and deep scan planning
Most profile-scan / registry helpers in this block now forward into `client/src/utilities/session/sessionProfileScanController.js`; the full scan bodies remain in `scanForSurveyGroup` and `scanSpecificUserProfile*`.

- `getSessionCfg` (1764-1764)
- `getSessionChainId` (1765-1765)
- `getSessionNetwork` (1766-1766)
- `isSbtInstanceListenerEnabledForGroup` (1768-1768)
- `isSbtHistoryScanEnabled` (1769-1769)
- `getSessionScanScope` (1770-1770)
- `getSessionScanScopeContext` (1771-1771)
- `hasExplicitProfileScanScopeOverride` (1772-1772) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileScanScopeContext` (1773-1773) — forwarding wrapper → `sessionProfileScanController.js`
- `isSessionSlugAllowedForScan` (1775-1777)
- `shouldAutoRunFullSbtScan` (1781-1781)
- `shouldAttachSbtDetailInstanceListener` (1782-1782)
- `readBoolishRuntimeFlag` (1784-1784) — forwarding wrapper → `sessionProfileScanController.js`
- `isProfileScanTelemetryEnabled` (1785-1785) — forwarding wrapper → `sessionProfileScanController.js`
- `emitProfileScanTelemetry` (1786-1786) — forwarding wrapper → `sessionProfileScanController.js`
- `isProfileScanColdDiagEnabled` (1787-1787) — forwarding wrapper → `sessionProfileScanController.js`
- `emitProfileScanColdDiag` (1788-1788) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanStepTimeoutMs` (1789-1789) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanSbtBurstSize` (1790-1790) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanActivityLookbackBlocks` (1791-1791) — forwarding wrapper → `sessionProfileScanController.js`
- `readUserProfileAllSessionsFlag` (1792-1792) — forwarding wrapper → `sessionProfileScanController.js`
- `getUserProfileAllSessionsScanMode` (1793-1793) — forwarding wrapper → `sessionProfileScanController.js`
- `isUserProfileAllSessionsScanEnabled` (1794-1794) — forwarding wrapper → `sessionProfileScanController.js`
- `getActiveProfileScanChainId` (1795-1795) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistrySessionEntryCount` (1796-1796) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistrySessionCoverageCountForChain` (1797-1797) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistryBootstrapScopeKey` (1798-1798) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanRegistryLookupTimeoutMs` (1799-1799) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileScanListScopeSessionConfigCacheKey` (1800-1800) — forwarding wrapper → `sessionProfileScanController.js`
- `resolveListScopeSessionConfigFromRegistry` (1801-1801) — forwarding wrapper → `sessionProfileScanController.js`
- `ensureRegistryHydratedForProfileScan` (1802-1802) — forwarding wrapper → `sessionProfileScanController.js`
- `isOnchainSessionRegistryEnabled` (1803-1803) — forwarding wrapper → `sessionProfileScanController.js`
- `refreshSessionUniverseRegistryCache` (1804-1804) — forwarding wrapper → `sessionProfileScanController.js`
- `resolveProfileDeepScanPlan` (1805-1805) — forwarding wrapper → `sessionProfileScanController.js`
- `scheduleProfileScanRetryAfterRegistryHydration` (1806-1806) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileDeepScanSlugs` (1807-1807) — forwarding wrapper → `sessionProfileScanController.js`
- `getScopeFilteredSlugs` (1813-1813)
- `shouldBackfillGeneralSession` (1814-1814) — forwarding wrapper → `sessionProfileScanController.js`
- `enqueueGeneralSessionBackfill` (1815-1815) — forwarding wrapper → `sessionProfileScanController.js`
- `runWithGeneralSessionBackfill` (1816-1816) — forwarding wrapper → `sessionProfileScanController.js`
- `scanForSurveyGroup` (1818-2019)
- `scanSpecificUserProfilePriority` (2023-2043)
- `scanSpecificUserProfile` (2045-3394)

### SBT cache and event pipeline
- `ensureLightSbtDiscovery` (4441-4441)
- `ensureLightSbtUniverse` (4443-4443)
- `mergeSbtCountMaps` (4445-4445)
- `mergeSbtCountsPayload` (4447-4447)
- `initializeSbtCache` (4463-4463)
- `initializeSbtCacheWithGeneralBackfill` (4465-4465)
- `initializeSbtCacheForGroup` (4467-4467)
- `refreshSbtDataForGroup` (4471-4471)
- `startSbtEventListenerForGroup` (4475-4475)
- `onNewSbtEventDetectedForGroup` (4479-4479)
- `onSbtCreatedDetectedForGroup` (4483-4483)
- `onSbtIssuedDetectedForGroup` (4487-4487)
- `onSbtTransferDetectedForGroup` (4495-4495)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (4510-4510)
- `initializeQuestionCacheForGroup` (4526-4526)
- `fetchQuestionResponsesChunkedForGroup` (4541-4543)
- `startSurveyAndQuestionEventListenerForGroup` (4547-4554)
- `onNewSurveyEventDetectedForGroup` (4559-4970)
- `refreshSurveyResponsesByIDForGroup` (6176-6176)
- `refreshQuestionResponses` (6188-6188)

### Lifecycle and view routing
- `componentDidMount` (3403-3811)
- `componentWillUnmount` (3813-3883)
- `componentDidUpdate` (3885-4154)
- `handleNetworkChange` (4240-4391)
- `getMainView` (5946-6165)
- `render` (6190-6219)

## Data Flow (Runtime)

```text
URL + Redux sessionState + wallet/network
  -> session/path resolvers
     (`resolveSessionPathSlug`, `getActiveSessionSlug`)
  -> mount/update orchestrators
     (`componentDidMount`, `componentDidUpdate`, `handleNetworkChange`)
  -> cache init stages
     SBT -> surveys -> questions -> responses
  -> readiness consolidation
     (`setReadinessStateIfChanged`, `checkAllCachesReady`)
  -> listener startup
     SBT listeners + survey/question listeners
  -> view router
     (`getMainView`) passes cache flags/nonces to lazy children
  -> child actions feed back
     refresh handlers mutate caches + bump revisions/nonces
```

## State Machine (Key Gates)

| State variable | Meaning | Gates / side effects |
|---|---|---|
| `isSBTCacheReady` | SBT cache usable for current slug | Unblocks SBT-dependent UI and contributes to `isAllCachesReady` |
| `isSurveyCacheReady` | Survey cache usable | Unblocks survey listing/results and contributes to `isAllCachesReady` |
| `isQuestionCacheReady` | Question cache usable | Unblocks question/pile flows and contributes to `isAllCachesReady` |
| `isResponsesCacheReady` | Question response cache hydrated | Controls response-dependent UI refresh and nonce behavior |
| `isAllCachesReady` | Composite readiness across SBT/survey/question | Gates full route rendering behavior and deferred SBT full-scan trigger |
| `cacheHasLoaded` | Persisted per-slug “usable cache exists” marker | Prevents blank fallback while async cache init is still warming |
| `questionResponsesNonce` | Response refresh counter | Forces child recomputation/re-read after response merges |
| `questionScanProgress` | Incremental hydration progress payload | Powers loading/progress UI in question-focused views |
| `sbtCacheRevision` | SBT cache revision counter | Forces SBT label/count refresh in children |
| `isScanningForGroup` | Current deep-link survey/group scan target | Prevents duplicate deep-link scans |
| `scanFailedFor` | Last deep-link target confirmed absent | Prevents retry loops until context changes |
| `sbtDetailGroupSlug` / `sbtDetailAddress` | Current `/sbt/:address` detail context | Enables SBT-first detail loading and scoped listener behavior |
| `sessionPathResolutionNonce` | Session path re-resolution token | Forces rerender consumers when async path token->slug resolution completes |
| `isCacheManagerReady` | Cache manager initialized | Used by route guards before trusting cache-derived routing decisions |

## Cache Lifecycle (MainSite)

```text
Boot
  -> resolve slug/network
  -> read persisted cacheHasLoaded flag
  -> initialize caches (route-aware order)
  -> set readiness flags + question/sbt revisions
  -> start listeners
  -> coalesce incremental updates across tabs
  -> periodic/deferred refresh (deep scans, metadata retries)
  -> unmount/network switch cleanup (timers/listeners/retry queues)
```
