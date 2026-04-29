# MainSite.jsx Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.jsx`
- About route lazy view: `client/src/components/About/AboutPage.tsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.tsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.tsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.tsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.tsx`, `client/src/components/DemoViews/RiskMatrixDemo.tsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.tsx` (mounted by `client/src/components/Navbar/AccountSection.tsx`, outside the route-lazy map)
- Current length: **12,334 lines**
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
  What stays in MainSite: `shouldBackfillGeneralSession`, `enqueueGeneralSessionBackfill`, `runWithGeneralSessionBackfill`, `hasExplicitProfileScanScopeOverride`, `getProfileScanScopeContext`, profile-scan/registry methods

All extracted controllers use a factory-function + host-DI pattern (or pure exports for session config). `MainSite` creates them as class-field initializers and delegates through forwarding methods.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-270 | Dependencies, perf helpers, cache utility helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + instance fields | 271-364 | Main runtime state + internal run tokens/queues/controllers | `state`, `_cachePersistenceController`, `_cacheReadinessController`, `_scanPolicy`, `DG` |
| Cache flush + cross-tab coalescing | 366-769 | Debounced cache/readiness updates and cross-tab sync handling | `setReadinessStateIfChanged`, `scheduleCacheUpdateFlush`, `flushQueuedCacheUpdates`, `handleCrossTabCacheUpdateEvent` |
| Session path/slug resolution | 772-1921 | Parse `/session/:token`, resolve ids/slugs, locate groups for surveys/questions/SBT links | `resolveSessionPathId`, `resolveSessionPathSlug`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| DG storage abstraction | 1928-1928 | Per-group storage facade over cache manager/localStorage | `DG.key`, `DG.read`, `DG.write`, `DG.remove` |
| Session config + scan policy + registry bootstrap | 1931-2794 | Chain/session helpers, scope controls, telemetry, on-chain registry hydration, deep-scan planning | `getSessionCfg`, `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `resolveProfileDeepScanPlan`, `runWithGeneralSessionBackfill` |
| Deep scans (survey lookup + user profile) | 2796-4372 | Cross-group survey discovery + full activity/SBT profile scanning with cache merges | `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` |
| Persistent readiness flags | 4376-4379 | Read/write per-slug flags and sync `cacheHasLoaded` from persisted state | `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent` |
| Mount/unmount lifecycle | 4381-4881 | Boot sequence, initial cache strategy by route, listener startup, cleanup | `componentDidMount`, `componentWillUnmount` |
| Update lifecycle + deep-link/network handlers | 4883-5434 | React to slug/network/path changes, trigger deep-link scans, readiness recompute | `componentDidUpdate`, `handleDeepLinkScan`, `manageAutoHashPersistence`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 5436-7497 | Light/full SBT discovery, SBT merge logic, listener/event handlers | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `refreshSbtDataForGroup`, `startSbtEventListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question cache initialization | 7500-10120 | Survey cache load + question cache load + chunked response hydration | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup` |
| Survey/question event listeners | 10122-10547 | Event subscriptions and cache refresh on new survey/question events | `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + child prop composition | 10556-11993 | Route dispatch and prop wiring into lazy views | `getMainView`, `refreshSurveyResponsesByIDForGroup`, `refreshEncryptedQuestionPayloadsForGroup` |
| Final metadata refresh + render | 11995-12279 | Final question refresh helpers and root shell render | `refreshQuestionMetadataForGroup`, `refreshQuestionResponses`, `render` |
| PropTypes + Redux connect | 12284-12334 | Type contracts and `connect(...)` wiring | `mapStateToProps` |

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
- `hasPersistedManagedCacheData` (4378-4378)
- `syncCacheHasLoadedFlagFromPersistent` (4379-4379)
- `checkAllCachesReady` (5393-5434)

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
- `findGroupSlugForQuestion` (1770-1839)
- `resolveGroupSlugForSbtAddress` (1841-1921)
- `handleDeepLinkScan` (5156-5193)
- `manageAutoHashPersistence` (5198-5237)

