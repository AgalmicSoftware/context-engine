# MainSite Map

## Quick Reference
- File: `client/src/components/MainSite/MainSite.tsx`
- About route lazy view: `client/src/components/About/AboutPage.tsx` (via `routeLazyComponents.js`)
- Session wizard lazy view: `client/src/components/Sessions/SessionWizard.tsx` (via `routeLazyComponents.js`)
- Session page lazy view: `client/src/components/OnePageSession/OnePageSession.tsx` (via `routeLazyComponents.js`)
- Session docs lazy view: `client/src/components/DocumentLibrary/SessionDocumentsPage.tsx` (via `routeLazyComponents.js`)
- Demo route lazy views: `client/src/components/DemoViews/DemosIndex.tsx`, `client/src/components/DemoViews/RiskMatrixDemo.tsx` (via `routeLazyComponents.js`)
- Navbar account modal surface: `client/src/components/Account/LoginAndSettingsModal.tsx` (mounted by `client/src/components/Navbar/AccountSection.tsx`, outside the route-lazy map)
- Current length: **~6,360 lines** (down from 11,465)
- Component type: **typed TSX React class component** (`MainSite extends Component`)
- Type definitions: `client/src/components/MainSite/MainSiteTypes.ts`
- Component count in file: **1 class component** (`MainSite`)
- Method inventory: **~215 class members**
- Summary: `MainSite` is the app shell and runtime orchestrator. It resolves active session/group context from URL + Redux, wires extracted runtime controllers for cache readiness, profile scans, SBT/survey/question/response pipelines, metadata refresh, and view prop composition, and keeps route dispatch plus behavior-critical scan/event reconciliation inline.

## Extracted Modules

- `client/src/utilities/cache/sessionCacheReadinessController.ts`
  Factory: `createSessionCacheReadinessController(host)`
  Methods: `setReadinessStateIfChanged`, `syncCacheHasLoadedFlagOnTransition`, `scheduleCacheUpdateFlush`, `queueCacheUpdateFlush`, `flushQueuedCacheUpdates`, `queueLocalRevisionUpdate`, `flushLocalRevisionUpdate`, `handleCrossTabCacheUpdateEvent`, `checkAllCachesReady`, `destroy`
  Test: `sessionCacheReadinessController.test.js`
- `client/src/utilities/cache/sessionCachePersistenceController.ts`
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
- `client/src/utilities/session/sessionProfileScanController.ts`
  Factory: `createSessionProfileScanController(host)`
  Pattern: Factory with host dependency injection
  Host interface: `getAccount()`, `getActiveSessionSlug()`, `getNetworkId()`, `getProvider()`, `getScopeFilteredSlugs()`, `getScopedSessionSlugs()`, `getSessionCfg()`, `getSessionChainId()`, `getSessionScanScopeContext()`, `getSessionSlugFromState()`, `isMounted()`, `isSessionSlugAllowedForScan()`, `scanSpecificUserProfile()`
  Public methods: `hasExplicitProfileScanScopeOverride`, `getProfileScanScopeContext`, `readBoolishRuntimeFlag`, `getUserProfileAllSessionsScanMode`, `isUserProfileAllSessionsScanEnabled`, `getActiveProfileScanChainId`, `readProfileScanStepTimeoutMs`, `readProfileScanSbtBurstSize`, `readProfileScanActivityLookbackBlocks`, `readUserProfileAllSessionsFlag`, `readProfileScanRegistryLookupTimeoutMs`, `getRegistrySessionEntryCount`, `getRegistrySessionCoverageCountForChain`, `getRegistryBootstrapScopeKey`, `getProfileScanListScopeSessionConfigCacheKey`, `resolveListScopeSessionConfigFromRegistry`, `ensureRegistryHydratedForProfileScan`, `isOnchainSessionRegistryEnabled`, `refreshSessionUniverseRegistryCache`, `resolveProfileDeepScanPlan`, `getProfileDeepScanSlugs`, `scheduleProfileScanRetryAfterRegistryHydration`, `shouldBackfillGeneralSession`, `enqueueGeneralSessionBackfill`, `runWithGeneralSessionBackfill`, `emitProfileScanTelemetry`, `isProfileScanTelemetryEnabled`, `isProfileScanColdDiagEnabled`, `emitProfileScanColdDiag`, `destroy`
  Internal state: `_registryBootstrapPromise`, `_registryBootstrapScopeKey`, `_profileScanRetryAfterRegistry`, `_generalBackfillQueue`, `_profileScanListScopeSessionConfigCache`
  What stays in MainSite: `scanForSurveyGroup`, `scanSpecificUserProfilePriority`, `scanSpecificUserProfile` (full implementations / cache writes), plus forwarding wrappers that delegate into the controller and `_registryBootstrapPromise` / `_registryBootstrapScopeKey` bridge accessors for extracted controller state
