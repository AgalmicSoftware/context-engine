# MainSite Map

## Quick Reference

- File: `client/src/components/MainSite/MainSite.tsx`
- Component type: typed React class component (`MainSite extends Component`)
- Type definitions: `client/src/components/MainSite/MainSiteTypes.ts`
- Route classifier: `client/src/components/MainSite/routeTable.ts`
- Route classifier tests: `client/src/components/MainSite/routeTable.test.ts`
- Runtime characterization tests: `client/src/components/MainSite/MainSite.routes.test.jsx`
- Session media URL domain helper: `client/src/domains/sessions/sessionMediaUrls.ts`

`MainSite` is still the application shell and runtime orchestrator. It resolves session context from URL, Redux, registry cache, and wallet/network state; wires cache/readiness/profile/SBT/survey/question/response controllers; manages listener lifecycle; and dispatches lazy route views.

This map intentionally avoids exact line numbers. MainSite is still changing during the PRD 645/646 modernization lanes, so name-based navigation is the durable index.

## Route Dispatch

Route matching is now classified by the pure `resolveMainSiteRouteMatch` table in `routeTable.ts`. `MainSite.getMainView` remains the rendering caller and still owns URL side effects such as `/new` canonicalization and question/survey responder query normalization.
Degenerate double-slash SBT address URLs such as `//sbt/0x...` and `//group/0x...` intentionally resolve as SBT detail routes; this PRD 647 decision is pinned in `routeTable.test.ts`.

Covered route keys:

- `wizard`
- `surveyId`
- `home`
- `debate`
- `atlas`
- `tag`
- `bookmarks`
- `compare`
- `surveysOrQuestionsList`
- `questionDetail`
- `sbtsList`
- `sbtDetail`
- `simUser`
- `userProfile`
- `about`
- `demos`
- `matrix`
- `contracts`
- `admin`
- `sponsor`
- `agent`
- `session`
- `notFound`

Golden route coverage lives in `routeTable.test.ts` for:

- `/session/:token`
- `/session/:token/questions`
- `/session/:token/docs`
- `/survey/:id/results`
- `/question/:id?session=...`
- `/sbt/:address`
- `/u/:address`
- `/admin`
- `/sponsor`
- `/new` canonicalization
- `/groups/:slug` and `/group/:address` aliases

## Runtime Characterization

`MainSite.routes.test.jsx` now pins the runtime bodies that were previously easy to stub around:

- Listener lifecycle: registry cache listener, SBT listener, and survey listener registration/removal across mount, stable update, and unmount.
- Registry bootstrap: MainSite wiring of `_registryBootstrapPromise` and `_registryBootstrapScopeKey`, failure cleanup, same-scope reuse, and scope-change restart.
- User profile scan fan-out: invalid-address early exit, in-flight dedupe, contract read arguments, and cache writes for user/SBT/survey/question discoveries.
- Survey event reconciliation: real `SurveyAdded` body writes survey/question caches and preserves Arweave retry branches.
- Network re-init: SBT detail route tears down active/detail listeners before rebuilding cache/listener state.

The characterization tests intentionally pin behavior as-is. They do not move `contractScripts`, `sessionRegistry`, or `arweaveRetryHelpers` out of MainSite.

## Extracted Controllers And Helpers

### Cache and readiness

- `client/src/utilities/cache/sessionCacheReadinessController.ts`
  Owns readiness patching, local revision batching, cross-tab cache updates, and aggregate ready checks.
- `client/src/utilities/cache/sessionCachePersistenceController.ts`
  Owns slug-scoped flag reads/writes and persisted cache-loaded state.
- `client/src/utilities/cache/mainSiteDgStorage.js`
  Owns DG local cache key/read/write/remove behavior.

### Session path and display

- `client/src/components/MainSite/routeSessionResolution.ts`
  Pure URL/session slug and ID resolution helpers.
- `client/src/components/MainSite/sessionPathResolverController.ts`
  Async route session ID/slug resolver state.
- `client/src/components/MainSite/sessionFallbackRedirect.ts`
  List-scope fallback redirects and temporary root/about redirect guards.
- `client/src/components/MainSite/sessionDisplayHelpers.ts`
  Session name/info/header display resolution.
- `client/src/domains/sessions/sessionMediaUrls.ts`
  Typed domain wrapper for session media URL normalization. MainSite uses this instead of importing `utilities/arweave/arweaveUrls` directly.

### Scan policy and profile scan

- `client/src/utilities/session/mainSiteSessionScanPolicy.js`
  Owns scan-scope policy, SBT instance listener gates, and scoped slug filtering.
- `client/src/utilities/session/sessionProfileScanController.ts`
  Owns profile-scan scope helpers, registry hydration/dedup state, retry scheduling, and scan telemetry helpers.
- `client/src/utilities/session/profileScanReportHelpers.js`
  Pure profile-scan fan-out plan and report-shape helpers.

### Metadata and cache entry shaping

- `client/src/utilities/session/metadataSessionBinding.ts`
  Pure session binding/envelope helpers for metadata caches.
- `client/src/utilities/survey/metadataCacheEntryBuilders.ts`
  Pure survey/question metadata cache entry preparation.

### SBT, survey, question, and response pipelines

