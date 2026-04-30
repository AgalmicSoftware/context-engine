# MainSite Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.jsx`
- About route lazy view: `client/src/components/About/AboutPage.tsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.tsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.tsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.tsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.tsx`, `client/src/components/DemoViews/RiskMatrixDemo.tsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.tsx` (mounted by `client/src/components/Navbar/AccountSection.tsx`, outside the route-lazy map)
- Current length: **11,465 lines**
- Component type: **React class component** (`MainSite extends Component`)
- Component count in file: **1 class component** (`MainSite`)
- Method inventory: **243 class methods/properties** + **3 top-level helper functions**
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

All extracted controllers use a factory-function + host-DI pattern (or pure exports for session config / metadata binding). `MainSite` creates them as class-field initializers and delegates through forwarding methods.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-264 | Dependencies, perf helpers, cache utility helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + instance fields | 265-696 | Main runtime state + internal run tokens/queues/controllers | `state`, `_cachePersistenceController`, `_cacheReadinessController`, `_scanPolicy`, `_profileScanController`, `DG` |
| Cache management, reinit, and cross-tab coalescing | 697-796 | Cache key normalization, cache reinit run tracking, debounced readiness/cache updates, and cross-tab sync handling | `mergeLegacyNumericNetworkKey`, `startCacheReinitRun`, `flushQueuedCacheUpdates`, `handleCrossTabCacheUpdateEvent` |
| Session path/slug resolution | 797-1871 | Parse `/session/:token`, resolve ids/slugs, locate groups for surveys/questions/SBT links | `resolveSessionPathId`, `resolveSessionPathSlug`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| DG storage abstraction | 1874-1874 | Per-group storage facade over cache manager/localStorage | `DG.key`, `DG.read`, `DG.write`, `DG.remove` |
| Session config + scan policy + registry bootstrap | 1877-1929 | Chain/session helpers, scope controls, and forwarding wrappers into the extracted profile-scan controller for telemetry, registry hydration, and deep-scan planning | `getSessionCfg`, `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `resolveProfileDeepScanPlan`, `runWithGeneralSessionBackfill` |
| Deep scans (survey lookup + user profile) | 1931-3509 | Cross-group survey discovery + full activity/SBT profile scanning with cache merges | `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` |
| Persistent readiness flags | 3511-3514 | Read/write per-slug flags and sync `cacheHasLoaded` from persisted state | `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent` |
| Mount/unmount lifecycle | 3516-4013 | Boot sequence, initial cache strategy by route, listener startup, cleanup | `componentDidMount`, `componentWillUnmount` |
| Update lifecycle + deep-link/network handlers | 4014-4606 | React to slug/network/path changes, trigger deep-link scans, readiness recompute | `componentDidUpdate`, `handleDeepLinkScan`, `manageAutoHashPersistence`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 4608-6642 | Light/full SBT discovery, SBT merge logic, listener/event handlers | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `refreshSbtDataForGroup`, `startSbtEventListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question cache initialization | 6644-9253 | Survey cache load + question cache load + chunked response hydration | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup` |
| Survey/question event listeners | 9255-10652 | Event subscriptions and cache refresh on new survey/question events | `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + child prop composition | 10654-11124 | Route dispatch and prop wiring into lazy views | `getMainView`, `refreshSurveyResponsesByIDForGroup`, `refreshEncryptedQuestionPayloadsForGroup` |
| Final metadata refresh + render | 11126-11413 | Final question refresh helpers and root shell render | `refreshQuestionMetadataForGroup`, `refreshQuestionResponses`, `render` |
| PropTypes + Redux connect | 11415-11465 | Type contracts and `connect(...)` wiring | `mapStateToProps` |

## Method Index (Grouped by Responsibility)

### Cache and readiness orchestration
- `mergeLegacyNumericNetworkKey` (672-686)
- `startCacheReinitRun` (688-693)
- `isCacheReinitRunActive` (695-697)
- `resolveActiveSlugForCacheUpdates` (699-714)
- `setReadinessStateIfChanged` (716-716)
- `syncCacheHasLoadedFlagOnTransition` (718-718)
- `scheduleCacheUpdateFlush` (720-720)
- `queueCacheUpdateFlush` (722-722)
- `flushQueuedCacheUpdates` (724-724)
- `queueLocalRevisionUpdate` (726-726)
- `flushLocalRevisionUpdate` (728-728)
- `handleCrossTabCacheUpdateEvent` (730-730)
- `hasPersistedManagedCacheData` (3513-3513)
- `syncCacheHasLoadedFlagFromPersistent` (3514-3514)
- `checkAllCachesReady` (4524-4606)

