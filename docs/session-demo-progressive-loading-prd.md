# Session Demo Progressive Loading PRD

## Problem

Cold session loads can show a full-screen block scan even after the chain scan has
already found enough data to render useful questions. This makes large sessions
feel frozen: a viewer may see millions of blocks left instead of the first
available question.

The About page is also a high-intent entry point. When a visitor opens
`/about`, the client knows which session the `Demo` CTA will open, including the
listed sessions in list mode, but the page does not explicitly warm that session
data. A visitor who clicks `Demo` can therefore pay the full cache discovery cost
after the click.

## Goals

- Show the first renderable question as soon as at least one question is
  discovered and hydrated.
- Continue block discovery in the background after questions are visible.
- Replace the full-screen loading gate with a compact top-right spinner once at
  least one question is visible.
- Show block progress in a hover tooltip on the compact spinner.
- Warm the About page's Demo target as soon as `/about` opens.
- In list mode, warm the listed sessions, with the Demo CTA target first.
- Keep the implementation client-only for the first release.
- Define the future Cloudflare-hosted session path for faster demo loading.

## Non-Goals

- Changing smart contract ABIs or event schemas.
- Replacing the existing local IndexedDB cache structure.
- Loading every response before the first question can render.
- Making `/about` block on cache warmup.
- Adding production Worker KV secrets or modifying production config in this
  PRD's first implementation.
- Decrypting gated content earlier than current wallet/session authorization
  allows.

## Current Behavior

- `getAllQuestionIDsChunkedWithCallback()` scans logs and emits partial question
  IDs only after the full scan returns.
- `initializeQuestionCacheForGroup()` receives a partial callback but does not
  use it.
- `SurveyQuestions` can render once `questionPool` contains questions, but it
  cannot get those questions until discovery yields IDs and metadata hydration
  has started.
- `/about` renders `AboutPage` without a session warmup contract. Generic app
  initialization may warm a primary session, but it is not Demo-CTA-aware and is
  not a list-mode fanout warmup.

## User Experience

On a cold session load:

- If zero questions are visible, keep the existing full loading surface.
- As soon as one question is hydrated, render the normal question interface.
- While discovery continues, show a compact top-right spinner.
- The spinner should use the existing FontAwesome spinner pattern and a tooltip.
- Tooltip copy should include:
  - blocks left
  - scanned / total blocks
  - current phase (`Scanning blocks`, `Loading questions`, or `Syncing`)
- The spinner should disappear once scan and hydration are complete.
- If scan errors occur after some questions are visible, keep questions visible
  and surface the error through the same compact status affordance.

On `/about`:

- Start a background warmup after the route is mounted and the cache manager is
  ready.
- The warmup must not delay About page rendering or video playback.
- The `Demo` CTA target should be warmed first.
- In list mode, continue warming remaining listed sessions in the background.
- If the user clicks `Demo` during warmup, the destination session should reuse
  in-flight work instead of starting a duplicate scan.

## Implementation Plan

### 1. Stream Question IDs During Block Discovery

- Extend the log-fetch progress contract to support `onLogs` for question
  discovery scans.
- In `getAllQuestionIDsChunkedWithCallback()`, parse `QuestionsAdded` logs per
  completed segment, merge the IDs into a de-duplicated set, and call
  `onPartialData(partialIds, segmentToBlock)` after each segment that yields new
  IDs.
- Preserve final return behavior so existing callers still receive the complete
  de-duplicated list.
- Keep progress monotonic even when the log fetcher splits ranges or runs
  segments concurrently.

### 2. Hydrate Partial Questions Immediately

- Replace the no-op partial callback in `initializeQuestionCacheForGroup()` with
  a small partial-hydration scheduler.
- Track discovered IDs already queued or hydrated during the current run to
  avoid duplicate Arweave fetches.
- Hydrate partial IDs in small batches, using the same metadata fetch options as
  the final hydration path.
- Write partial question metadata to `questionsCache` after each successful
  batch.
- Increment `questionResponsesNonce` when the first hydrated question is written
  so downstream question views reload from cache.
- Set `isQuestionCacheReady` to `true` once the cache has at least one hydrated
  question, while keeping `questionScanProgress.phase` active until discovery is
  done.
- Continue final hydration after the scan completes to catch IDs missed by
  partial scheduling or still pending due to rate limits.

### 3. Render Visible Questions While Work Continues

- Keep the full-screen loading state only while there are no visible questions.
- Once `questionPoolReady` is true, render questions even if
  `questionScanProgress` is still active.
- Add a compact progress status prop to `SurveyQuestionsRouteSurface` or the
  narrowest shared route shell that covers the question surface.
- Render a top-right spinner when:
  - there is a visible question pool, and
  - scan or hydration progress is active for the current slug.
- Reuse the existing tooltip pattern:
  `<FontAwesomeIcon icon={faQuestionCircle}/>` plus `UncontrolledTooltip`, or
  the local tooltip abstraction if the surface already uses one.
- Keep the spinner fixed inside the question route surface, not globally fixed
  over unrelated pages.

