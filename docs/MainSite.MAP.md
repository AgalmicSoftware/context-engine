# MainSite Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.jsx`
- About route lazy view: `client/src/components/About/AboutPage.tsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.tsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.tsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.tsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.tsx`, `client/src/components/DemoViews/RiskMatrixDemo.tsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.tsx` (mounted by `client/src/components/Navbar/AccountSection.tsx`, outside the route-lazy map)
- Current length: **12,284 lines**
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

- `client/src/components/MainSite/metadataSessionBinding.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `resolveMetadataSessionBinding`, `resolveMetadataSessionSlug`, `resolveScopedMetadataSessionSlug`, `buildMetadataSessionCacheEnvelope`
  Types: `MetadataSessionAuthority`, `MetadataSessionBinding`, `MetadataSessionCacheEnvelope`, `BuildEnvelopeOptions`
  Test: `metadataSessionBinding.test.ts` (20 tests)
  Dependencies: `normalizeSessionSlug` (sessionNaming), `getSessionSlugByName` (sessionConfigResolvers)
  What stays in MainSite: `writeSurveyMetadataToCache`, `writeQuestionMetadataToCache`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` (all call through forwarding wrappers)

All extracted controllers use a factory-function + host-DI pattern (or pure exports for session config / metadata binding). `MainSite` creates them as class-field initializers and delegates through forwarding methods.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-270 | Dependencies, perf helpers, cache utility helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + instance fields | 271-364 | Main runtime state + internal run tokens/queues/controllers | `state`, `_cachePersistenceController`, `_cacheReadinessController`, `_scanPolicy`, `DG` |
| Cache flush + cross-tab coalescing | 366-769 | Debounced cache/readiness updates and cross-tab sync handling | `setReadinessStateIfChanged`, `scheduleCacheUpdateFlush`, `flushQueuedCacheUpdates`, `handleCrossTabCacheUpdateEvent` |
| Session path/slug resolution | 772-1871 | Parse `/session/:token`, resolve ids/slugs, locate groups for surveys/questions/SBT links | `resolveSessionPathId`, `resolveSessionPathSlug`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| DG storage abstraction | 1878-1878 | Per-group storage facade over cache manager/localStorage | `DG.key`, `DG.read`, `DG.write`, `DG.remove` |
| Session config + scan policy + registry bootstrap | 1881-2744 | Chain/session helpers, scope controls, telemetry, on-chain registry hydration, deep-scan planning | `getSessionCfg`, `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `resolveProfileDeepScanPlan`, `runWithGeneralSessionBackfill` |
| Deep scans (survey lookup + user profile) | 2746-4322 | Cross-group survey discovery + full activity/SBT profile scanning with cache merges | `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` |
| Persistent readiness flags | 4326-4329 | Read/write per-slug flags and sync `cacheHasLoaded` from persisted state | `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent` |
| Mount/unmount lifecycle | 4331-4831 | Boot sequence, initial cache strategy by route, listener startup, cleanup | `componentDidMount`, `componentWillUnmount` |
| Update lifecycle + deep-link/network handlers | 4833-5384 | React to slug/network/path changes, trigger deep-link scans, readiness recompute | `componentDidUpdate`, `handleDeepLinkScan`, `manageAutoHashPersistence`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 5386-7447 | Light/full SBT discovery, SBT merge logic, listener/event handlers | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `refreshSbtDataForGroup`, `startSbtEventListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question cache initialization | 7450-10070 | Survey cache load + question cache load + chunked response hydration | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup` |
| Survey/question event listeners | 10072-10497 | Event subscriptions and cache refresh on new survey/question events | `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + child prop composition | 10506-11943 | Route dispatch and prop wiring into lazy views | `getMainView`, `refreshSurveyResponsesByIDForGroup`, `refreshEncryptedQuestionPayloadsForGroup` |
| Final metadata refresh + render | 11945-12229 | Final question refresh helpers and root shell render | `refreshQuestionMetadataForGroup`, `refreshQuestionResponses`, `render` |
| PropTypes + Redux connect | 12234-12284 | Type contracts and `connect(...)` wiring | `mapStateToProps` |

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
- `findGroupSlugForQuestion` (1720-1789)
- `resolveGroupSlugForSbtAddress` (1791-1871)
- `handleDeepLinkScan` (5106-5143)
- `manageAutoHashPersistence` (5148-5187)

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
- `hasMaskedQuestionPayloadInCache` (11771-11778)
- `buildQuestionDecryptContext` (11780-11789)
- `refreshEncryptedQuestionPayloadsForGroup` (11791-11943)
- `refreshQuestionMetadataForGroup` (11945-11954)

### Scan scope, registry hydration, and deep scan planning
- `getSessionCfg` (1881-1881)
- `getSessionChainId` (1882-1882)
- `getSessionNetwork` (1883-1883)
- `isSbtInstanceListenerEnabledForGroup` (1885-1885)
- `isSbtHistoryScanEnabled` (1886-1886)
- `getSessionScanScope` (1887-1887)
- `getSessionScanScopeContext` (1888-1888)
- `isSessionSlugAllowedForScan` (1933-1935)
- `shouldAttachSbtDetailInstanceListener` (1940-1940)
- `shouldAutoRunFullSbtScan` (1939-1939)
- `readUserProfileAllSessionsFlag` (2009-2016)
- `getUserProfileAllSessionsScanMode` (2018-2057)
- `ensureRegistryHydratedForProfileScan` (2250-2426)
- `refreshSessionUniverseRegistryCache` (2430-2454)
- `resolveProfileDeepScanPlan` (2456-2589)
- `scheduleProfileScanRetryAfterRegistryHydration` (2591-2653)
- `getScopeFilteredSlugs` (2663-2663)
- `enqueueGeneralSessionBackfill` (2673-2723)
- `runWithGeneralSessionBackfill` (2725-2744)
- `scanForSurveyGroup` (2746-2947)
- `scanSpecificUserProfilePriority` (2951-2971)
- `scanSpecificUserProfile` (2973-4322)

### SBT cache and event pipeline
- `ensureLightSbtDiscovery` (5427-5780)
- `ensureLightSbtUniverse` (5784-5833)
- `mergeSbtCountMaps` (5835-5846)
- `mergeSbtCountsPayload` (5848-5867)
- `initializeSbtCache` (6011-6013)
- `initializeSbtCacheWithGeneralBackfill` (6015-6027)
- `initializeSbtCacheForGroup` (6029-6587)
- `refreshSbtDataForGroup` (6596-7059)
- `startSbtEventListenerForGroup` (7063-7147)
- `onNewSbtEventDetectedForGroup` (7152-7233)
- `onSbtCreatedDetectedForGroup` (7238-7306)
- `onSbtIssuedDetectedForGroup` (7310-7312)
- `onSbtTransferDetectedForGroup` (7445-7447)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (7463-8001)
- `initializeQuestionCacheForGroup` (8017-9313)
- `fetchQuestionResponsesChunkedForGroup` (9328-10070)
- `startSurveyAndQuestionEventListenerForGroup` (10074-10081)
- `onNewSurveyEventDetectedForGroup` (10086-10497)
- `refreshSurveyResponsesByIDForGroup` (11703-11767)
- `refreshQuestionResponses` (11956-12198)

### Lifecycle and view routing
- `componentDidMount` (4331-4739)
- `componentWillUnmount` (4741-4831)
- `componentDidUpdate` (4833-5104)
- `handleNetworkChange` (5190-5341)
- `getMainView` (11473-11692)
- `render` (12200-12229)

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