- `client/src/utilities/session/profileScanReportHelpers.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `createInitialProfileScanReport`, `createProfileScanFanoutPlan`, `resolveProfileScanAttemptedCoverageSlugs`
  Purpose: profile scan report fanout planning, initial report shape, and attempted coverage slug resolution
  Test: `profileScanReportHelpers.test.js`
- `client/src/utilities/session/sessionMetaController.ts`
  Factory: `createSessionMetaRefreshController(host)`
  Pattern: Factory with host dependency injection plus pure helpers
  Exports: `refreshSessionInfoForSlug`, `refreshSessionMetaFieldsForSlug`, `createSessionMetaRefreshController`
  Purpose: encrypted session info/name/header refresh, Lit decrypt attempt tracking, per-slug override patch creation, and cleanup of decrypt-attempt state
  Test: `sessionMetaController.test.js`

- `client/src/utilities/session/metadataSessionBinding.ts`
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
  Dependencies: `buildMetadataSessionCacheEnvelope` (`utilities/session/metadataSessionBinding.ts`), `normalizeSessionSlug` (sessionNaming)
  What stays in MainSite: `writeSurveyMetadataToCache` (DG write, bucket init), `writeQuestionMetadataToCache` (DG write, bucket init)
- `client/src/components/MainSite/sbtRoutePathHelpers.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `getSbtAddressFromPath`, `isSbtListRoutePath`, `getSbtListRouteSessionSlug`, `getUserAddressFromPath`
  Purpose: SBT/group list route parsing plus single-SBT and user-address path extraction
  What stays in MainSite: forwarding wrappers that pass route paths through `getEffectiveRoutePath`, `normalizeSessionSlug`, and `ethers.utils.isAddress`
- `client/src/components/MainSite/sessionFallbackRedirect.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `getSessionFallbackScopeSlugs`, `getSessionFallbackPreferredTarget`, `isFirstVisitRootRedirectEnabled`, `getFirstVisitRootRedirectTarget`, `getSessionFallbackRedirectStorageKey`, `hasConsumedSessionFallbackRedirect`, `consumeSessionFallbackRedirect`
  Purpose: List-scope session fallback redirects, preferred target selection, temporary root/About redirect target resolution, cached session-load migration guards, and redirect consumption tracking
  Test: `sessionFallbackRedirect.test.ts`
  What stays in MainSite: route-shell application through `applySessionFallbackRedirect`, first-visit `replaceState`, and forwarding wrappers for runtime/config dependencies
- `client/src/components/MainSite/sessionDisplayHelpers.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `hasEncryptedSessionField`, `getSessionInfoForGroup`, `getSessionNameForGroup`, `getSessionHeaderForGroup`
  Purpose: Session info/name/header display resolution, encrypted-field placeholders, per-slug overrides, and demo metadata fallbacks
  What stays in MainSite: state-backed override maps and forwarding wrappers that supply `normalizeSessionSlug`, `getDemoSessionConfigBySlug`, and Arweave URL normalization
- `client/src/components/MainSite/routeSessionResolution.ts`
  Pattern: Pure exported functions (no host DI)
  Exports: `resolveMainSiteExplicitSessionSlugFromPath`, `resolveMainSiteGlobalPrimarySessionSlug`, `resolveMainSiteSessionSlugFromProps`, `resolveMainSiteQuestionRouteSessionContext`, `resolveMainSiteSessionRouteContext`, and related route-session helpers
  Purpose: route/session slug and id resolution for `MainSite` route dispatch without moving route semantics
  Test: `routeSessionResolution.test.ts`
- `client/src/components/MainSite/mainSiteViewProps.ts`
  Pattern: Pure exported prop composers (no host DI)
  Exports: `composeMainSiteWalletViewProps`, `composeMainSiteLoginViewProps`, `composeMainSiteAuthViewProps`, `composeMainSiteSurveyCacheViewProps`, `composeMainSiteQuestionCacheViewProps`, `composeMainSiteSessionCacheViewProps`
  Purpose: exact prop bundles for survey, question, and session lazy views while keeping route/render dispatch in `MainSite`
  Test: `mainSiteViewProps.test.ts`