### 4. About Page Demo Warmup

- Add a `MainSite` warmup coordinator for static routes that can prepare session
  data without blocking rendering.
- Gate `/about` warmup behind a public runtime/build-time toggle, defaulting on
  for now. The toggle should let operators disable eager demo warmup if RPC
  budgets, hosted demo snapshots, or deployment-specific policy require it.
- Trigger warmup when the effective route is `/about` and the toggle is enabled.
- Resolve warmup targets from stored global session selection:
  - list mode: all selected session slugs, de-duped, with the Demo CTA target
    first;
  - active mode: selected primary session;
  - general mode: general session;
  - all mode: Demo CTA target first, then a bounded configured demo/default
    target list.
- Warm each target in demo-priority order:
  1. question cache
  2. light SBT metadata
  3. question responses
  4. survey cache
- Run warmup with background UI suppression, but still write caches and publish
  nonce/cache-update signals so later navigation can reuse the data.
- Coalesce warmup with existing in-flight cache initializers by slug.
- Apply concurrency limits:
  - one primary target immediately;
  - remaining list-mode targets sequentially or with a small concurrency cap.
- Cancel or deprioritize remaining warmup if the user navigates to an RPC-heavy
  route.

### 5. Future Cloudflare Session Fast Path

Add a hosted session snapshot option for demo-grade sessions:

- A Cloudflare Worker endpoint returns a versioned session snapshot containing
  public question metadata, survey metadata, SBT display metadata, and safe
  aggregate response summaries.
- Client warmup checks for a snapshot before starting on-chain discovery.
- If the snapshot is fresh enough, the client hydrates the local cache from the
  snapshot and then starts a background chain delta scan from the snapshot
  watermark.
- The snapshot must never contain private keys, Worker KV secrets, undecrypted
  gated payloads, or unauthorized response details.
- The first Cloudflare implementation should be opt-in per session and suitable
  for public demo sessions before it is generalized.

## Data Contracts

### Partial Discovery Event

```ts
type PartialQuestionDiscoveryEvent = {
  slug: string;
  fromBlock: number;
  toBlock: number;
  questionIds: string[];
  cumulativeQuestionCount: number;
};
```

### Compact Loading Status

```ts
type QuestionCompactLoadingStatus = {
  phase: 'scan' | 'hydrate' | 'sync' | 'error';
  blocksLeft: number;
  scannedBlocks: number;
  totalBlocks: number;
  itemsLeft?: number;
  tooltip: string;
};
```

### Cloudflare Session Snapshot

```ts
type PublicSessionSnapshotV1 = {
  type: 'ce_public_session_snapshot';
  version: 1;
  sessionSlug: string;
  chainId: number;
  generatedAt: string;
  fromBlock: number;
  toBlock: number;
  questions: Record<string, unknown>;
  surveys: Record<string, unknown>;
  sbtDisplay: Record<string, unknown>;
  aggregateResponses?: Record<string, unknown>;
};
```

## Acceptance Criteria

- A cold session with at least one early `QuestionsAdded` event renders a
  question before the full block range is scanned.
- The top-right spinner remains visible while later blocks are still scanning.
- Hovering the spinner shows blocks left and scanned / total progress.
- The full-screen loading state is only shown when zero questions are available.
- Partial discovery and final discovery produce the same final question set.
- Partial hydration does not duplicate Arweave fetches for the same question ID.
- `/about` starts background warmup for the Demo CTA target when the warmup
  toggle is enabled.
- The `/about` warmup toggle defaults on and can be disabled by config without
  code changes.
- In list mode, `/about` also warms the listed sessions after the CTA target.
- Clicking `Demo` during warmup reuses in-flight cache work.
- Warmup failures do not break About page rendering.
- Tests cover partial question discovery, compact loading status visibility, and
  About warmup target ordering.

## Test Plan

- Unit test `getAllQuestionIDsChunkedWithCallback()` with mocked per-segment
  logs and assert partial callbacks fire before final return.
- Unit test `initializeQuestionCacheForGroup()` partial hydration:
  - first partial ID writes a question to cache;
  - readiness turns true after first hydrated question;
  - final scan still completes and watermarks advance.
- Component test `SurveyQuestions`/route surface:
  - renders loading surface with zero questions;
  - renders question cards plus compact spinner with one question and active
    scan progress;
  - tooltip contains blocks-left text.
- MainSite route test:
  - `/about` triggers warmup for the CTA target;
  - list mode warms all listed sessions in deterministic order;
  - navigation to `/session/<slug>` reuses the in-flight initializer.
- E2E smoke test against a fixture session with a wide block window and early
  question event to confirm first question appears before scan completion.

## Rollout

1. Ship progressive client-side question discovery and compact status.
2. Ship `/about` background warmup for existing on-chain/local cache reads.
3. Add diagnostics counters for time-to-first-question and time-to-demo-ready.
4. Prototype Cloudflare public session snapshots for a single public demo
   session.
5. Generalize snapshots only after privacy review and freshness semantics are
   proven.