### Session routing and group resolution
- `getSessionTokenFromPath` (772-776)
- `resolveSessionSlugFromPathToken` (778-790)
- `resolveSessionPathId` (792-902)
- `resolveSessionPathSlug` (904-993)
- `getInitialGroupSlugFromPath` (995-1004)
- `getSessionSlugFromProps` (1056-1077)
- `getSessionSlugFromState` (1126)
- `getActiveSessionSlug` (1128-1130)
- `getSbtAddressFromPath` (1208-1215)
- `getUserAddressFromPath` (1243-1254)
- `findGroupSlugForSurvey` (1662-1733)
- `getQuestionRouteSessionSlugHint` (1747-1754)
- `getQuestionRouteSessionIdHint` (1756-1768)
- `findGroupSlugForQuestion` (1720-1789)
- `resolveGroupSlugForSbtAddress` (1791-1871)
- `handleDeepLinkScan` (4287-4327)
- `manageAutoHashPersistence` (4329-4369)

### Session metadata + Lit + gated prompt recovery
- `syncLitHooks` (1268-1301)
- `getSessionInfoForGroup` (1303-1319)
- `getSessionNameForGroup` (1321-1337)
- `hasEncryptedSessionField` (1339-1358)
- `getSessionHeaderForGroup` (1360-1389)
- `refreshSessionInfo` (1391-1414)
- `refreshSessionMetaFields` (1416-1448)
- `refreshGroupCredentials` (1450-1454)
- `resolveMetadataSessionBinding` (1486-1488) — forwarding wrapper → `metadataSessionBinding.ts`
- `resolveMetadataSessionSlug` (1490-1492) — forwarding wrapper → `metadataSessionBinding.ts`
- `resolveScopedMetadataSessionSlug` (1494-1496) — forwarding wrapper → `metadataSessionBinding.ts`
- `buildMetadataSessionCacheEnvelope` (1498-1500) — forwarding wrapper → `metadataSessionBinding.ts`
- `hasMaskedQuestionPayloadInCache` (10952-10959)
- `buildQuestionDecryptContext` (10961-10970)
- `refreshEncryptedQuestionPayloadsForGroup` (10972-11124)
- `refreshQuestionMetadataForGroup` (11126-11135)

### Scan scope, registry hydration, and deep scan planning
Most profile-scan / registry helpers in this block now forward into `client/src/utilities/session/sessionProfileScanController.js`; the full scan bodies remain in `scanForSurveyGroup` and `scanSpecificUserProfile*`.

