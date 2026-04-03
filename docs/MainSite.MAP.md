# MainSite.jsx Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.jsx`
- About route lazy view: `client/src/components/About/AboutPage.jsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.jsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.jsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.jsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.jsx`, `client/src/components/DemoViews/RiskMatrixDemo.jsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.jsx` (mounted by `client/src/components/Navbar/AccountSection.jsx`, outside the route-lazy map)
- Current length: **12,870 lines**
- Component type: **React class component** (`MainSite extends Component`)
- Component count in file: **1 class component** (`MainSite`)
- Method inventory: **138 class methods/properties** + **15 top-level helper functions**
- Summary: `MainSite` is the app shell and runtime orchestrator. It resolves active session/group context from URL + Redux, hydrates multi-cache state (SBT/surveys/questions/responses), drives profile deep scans and registry hydration, manages per-group listener lifecycles, coordinates Lit/session metadata refresh, and routes to lazy feature views while gating UI readiness via cache flags.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, pure helpers | 1-325 | Dependencies, perf helpers, cache utility helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + instance fields | 326-400 | Main runtime state + internal run tokens/queues | `state`, `_pendingCacheUpdateFlags`, `_cacheHasLoadedSyncInFlight` |
| Cache flush + cross-tab coalescing | 401-725 | Debounced cache/readiness updates and cross-tab sync handling | `setReadinessStateIfChanged`, `scheduleCacheUpdateFlush`, `flushQueuedCacheUpdates`, `handleCrossTabCacheUpdateEvent` |
| Session path/slug resolution | 728-1473 | Parse `/session/:token`, resolve ids/slugs, locate groups for surveys/questions/SBT links | `resolveSessionPathId`, `resolveSessionPathSlug`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| DG storage abstraction | 1475-1616 | Per-group storage facade over cache manager/localStorage | `DG.key`, `DG.read`, `DG.write`, `DG.remove` |
| Session config + scan policy + registry bootstrap | 1619-2456 | Chain/session helpers, scope controls, telemetry, on-chain registry hydration, deep-scan planning | `getSessionCfg`, `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `resolveProfileDeepScanPlan`, `runWithGeneralSessionBackfill` |
| Deep scans (survey lookup + user profile) | 2458-3437 | Cross-group survey discovery + full activity/SBT profile scanning with cache merges | `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` |
| Persistent readiness flags | 3441-3495 | Read/write per-slug flags and sync `cacheHasLoaded` from persisted state | `readFlag`, `writeFlag`, `hasPersistedManagedCacheData`, `syncCacheHasLoadedFlagFromPersistent` |
| Mount/unmount lifecycle | 3497-3968 | Boot sequence, initial cache strategy by route, listener startup, cleanup | `componentDidMount`, `componentWillUnmount` |
| Update lifecycle + deep-link/network handlers | 3970-4466 | React to slug/network/path changes, trigger deep-link scans, readiness recompute | `componentDidUpdate`, `handleDeepLinkScan`, `manageAutoHashPersistence`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 4479-5809 | Light/full SBT discovery, SBT merge logic, listener/event handlers | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `refreshSbtDataForGroup`, `startSbtEventListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question cache initialization | 5812-8093 | Survey cache load + question cache load + chunked response hydration | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup` |
| Survey/question event listeners | 8095-8462 | Event subscriptions and cache refresh on new survey/question events | `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + child prop composition | 8472-9515 | Route dispatch and prop wiring into lazy views | `getMainView`, `refreshSurveyResponsesByIDForGroup`, `refreshEncryptedQuestionPayloadsForGroup` |
| Final metadata refresh + render | 9517-9805 | Final question refresh helpers and root shell render | `refreshQuestionMetadataForGroup`, `refreshQuestionResponses`, `render` |
| PropTypes + Redux connect | 9807-9870 | Type contracts and `connect(...)` wiring | `mapStateToProps` |

## Method Index (Grouped by Responsibility)

### Cache and readiness orchestration
- `mergeLegacyNumericNetworkKey` (401-415)
- `startCacheReinitRun` (417-422)
- `isCacheReinitRunActive` (424-426)
- `resolveActiveSlugForCacheUpdates` (428-443)
- `setReadinessStateIfChanged` (445-492)
- `syncCacheHasLoadedFlagOnTransition` (494-511)
- `scheduleCacheUpdateFlush` (530-542)
- `queueCacheUpdateFlush` (544-564)
- `flushQueuedCacheUpdates` (566-589)
- `scheduleLocalRevisionFlush` (608-620)
- `flushLocalRevisionUpdate` (633-659)
- `handleCrossTabCacheUpdateEvent` (661-690)
- `hasPersistedManagedCacheData` (3444-3458)
- `syncCacheHasLoadedFlagFromPersistent` (3460-3495)
- `checkAllCachesReady` (4425-4466)