- `client/src/utilities/survey/sessionSurveyCacheController.ts`
  Factory: `createSessionSurveyCacheController(host)`
  Pattern: Factory with host dependency injection
  Public listener methods: `startSurveyAndQuestionEventListener`, `startSurveyAndQuestionEventListenerForGroup`
  Test: `sessionSurveyCacheController.test.js`
- `client/src/utilities/survey/sessionQuestionCacheController.ts`
  Factory: `createSessionQuestionCacheController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionQuestionCacheController.test.js` (27 tests)
- `client/src/utilities/survey/sessionResponseHydrationController.ts`
  Factory: `createSessionResponseHydrationController(host)`
  Pattern: Factory with host dependency injection
  Test: `sessionResponseHydrationController.test.js` (24 tests)
- `client/src/utilities/sbt/sessionSbtCacheController.js`
  Factory: `createSessionSbtCacheController(host)`
  Pattern: Factory with host dependency injection
  Public listener methods: `startSbtEventListener`, `startSbtEventListenerForGroup`, `startSbtDetailInstanceListenerForGroup`
  Test: `sessionSbtCacheController.test.js` (29 tests)
- `client/src/utilities/sbt/sbtLiveProgressController.js`
  Factory: `createSbtLiveProgressController({ setState, ...deps })`
  Purpose: SBT scan live-progress token state, throttled progress commits, and progress cleanup
  Test: `sbtLiveProgressController.test.js` (3 tests)
- `client/src/utilities/sbt/sbtRealtimeCoverageController.js`
  Factory: `createSbtRealtimeCoverageController({ setState })`
  Purpose: per-group SBT realtime coverage state writes and cleanup flags
  Test: `sbtRealtimeCoverageController.test.js` (2 tests)
- `client/src/utilities/sbt/sbtRealtimeListenerCleanupController.js`
  Factory: `createSbtRealtimeListenerCleanupController({ clearCoverage, contractScripts })`
  Purpose: SBT factory/instance listener removal wrapper plus coverage cleanup
  Test: `sbtRealtimeListenerCleanupController.test.js` (2 tests)
- `client/src/utilities/sbt/sbtRealtimeListenerPlan.js`
  Exports: `getSbtInstanceListenerPlan`
  Purpose: pure per-instance SBT listener attach/skip planning for cache address sets, max overrides, and policy gates
  Test: `sbtRealtimeListenerPlan.test.js` (6 tests)
- `client/src/utilities/sbt/sbtRealtimeEventBlockResolver.js`
  Exports: `resolveSbtRealtimeEventBlockNumber`
  Purpose: realtime SBT event block-number resolution from direct event data, transaction receipts, or current block-window fallback
  Test: `sbtRealtimeEventBlockResolver.test.js` (6 tests)
- `client/src/utilities/sbt/sbtRealtimeEventCursorGuard.js`
  Exports: `getSbtRealtimeEventCursorGuard`
  Purpose: pure realtime SBT event skip decisions for ordered cursors and network waterlines
  Test: `sbtRealtimeEventCursorGuard.test.js` (3 tests)
- `client/src/utilities/sbt/sbtRealtimeCursorCache.js`
  Exports: `updateSbtRealtimeCursorForNetworkCache`
  Purpose: idempotent cache mutation for advancing per-network SBT realtime cursors
  Test: `sbtRealtimeCursorCache.test.js` (4 tests)