- `getSessionCfg` (1877-1877)
- `getSessionChainId` (1878-1878)
- `getSessionNetwork` (1879-1879)
- `isSbtInstanceListenerEnabledForGroup` (1881-1881)
- `isSbtHistoryScanEnabled` (1882-1882)
- `getSessionScanScope` (1883-1883)
- `getSessionScanScopeContext` (1884-1884)
- `hasExplicitProfileScanScopeOverride` (1885-1885) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileScanScopeContext` (1886-1886) — forwarding wrapper → `sessionProfileScanController.js`
- `isSessionSlugAllowedForScan` (1888-1890)
- `shouldAutoRunFullSbtScan` (1894-1894)
- `shouldAttachSbtDetailInstanceListener` (1895-1895)
- `readBoolishRuntimeFlag` (1897-1897) — forwarding wrapper → `sessionProfileScanController.js`
- `isProfileScanTelemetryEnabled` (1898-1898) — forwarding wrapper → `sessionProfileScanController.js`
- `emitProfileScanTelemetry` (1899-1899) — forwarding wrapper → `sessionProfileScanController.js`
- `isProfileScanColdDiagEnabled` (1900-1900) — forwarding wrapper → `sessionProfileScanController.js`
- `emitProfileScanColdDiag` (1901-1901) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanStepTimeoutMs` (1902-1902) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanSbtBurstSize` (1903-1903) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanActivityLookbackBlocks` (1904-1904) — forwarding wrapper → `sessionProfileScanController.js`
- `readUserProfileAllSessionsFlag` (1905-1905) — forwarding wrapper → `sessionProfileScanController.js`
- `getUserProfileAllSessionsScanMode` (1906-1906) — forwarding wrapper → `sessionProfileScanController.js`
- `isUserProfileAllSessionsScanEnabled` (1907-1907) — forwarding wrapper → `sessionProfileScanController.js`
- `getActiveProfileScanChainId` (1908-1908) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistrySessionEntryCount` (1909-1909) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistrySessionCoverageCountForChain` (1910-1910) — forwarding wrapper → `sessionProfileScanController.js`
- `getRegistryBootstrapScopeKey` (1911-1911) — forwarding wrapper → `sessionProfileScanController.js`
- `readProfileScanRegistryLookupTimeoutMs` (1912-1912) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileScanListScopeSessionConfigCacheKey` (1913-1913) — forwarding wrapper → `sessionProfileScanController.js`
- `resolveListScopeSessionConfigFromRegistry` (1914-1914) — forwarding wrapper → `sessionProfileScanController.js`
- `ensureRegistryHydratedForProfileScan` (1915-1915) — forwarding wrapper → `sessionProfileScanController.js`
- `isOnchainSessionRegistryEnabled` (1916-1916) — forwarding wrapper → `sessionProfileScanController.js`
- `refreshSessionUniverseRegistryCache` (1917-1917) — forwarding wrapper → `sessionProfileScanController.js`
- `resolveProfileDeepScanPlan` (1918-1918) — forwarding wrapper → `sessionProfileScanController.js`
- `scheduleProfileScanRetryAfterRegistryHydration` (1919-1919) — forwarding wrapper → `sessionProfileScanController.js`
- `getProfileDeepScanSlugs` (1920-1920) — forwarding wrapper → `sessionProfileScanController.js`
- `getScopeFilteredSlugs` (1926-1926)
- `shouldBackfillGeneralSession` (1927-1927) — forwarding wrapper → `sessionProfileScanController.js`
- `enqueueGeneralSessionBackfill` (1928-1928) — forwarding wrapper → `sessionProfileScanController.js`
- `runWithGeneralSessionBackfill` (1929-1929) — forwarding wrapper → `sessionProfileScanController.js`
- `scanForSurveyGroup` (1931-2132)
- `scanSpecificUserProfilePriority` (2136-2156)
- `scanSpecificUserProfile` (2158-3507)

### SBT cache and event pipeline
- `ensureLightSbtDiscovery` (4608-4963)
- `ensureLightSbtUniverse` (4965-5014)
- `mergeSbtCountMaps` (5016-5027)
- `mergeSbtCountsPayload` (5029-5190)
- `initializeSbtCache` (5192-5194)
- `initializeSbtCacheWithGeneralBackfill` (5196-5208)
- `initializeSbtCacheForGroup` (5210-5775)
- `refreshSbtDataForGroup` (5777-6242)
- `startSbtEventListenerForGroup` (6244-6331)
- `onNewSbtEventDetectedForGroup` (6333-6417)
- `onSbtCreatedDetectedForGroup` (6419-6489)
- `onSbtIssuedDetectedForGroup` (6491-6624)
- `onSbtTransferDetectedForGroup` (6626-6642)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (6644-7196)
- `initializeQuestionCacheForGroup` (7198-8507)
- `fetchQuestionResponsesChunkedForGroup` (8509-9253)
- `startSurveyAndQuestionEventListenerForGroup` (9255-9265)
- `onNewSurveyEventDetectedForGroup` (9267-10652)
- `refreshSurveyResponsesByIDForGroup` (10884-10950)
- `refreshQuestionResponses` (11137-11379)

### Lifecycle and view routing
- `componentDidMount` (3516-3924)
- `componentWillUnmount` (3926-4012)
- `componentDidUpdate` (4014-4285)
- `handleNetworkChange` (4371-4522)
- `getMainView` (10654-10882)
- `render` (11381-11413)

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