### Session routing and group resolution
- `getSessionTokenFromPath` (728-732)
- `resolveSessionSlugFromPathToken` (734-762)
- `resolveSessionPathId` (764-873)
- `resolveSessionPathSlug` (875-964)
- `getInitialGroupSlugFromPath` (966-973)
- `getSessionSlugFromProps` (975-977)
- `getSessionSlugFromState` (979)
- `getActiveSessionSlug` (981-983)
- `getSbtAddressFromPath` (985-992)
- `getUserAddressFromPath` (994-1005)
- `findGroupSlugForSurvey` (1253-1302)
- `getQuestionRouteSessionSlugHint` (1304-1318)
- `getQuestionRouteSessionIdHint` (1320-1334)
- `findGroupSlugForQuestion` (1336-1391)
- `resolveGroupSlugForSbtAddress` (1393-1473)
- `handleDeepLinkScan` (4194-4231)
- `manageAutoHashPersistence` (4236-4275)

### Session metadata + Lit + gated prompt recovery
- `syncLitHooks` (1018-1056)
- `getSessionInfoForGroup` (1058-1064)
- `getSessionNameForGroup` (1066-1072)
- `hasEncryptedSessionField` (1074-1093)
- `getSessionHeaderForGroup` (1095-1104)
- `refreshSessionInfo` (1106-1136)
- `refreshSessionMetaFields` (1138-1190)
- `refreshGroupCredentials` (1192-1249)
- `hasMaskedQuestionPayloadInCache` (9315-9322)
- `buildQuestionDecryptContext` (9324-9338)
- `refreshEncryptedQuestionPayloadsForGroup` (9340-9515)
- `refreshQuestionMetadataForGroup` (9517-9526)

### Scan scope, registry hydration, and deep scan planning
- `getSessionCfg` (1619-1627)
- `getSessionChainId` (1629-1635)
- `getSessionNetwork` (1638-1644)
- `isSbtInstanceListenerEnabledForGroup` (1652-1671)
- `isSbtHistoryScanEnabled` (1673-1676)
- `getSessionScanScope` (1680-1689)
- `getSessionScanScopeContext` (1691-1707)
- `isSessionSlugAllowedForScan` (1709-1713)
- `areSbtInstanceListenersSuppressedByMode` (1732-1755)
- `shouldAutoRunFullSbtScan` (1757-1774)
- `readUserProfileAllSessionsFlag` (1898-1905)
- `getUserProfileAllSessionsScanMode` (1907-1946)
- `ensureRegistryHydratedForProfileScan` (2006-2110)
- `refreshSessionUniverseRegistryCache` (2114-2132)
- `resolveProfileDeepScanPlan` (2134-2273)
- `scheduleProfileScanRetryAfterRegistryHydration` (2275-2337)
- `getScopeFilteredSlugs` (2360-2375)
- `enqueueGeneralSessionBackfill` (2385-2435)
- `runWithGeneralSessionBackfill` (2437-2456)
- `scanForSurveyGroup` (2458-2570)
- `scanSpecificUserProfilePriority` (2574-2594)
- `scanSpecificUserProfile` (2596-3437)

### SBT cache and event pipeline
- `ensureLightSbtDiscovery` (4479-4622)
- `ensureLightSbtUniverse` (4626-4651)
- `mergeSbtCountMaps` (4653-4664)
- `mergeSbtCountsPayload` (4666-4685)
- `initializeSbtCache` (4687-4689)
- `initializeSbtCacheWithGeneralBackfill` (4691-4703)
- `initializeSbtCacheForGroup` (4705-5162)
- `refreshSbtDataForGroup` (5171-5430)
- `startSbtEventListenerForGroup` (5434-5516)
- `onNewSbtEventDetectedForGroup` (5521-5587)
- `onSbtCreatedDetectedForGroup` (5592-5643)
- `onSbtIssuedDetectedForGroup` (5647-5730)
- `onSbtTransferDetectedForGroup` (5734-5809)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (5825-6301)
- `initializeQuestionCacheForGroup` (6317-7363)
- `fetchQuestionResponsesChunkedForGroup` (7378-8093)
- `startSurveyAndQuestionEventListenerForGroup` (8097-8104)
- `onNewSurveyEventDetectedForGroup` (8109-8462)
- `refreshSurveyResponsesByIDForGroup` (9252-9311)
- `refreshQuestionResponses` (9528-9770)

### Lifecycle and view routing
- `componentDidMount` (3497-3883)
- `componentWillUnmount` (3885-3968)
- `componentDidUpdate` (3970-4192)
- `handleNetworkChange` (4278-4423)
- `getMainView` (8472-9241)
- `render` (9772-9804)

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