- `client/src/utilities/sbt/sessionSbtCacheController.js`
  SBT cache initialization, refresh, listener startup, and realtime event forwarding.
- `client/src/utilities/sbt/sbtLiveProgressController.js`
  SBT scan live-progress state.
- `client/src/utilities/sbt/sbtRealtimeCoverageController.js`
  Per-group SBT realtime coverage flags.
- `client/src/utilities/sbt/sbtRealtimeListenerCleanupController.js`
  SBT listener removal and coverage cleanup.
- `client/src/utilities/sbt/sbtRealtimeListenerPlan.js`
  Pure per-instance SBT listener attach/skip planning.
- `client/src/utilities/sbt/sbtRealtimeEventBlockResolver.js`
  Realtime SBT event block-number resolution.
- `client/src/utilities/sbt/sbtRealtimeEventCursorGuard.js`
  Ordered cursor skip decisions for realtime SBT events.
- `client/src/utilities/sbt/sbtRealtimeCursorCache.js`
  Per-network realtime SBT cursor mutation.
- `client/src/utilities/survey/sessionSurveyCacheController.ts`
  Survey cache initialization, survey response refresh, and survey/question listener startup.
- `client/src/utilities/survey/sessionQuestionCacheController.ts`
  Question cache initialization, metadata refresh, decrypt context, and masked payload refresh.
- `client/src/utilities/survey/sessionResponseHydrationController.ts`
  Question response hydration and chunked refresh.

## MainSite-Owned Bodies

These remain inside `MainSite.tsx` by design for this lane:

- `componentDidMount`
- `componentWillUnmount`
- `componentDidUpdate`
- `handleNetworkChange`
- `scanSpecificUserProfilePriority`
- `scanSpecificUserProfile`
- `scanForSurveyGroup`
- `onNewSurveyEventDetectedForGroup`
- `_render*Route` methods
- `getMainView`
- `render`

## Runtime Flow

```text
URL + Redux session state + wallet/network
  -> routeTable classification + session path resolution
  -> mount/update/network orchestration
  -> cache initialization and registry bootstrap
  -> listener startup for SBT and survey/question events
  -> readiness consolidation
  -> lazy route view rendering
  -> child refresh handlers update caches and revisions
```

## Boundary Seams

MainSite started this lane with four client-boundary baseline entries:

- `utilities/arweave/arweaveUrls`
- `utilities/arweave/arweaveRetryHelpers`
- `utilities/web3/contractScripts`
- `utilities/web3/sessionRegistry`

`arweaveUrls` is now cleared through `domains/sessions/sessionMediaUrls.ts`.

The other three entries stay intentionally baselined:

- `arweaveRetryHelpers` remains in scan/hydration cache-merge bodies.
- `contractScripts` remains in listener teardown/startup, profile scan fan-out, survey event reconciliation, and cache refresh bodies.
- `sessionRegistry` remains in route/session lookup, registry bootstrap, and cache update wiring.

## Frontend Architecture Readiness Matrix

| Area | Controller-routed | Typed contract module present | Test-pinned | Parent-owned | Blocked reason | Next safe lane |
|---|---|---|---|---|---|---|
| Route classification | Yes | N/A | Yes | `MainSite.getMainView` renders | None | Route props can move only after route-table consumers stabilize |
| Session media URL normalization | Yes | Yes | Yes | MainSite supplies helper to `sessionDisplayHelpers` | None | Share with Admin/storage URL domain when Admin lane lands |
| Listener lifecycle | Partial | No | Yes | MainSite lifecycle starts/removes listeners | Characterization landed, movement owned by PRD 449/556 | Extract listener orchestration after contract listener ports exist |
| Registry bootstrap and route session lookup | Partial | No | Yes | MainSite + `sessionProfileScanController` bridge state | Characterization landed, movement owned by PRD 449/556 | Session registry route/read ports |
| User profile scan fan-out | Partial | No | Yes | MainSite owns scan body and cache writes | Characterization landed, movement owned by PRD 449/556 | Profile scan reducer/controller extraction |
| Survey event reconciliation | Partial | No | Yes | MainSite owns real-time cache reconciliation | Characterization landed, movement owned by PRD 449/556 | Survey/question event reconciliation controller |
| Arweave retry branch merge | No | N/A | Yes | MainSite owns cache merge call sites | Characterization landed, movement owned by PRD 449/556 | Question cache hydration/retry controller |

## Edit Heuristics

- For URL matching or route order, start in `routeTable.ts` and then inspect `getMainView`.
- For route session slug/ID behavior, inspect `routeSessionResolution.ts` and `sessionPathResolverController.ts` before editing MainSite.
- For session header/media display, inspect `sessionDisplayHelpers.ts` and `domains/sessions/sessionMediaUrls.ts`.
- For profile scans, inspect `sessionProfileScanController.ts` and `profileScanReportHelpers.ts` before touching `scanSpecificUserProfile`.
- For listener leaks or duplicate events, inspect `contractEventListeners.ts`, `sessionSbtCacheController.js`, `sessionSurveyCacheController.ts`, and the listener characterization tests before editing lifecycle code.
- For cache readiness drift, inspect `sessionCacheReadinessController.ts` and `sessionCachePersistenceController.ts` before editing mount/update code.