All extracted controllers use a factory-function + host-DI pattern (or pure exports for session config, metadata binding, route resolution, and view prop composition). `MainSite` now wires cache/readiness, scan-policy, profile-scan, metadata-refresh, survey, question, response, and SBT controllers as class-field initializers, leaving route orchestration, deep scans, survey event reconciliation, and final view dispatch inline.

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports, constants, types, pure helpers | 1-672 | Dependencies, route/cache helper types, perf helpers, exported pure functions (`shouldFlushCoalescedRun`, etc.) | `shouldFlushCoalescedRun`, `buildQuestionReadyStatePatch`, `shouldEnableSessionRegistryRefresh` |
| Class state + controller fields | 675-1047 | Main runtime state plus host-DI setup for cache, scan, SBT, survey, question, response, path, and metadata controllers | `state`, `_cacheReadinessController`, `_profileScanController`, `_sbtCacheController`, `_sessionMetaRefreshController` |
| Route fallback + cache update orchestration | 1055-1241 | Public route path helpers, fallback redirect consumption, cache reinit run tracking, coalesced cache updates, and queued survey scans | `applySessionFallbackRedirect`, `mergeLegacyNumericNetworkKey`, `startCacheReinitRun`, `queueLocalRevisionUpdate`, `queueSurveyGroupScan` |
| Session/path resolution + display metadata | 1245-1625 | Parse `/session/:token`, resolve route slugs/ids, SBT paths, Lit hooks, encrypted display fallbacks, and metadata cache envelope forwarding | `resolveSessionPathId`, `resolveSessionPathSlug`, `getSessionSlugFromProps`, `getSessionInfoForGroup`, `refreshSessionInfo` |
| Metadata cache writes + group lookup | 1627-1838 | Survey/question metadata cache writes and group lookup for surveys, questions, and SBT addresses | `writeSurveyMetadataToCache`, `writeQuestionMetadataToCache`, `findGroupSlugForSurvey`, `findGroupSlugForQuestion`, `resolveGroupSlugForSbtAddress` |
| Scan policy, registry bootstrap, and deep scans | 1840-3554 | Session config accessors, scan-scope/profile-scan controller wrappers, cross-group survey lookup, and full user profile scan bodies | `getSessionScanScope`, `ensureRegistryHydratedForProfileScan`, `scanForSurveyGroup`, `scanSpecificUserProfile` |
| Lifecycle + cache readiness | 3554-4530 | Persisted readiness flags, mount/unmount boot strategy, update/network handlers, deep-link scans, and aggregate cache readiness checks | `componentDidMount`, `componentWillUnmount`, `componentDidUpdate`, `handleNetworkChange`, `checkAllCachesReady` |
| SBT cache + listeners | 4533-4623 | Forwarding wrappers into the extracted SBT cache controller for discovery, refresh, detail listeners, and realtime event handling | `ensureLightSbtDiscovery`, `initializeSbtCacheForGroup`, `startSbtDetailInstanceListenerForGroup`, `onSbtTransferDetectedForGroup` |
| Survey/question/response caches + listeners | 4626-5113 | General-session backfill entrypoints into extracted survey/question/response controllers plus inline survey event reconciliation | `initializeSurveyCacheForGroup`, `initializeQuestionCacheForGroup`, `fetchQuestionResponsesChunkedForGroup`, `startSurveyAndQuestionEventListenerForGroup`, `onNewSurveyEventDetectedForGroup` |
| View routing + prop composition | 5115-6269 | Route helpers (`_render*Route`), route dispatch, and prop wiring into lazy views using `mainSiteViewProps.ts` bundles | `_renderSurveyIdRoute`, `_renderQuestionDetailRoute`, `_renderSessionRoute`, `getMainView` |
| Final wrappers + render | 6273-6360 | Faucet action, survey/question refresh wrappers, encrypted question payload wrappers, root shell render, PropTypes, and Redux connect | `refreshSurveyResponsesByIDForGroup`, `refreshQuestionResponses`, `render`, `mapStateToProps` |

## Method Index (Grouped by Responsibility)

### Cache and readiness orchestration
- `mergeLegacyNumericNetworkKey` (1145-1162)
- `startCacheReinitRun` (1164-1169)
- `isCacheReinitRunActive` (1171-1173)
- `resolveActiveSlugForCacheUpdates` (1179-1194)
- `setReadinessStateIfChanged` (1196-1197) — forwarding wrapper → `sessionCacheReadinessController.ts`
- `syncCacheHasLoadedFlagOnTransition` (1199-1200) — forwarding wrapper → `sessionCacheReadinessController.ts`
- `queueLocalRevisionUpdate` / `flushLocalRevisionUpdate` (1211-1215) — forwarding wrappers → `sessionCacheReadinessController.ts`
- `handleCrossTabCacheUpdateEvent` (1217-1218) — forwarding wrapper → `sessionCacheReadinessController.ts`
- `hasPersistedManagedCacheData` / `syncCacheHasLoadedFlagFromPersistent` (3560-3564) — forwarding wrappers → `sessionCachePersistenceController.ts`
- `checkAllCachesReady` (4530-4531) — forwarding wrapper → `sessionCacheReadinessController.ts`

