# MainSite Map

## Quick Reference

- File: `client/src/components/MainSite/MainSite.tsx`
- Component type: typed React class component (`MainSite extends Component`)
- Type definitions: `client/src/components/MainSite/MainSiteTypes.ts`
- Route classifier: `client/src/components/MainSite/routeTable.ts`
- Route view map: `client/src/components/MainSite/mainSiteRouteViewMap.ts`
- Route classifier tests: `client/src/components/MainSite/routeTable.test.ts`
- Runtime characterization tests: `client/src/components/MainSite/MainSite.routes.test.jsx`
- Session media URL domain helper: `client/src/domains/sessions/sessionMediaUrls.ts`

`MainSite` is still the application shell and runtime orchestrator. It resolves session context from URL, Redux, registry cache, and wallet/network state; wires cache/readiness/profile/SBT/survey/question/response controllers; manages listener lifecycle; and dispatches lazy route views.

This map intentionally avoids exact line numbers. MainSite is still changing during the PRD 645/646 modernization lanes, so name-based navigation is the durable index.

## Route Dispatch

Route matching is now classified by the pure `resolveMainSiteRouteMatch` table in `routeTable.ts`, while route-key-to-view assembly lives in `mainSiteRouteViewMap.ts`. `MainSite.getMainView` remains the rendering caller and still owns URL side effects such as `/new` canonicalization and question/survey responder query normalization.
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

`MainSite.routes.test.jsx` pins the runtime bodies that were previously easy to stub around:

- Listener lifecycle: registry cache listener, SBT listener, and survey listener registration/removal across mount, stable update, and unmount.
- Registry bootstrap: MainSite wiring of `_registryBootstrapPromise` and `_registryBootstrapScopeKey`, failure cleanup, same-scope reuse, and scope-change restart.
- User profile scan fan-out: invalid-address early exit, in-flight dedupe, contract read arguments, and cache writes for user/SBT/survey/question discoveries.
- Survey event reconciliation: real `SurveyAdded` body writes survey/question caches and preserves Arweave retry branches.
- Network re-init: SBT detail route tears down active/detail listeners before rebuilding cache/listener state.

The characterization tests intentionally pin behavior as-is. The follow-up domain-port lane then routed the former `contractScripts`, `sessionRegistry`, and `arweaveRetryHelpers` low-level imports through typed purpose ports and domain helpers while preserving those pinned call shapes.

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
- `client/src/components/MainSite/mainSiteRouteViewMap.ts`
  Pure route-key-to-view assembly used by `MainSite.getMainView`; route side effects and query normalization stay in the class component.
- `client/src/domains/sessions/sessionMediaUrls.ts`
  Typed domain wrapper for session media URL normalization. MainSite uses this instead of importing `utilities/arweave/arweaveUrls` directly.
- `client/src/utilities/session/sessionBackendKind.ts`
  Pure page-boundary classifier for session page backend mode. Shared render
  bodies should receive the resolved mode instead of branching on inline
  Telegram-specific ternaries.

### Domain ports

- `client/src/domains/sessions/registry/sessionRegistryReadPorts.ts`
  Typed session-registry read/cache port used by MainSite for cache load, store reads, session fetches, cache-update subscription, session config reads, and session ID formatting.
- `client/src/domains/chain/contractScriptsChainScanReadsPort.ts`
  Typed chain-scan read port for latest-block, relevant block-window, and session read-provider access.
- `client/src/domains/profiles/contractScriptsProfileScanPort.ts`
  Typed user profile scan port for `getSBTsForUser` and `getUserActivity`.
- `client/src/domains/sbts/contractScriptsSbtEventStreamsPort.ts`
  Typed SBT/survey listener removal port preserving call-time `contractScripts` lookup for spy compatibility.
- `client/src/domains/sbts/contractScriptsSbtMetadataReadsPort.ts`
  Typed SBT metadata read port extended with SBT creation-block lookup.
- `client/src/domains/surveys/contractScriptsSurveyReadsPort.ts`
  Typed survey/question read port for survey hashes, survey/question data, and response reads.
- `client/src/domains/worker/contractScriptsFaucetFundingPort.ts`
  Typed faucet funding port for the MainSite testnet-funding call.
- `client/src/domains/surveys/questionArweaveCacheBranches.ts`
  Domain home for question Arweave cache branch preservation and merge helpers. The legacy utility module re-exports these helpers for remaining low-level consumers.

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

MainSite started the modernization lane with four client-boundary baseline entries:

- `utilities/arweave/arweaveUrls`
- `utilities/arweave/arweaveRetryHelpers`
- `utilities/web3/contractScripts`
- `utilities/web3/sessionRegistry`

All four are now cleared:

- `arweaveUrls` routes through `domains/sessions/sessionMediaUrls.ts`.
- `arweaveRetryHelpers` cache-branch helpers live in `domains/surveys/questionArweaveCacheBranches.ts`.
- `contractScripts` usage is purpose-split through chain, profile, SBT, survey, and faucet ports.
- `sessionRegistry` usage routes through `domains/sessions/registry/sessionRegistryReadPorts.ts`.

The client-boundary baseline is now 0/0.

## Frontend Architecture Readiness Matrix

| Area | Controller-routed | Typed contract module present | Test-pinned | Parent-owned | Blocked reason | Next safe lane |
|---|---|---|---|---|---|---|
| Route classification and view-map assembly | Yes | N/A | Yes | `MainSite.getMainView` renders and owns URL/query side effects | None | Route props can move only after route-table and route-view consumers stabilize |
| Session media URL normalization | Yes | Yes | Yes | MainSite supplies helper to `sessionDisplayHelpers` | None | Share with Admin/storage URL domain when Admin lane lands |
| Listener lifecycle | Partial | Yes | Yes | MainSite lifecycle starts/removes listeners | Listener orchestration still crosses mount/update/unmount state | Extract listener orchestration after attach-side controller ports converge |
| Registry bootstrap and route session lookup | Partial | Yes | Yes | MainSite + `sessionProfileScanController` bridge state | Bootstrap promise identity and route/session state stay parent-owned | Session bootstrap controller extraction |
| User profile scan fan-out | Partial | Yes | Yes | MainSite owns scan body and cache writes | Scan body still writes multiple caches and UI flags | Profile scan reducer/controller extraction |
| Survey event reconciliation | Partial | Yes | Yes | MainSite owns real-time cache reconciliation | Event reconciliation still owns cache writes and merge decisions | Survey/question event reconciliation controller |
| Arweave retry branch merge | Yes | Yes | Yes | MainSite owns cache merge call sites | Cache merge call sites remain inside scan/hydration bodies | Question cache hydration/retry controller |

## Edit Heuristics

- For URL matching or route order, start in `routeTable.ts` and then inspect `getMainView`.
- For route session slug/ID behavior, inspect `routeSessionResolution.ts` and `sessionPathResolverController.ts` before editing MainSite.
- For session header/media display, inspect `sessionDisplayHelpers.ts` and `domains/sessions/sessionMediaUrls.ts`.
- For profile scans, inspect `sessionProfileScanController.ts` and `profileScanReportHelpers.ts` before touching `scanSpecificUserProfile`.
- For listener leaks or duplicate events, inspect `chainEventStreams.ts`, `sessionSbtCacheController.js`, `sessionSurveyCacheController.ts`, and the listener characterization tests before editing lifecycle code.
- For cache readiness drift, inspect `sessionCacheReadinessController.ts` and `sessionCachePersistenceController.ts` before editing mount/update code.