### Session metadata + Lit + gated prompt recovery
- `syncLitHooks` (1268-1301)
- `getSessionInfoForGroup` (1303-1319)
- `getSessionNameForGroup` (1321-1337)
- `hasEncryptedSessionField` (1339-1358)
- `getSessionHeaderForGroup` (1360-1389)
- `refreshSessionInfo` (1391-1414)
- `refreshSessionMetaFields` (1416-1448)
- `refreshGroupCredentials` (1450-1454)
- `hasMaskedQuestionPayloadInCache` (11821-11828)
- `buildQuestionDecryptContext` (11830-11839)
- `refreshEncryptedQuestionPayloadsForGroup` (11841-11993)
- `refreshQuestionMetadataForGroup` (11995-12004)

### Scan scope, registry hydration, and deep scan planning
- `getSessionCfg` (1931-1931)
- `getSessionChainId` (1932-1932)
- `getSessionNetwork` (1933-1933)
- `isSbtInstanceListenerEnabledForGroup` (1935-1935)
- `isSbtHistoryScanEnabled` (1936-1936)
- `getSessionScanScope` (1937-1937)
- `getSessionScanScopeContext` (1938-1938)
- `isSessionSlugAllowedForScan` (1983-1985)
- `shouldAttachSbtDetailInstanceListener` (1990-1990)
- `shouldAutoRunFullSbtScan` (1989-1989)
- `readUserProfileAllSessionsFlag` (2059-2066)
- `getUserProfileAllSessionsScanMode` (2068-2107)
- `ensureRegistryHydratedForProfileScan` (2300-2476)
- `refreshSessionUniverseRegistryCache` (2480-2504)
- `resolveProfileDeepScanPlan` (2506-2639)
- `scheduleProfileScanRetryAfterRegistryHydration` (2641-2703)
- `getScopeFilteredSlugs` (2713-2713)
- `enqueueGeneralSessionBackfill` (2723-2773)
- `runWithGeneralSessionBackfill` (2775-2794)
- `scanForSurveyGroup` (2796-2997)
- `scanSpecificUserProfilePriority` (3001-3021)
- `scanSpecificUserProfile` (3023-4372)

### SBT cache and event pipeline
- `ensureLightSbtDiscovery` (5477-5830)
- `ensureLightSbtUniverse` (5834-5883)
- `mergeSbtCountMaps` (5885-5896)
- `mergeSbtCountsPayload` (5898-5917)
- `initializeSbtCache` (6061-6063)
- `initializeSbtCacheWithGeneralBackfill` (6065-6077)
- `initializeSbtCacheForGroup` (6079-6637)
- `refreshSbtDataForGroup` (6646-7109)
- `startSbtEventListenerForGroup` (7113-7197)
- `onNewSbtEventDetectedForGroup` (7202-7283)
- `onSbtCreatedDetectedForGroup` (7288-7356)
- `onSbtIssuedDetectedForGroup` (7360-7362)
- `onSbtTransferDetectedForGroup` (7495-7497)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (7513-8051)
- `initializeQuestionCacheForGroup` (8067-9363)
- `fetchQuestionResponsesChunkedForGroup` (9378-10120)
- `startSurveyAndQuestionEventListenerForGroup` (10124-10131)
- `onNewSurveyEventDetectedForGroup` (10136-10547)
- `refreshSurveyResponsesByIDForGroup` (11753-11817)
- `refreshQuestionResponses` (12006-12248)

### Lifecycle and view routing
- `componentDidMount` (4381-4789)
- `componentWillUnmount` (4791-4881)
- `componentDidUpdate` (4883-5154)
- `handleNetworkChange` (5240-5391)
- `getMainView` (11523-11742)
- `render` (12250-12279)

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