### Session routing and group resolution
- `getSessionTokenFromPath` (1245-1249)
- `resolveSessionSlugFromPathToken` (1251-1267)
- `resolveSessionPathId` / `resolveSessionPathSlug` (1269-1275) — forwarding wrappers → `sessionPathResolverController.ts`
- `getExplicitSessionSlugFromProps`, `getGlobalPrimarySessionSlugFromProps`, `getSessionSlugFromProps` (1288-1327) — forwarding wrappers → `routeSessionResolution.ts`
- `getRenderActiveSessionSlug` (1397-1415) — forwarding wrapper → `routeSessionResolution.ts`
- `getSbtAddressFromPath`, `isSbtListRoutePath`, `getSbtListRouteSessionSlug`, `getUserAddressFromPath` (1466-1487) — forwarding wrappers → `sbtRoutePathHelpers.ts`
- `findGroupSlugForSurvey` (1733-1747)
- `getQuestionRouteSessionSlugHint` / `getQuestionRouteSessionIdHint` (1761-1784)
- `findGroupSlugForQuestion` (1786-1803)
- `resolveGroupSlugForSbtAddress` (1805-1838)
- `handleDeepLinkScan` (4322-4366)
- `manageAutoHashPersistence` (4368-4380)

### Session metadata + Lit + gated prompt recovery
- `syncLitHooks` (1501-1536)
- `getSessionInfoForGroup` / `getSessionNameForGroup` / `getSessionHeaderForGroup` (1538-1567) — forwarding wrappers → `sessionDisplayHelpers.ts`
- `refreshSessionInfo` / `refreshSessionMetaFields` (1569-1573) — forwarding wrappers → `sessionMetaController.ts`
- `resolveMetadataSessionBinding`, `resolveMetadataSessionSlug`, `resolveScopedMetadataSessionSlug`, `buildMetadataSessionCacheEnvelope` (1607-1625) — forwarding wrappers → `utilities/session/metadataSessionBinding.ts`
- `hasMaskedQuestionPayloadInCache`, `buildQuestionDecryptContext`, `refreshEncryptedQuestionPayloadsForGroup`, `refreshQuestionMetadataForGroup` (6287-6297) — forwarding wrappers → `sessionQuestionCacheController.ts`

### Scan scope, registry hydration, and deep scan planning
Most profile-scan / registry helpers in this block now forward into `client/src/utilities/session/sessionProfileScanController.ts`; the full scan bodies remain in `scanForSurveyGroup` and `scanSpecificUserProfile*`.

- `getSessionCfg`, `getSessionChainId`, `getSessionNetwork` (1843-1845)
- scan policy wrappers (1847-1876) — forwarding wrappers → `mainSiteSessionScanPolicy.js`
- profile scan/registry wrappers (1878-1966) — forwarding wrappers → `sessionProfileScanController.ts`
- `scanForSurveyGroup` (1969-2186)
- `scanSpecificUserProfilePriority` (2188-2211)
- `scanSpecificUserProfile` (2213-3552)

### SBT cache and event pipeline
- `ensureSessionRouteSbtDiscovery` (4533-4534)
- `ensureLightSbtDiscovery` / `ensureLightSbtUniverse` (4539-4543)
- SBT count/history helpers (4545-4569) — forwarding wrappers → `sessionSbtCacheController.js`
- `initializeSbtCacheForGroup` (4578-4579)
- `refreshSbtData` / `refreshSbtDataForGroup` (4581-4585)
- `startSbtEventListenerForGroup` / `startSbtDetailInstanceListenerForGroup` (4590-4594)
- `onNewSbtEventDetectedForGroup`, `onSbtCreatedDetectedForGroup`, `onSbtIssuedDetectedForGroup`, `onSbtActivityDetectedForGroup`, `onSbtTransferDetectedForGroup` (4599-4624)

### Survey/question/response caches and listeners
- `initializeSurveyCacheForGroup` (4639-4640) — forwarding wrapper → `sessionSurveyCacheController.ts`
- `initializeQuestionCacheForGroup` (4656-4657) — forwarding wrapper → `sessionQuestionCacheController.ts`
- `fetchQuestionResponsesChunkedForGroup` (4672-4673) — forwarding wrapper → `sessionResponseHydrationController.ts`
- `startSurveyAndQuestionEventListenerForGroup` (4678-4680) — forwarding wrapper → `sessionSurveyCacheController.ts`
- `onNewSurveyEventDetectedForGroup` (4684-5113)
- `refreshSurveyResponsesByIDForGroup` (6281-6282)
- `refreshQuestionResponses` (6299-6300)

### Lifecycle and view routing
- `componentDidMount` (3570-3989)
- `componentWillUnmount` (3991-4051)
- `componentDidUpdate` (4053-4320)
- `handleNetworkChange` (4382-4528)
- `_renderSurveyIdRoute` (5452-5587)
- `_renderSurveysOrQuestionsListRoute` (5589-5736)
- `_renderQuestionDetailRoute` (5738-5829)
- `_renderSessionRoute` (5831-6050)
- `getMainView` (6052-6269)
- `render` (6302-6332)

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
