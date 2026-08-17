# Managed Client Cache Overview

This folder documents the client-side managed cache namespaces backed by
`client/src/utilities/cache/cacheScripts.ts`.

## Managed namespaces

The app currently manages these namespaces through the shared cache layer:

- `questionsCache`
- `surveysCache`
- `bookmarksCache`
- `filters`
- `sbtCache`
- `userCache`
- `analysisCache`

The canonical namespace registry is
`client/src/utilities/cache/managedCacheNamespaces.json`. Runtime cache APIs,
the MainSite DG facade, and the direct-localStorage guard all consume that
registry; a parity test keeps this documentation aligned with it.

Logical key format:

```text
dg:<namespace>:<slug>
```

Examples:

- `dg:questionsCache:edge`
- `dg:sbtCache:`
- `dg:userCache:test-10`

The general/default session uses the empty slug (`""`), so its keys end with a
trailing colon.

## Shared backend behavior

- Primary backend: IndexedDB via `idb-keyval`
  - DB name: `ce_cache_v1`
  - store name: `ce_cache_entries_v1`
- Synchronous render-safe reads come from the in-memory mirror (`peekCacheSync`, `listNamespaceEntriesSync`)
- Cross-tab propagation:
  - IndexedDB mode: `BroadcastChannel`
  - localStorage fallback mode: `storage` events
- Fallback behavior:
  - the cache layer does not immediately demote to localStorage on a single IndexedDB error
  - it falls back only after repeated consecutive IDB failures
- Legacy localStorage keys are still migrated best-effort for older installs
- `npm run test:cache-guard` scans all production client paths, including the
  canonical cache implementation, and rejects direct managed-cache access in
  dot, bracket, or optional-bracket form unless a dynamic namespace is guarded
  by the maintained managed-cache predicate.
- Survey, question, and SBT discovery, response/activity hydration, targeted refreshes,
  profile/selector enrichment, and application event ingestion commit domain deltas through the shared serialized
  atomic updater. Each updater receives the latest cache value, preserves unrelated
  branches and retry state, and keeps scan watermarks monotonic.
- Managed cache callers await persistence before publishing readiness, revisions,
  or success. A rejected write or explicit failure remains observable to awaited
  callers and does not publish a successful cache state.

## LocalStorage-only readiness flags

Tiny flags intentionally stay in localStorage:

- `dg:cacheHasLoaded:<slug>`
- `dg:sbt:partialReady:<slug>`
- `dg:sbt:deferredFullScanNeeded:<slug>`
- `dg:sbt:fullScanInProgress:<slug>`

Values are stringified booleans: `"true"` / `"false"`.

## Slug sources

Cache docs in this folder refer to `<slug>` as the canonical session slug used by:

- on-chain registry entries
- `demo_sessions.json`
- route/session state

Older references to `demoGroups.json` are historical and no longer canonical.

## Namespace docs

- [`surveys-and-questions-cache-structure.md`](surveys-and-questions-cache-structure.md)
- [`sbts-cache-structure.md`](sbts-cache-structure.md)
- [`bookmarks-cache-structure.md`](bookmarks-cache-structure.md)
- [`user-cache-structure.md`](user-cache-structure.md)
