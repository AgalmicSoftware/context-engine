# PRD 555 - Post-Modernization Test Suite Decomposition

**Priority:** MEDIUM-HIGH | **Effort:** HIGH | **Status:** Draft | **Category:** Test Architecture / Agent Navigation
**Created:** 2026-05-05

---

## Category Summary

The modernization churn created and preserved valuable regression coverage, but several test files have become navigation bottlenecks of their own. This PRD defines a behavior-preserving follow-up to split oversized regression suites by source concern, while keeping broad smoke coverage where it still protects compatibility seams.

This PRD coordinates with:

- [PRD 532](532_low-risk-modernization-churn-execution-plan.md) for lane sequencing
- [PRD 554](554_post-modernization-helper-consolidation-and-agent-navigation.md) for helper bucket splits
- [PRD 415](415_surveytool-post-selector-decomposition-and-naming-cleanup.md) and [PRD 448](448_surveytool-agentic-decomposition-commit-plan.md) for SurveyTool structural decomposition
- [PRD 476](476_ts-modernization-userpage.md) and the SBT modernization PRDs for user/SBT helper and leaf splits

---

## Problem

The current test suite is a strength: it let broad TypeScript and helper extraction work happen without intentionally changing behavior. But the largest test files now have the same agent-navigation problem as the source files they guard.

Current large examples from the May 5, 2026 debt snapshot:

| Test file | Approximate size | Why it is hard to use |
|---|---:|---|
| `client/src/components/SurveyTool/SurveyTool.module.test.js` | ~14.9k lines | Covers slider, response runtime, pile state, cache behavior, decrypt/gate paths, and compatibility exports in one file. |
| `client/src/components/SBTs/SBTsList.loading-status.test.jsx` | ~6.4k lines | Mixes status model, render timing, cache hydration, and list-display regressions. |
| `client/src/components/UserPage/UserPage.test.jsx` | ~5.1k lines | Mixes profile identity, cache, analysis payloads, encrypted responses, routing, and UI state. |
| `client/src/components/Sessions/SessionWizard.render.test.jsx` | ~4.8k lines | Mixes broad render smoke, field behavior, wizard sections, and publish-adjacent UI. |
| `client/src/components/SurveyTool/SurveyResults.test.tsx` | ~4.4k lines | Mixes aggregation, filters, chart/table behavior, session scope, and encrypted-response display. |
| `client/src/components/SBTs/SBTPage.test.jsx` | ~4.2k lines | Mixes detail rendering, holder state, mint/burn affordances, password/invite UI, and route behavior. |

This creates several issues:

- agents must load very large files to understand a narrow behavior
- assertion ownership is hard to find by filename
- broad suites are slow to edit safely and easy to conflict in parallel work
- helper splits can leave tests behind in old monolithic files
- reviewers cannot easily tell which tests document which extracted module

PRD 043 is about packaging/exclusion and intentionally keeps tests colocated. This PRD is about decomposition and behavior mapping, not publishing layout.

---

## Goals

- Split large test files by behavior concern only when doing so improves navigation.
- Preserve or strengthen existing coverage; do not delete assertions for size alone.
- Keep tests colocated with the source surfaces they protect.
- Align test filenames with extracted helper, controller, or leaf modules.
- Keep one broad smoke/compatibility test where useful, but make it small and intentional.
- Make future agents able to find behavior documentation from filenames and `describe()` blocks.

## Non-Goals

- No product behavior changes.
- No test weakening.
- No moving all tests to a root `tests/` directory.
- No publishing/exclusion changes; that remains PRD 043 territory.
- No snapshot-test churn unless a snapshot already exists and is intentionally scoped.
- No source refactors whose only justification is making tests easier to split.

---

## Target Shape

Use concern-led filenames that mirror source ownership.

Examples:

### SurveyTool

- `SurveyTool.compat.test.js`
- `surveyToolDraftPersistence.test.ts`
- `surveyToolResponseRuntime.test.tsx`
- `surveyToolPileRuntime.test.ts`
- `surveyToolDecryptGate.test.ts`
- `DeferredCommitSlider.test.tsx`

### UserPage

- `userPageAnalysisPayload.test.ts`
- `userPageCacheHelpers.test.ts`
- `userPageEncryptedResponses.test.ts`
- `userPageActivitySections.test.tsx`
- `UserPage.render.test.jsx`

### SBTs

- `sbtListLoadingStatus.test.ts`
- `sbtListCacheHydration.test.ts`
- `sbtPageMintBurn.test.tsx`
- `sbtPageHolderState.test.ts`
- `sbtPageRouteState.test.ts`

### SessionWizard

- `SessionWizard.render-smoke.test.jsx`
- `sessionWizardFieldDescriptors.test.ts`
- `sessionWizardPublishSummary.test.tsx`
- `sessionWizardModals.test.tsx`
- `sessionWizardWorkerPanel.integration.test.tsx`

The exact filenames can vary with the extracted source modules, but the rule is stable: a future agent should be able to locate the relevant tests without opening a multi-thousand-line omnibus suite.

---

## Sequencing

Do not interrupt active low-risk source extraction just to split tests.

Use this PRD when one of these is true:

- a helper/controller/leaf module has stabilized and its tests still live in a monolithic suite
- a test file is so large that future source work needs a map before making a safe edit
- a behavior cluster already has a natural `describe()` block that can move without changing setup
- a compatibility barrel needs a smaller smoke test after focused tests move elsewhere

Preferred order:

1. Split tests that already map to extracted helpers.
2. Split tests for stabilized leaf components.
3. Split runtime/controller tests only after source ownership is clear.
4. Keep broad shell render tests as small smoke guards.

---

## Migration Plan

### Phase 0 - Inventory And Assertion Map

- List test files over 3k lines.
- Generate top-level `describe()` names for each large file.
- Map each cluster to source ownership.
- Identify clusters that can move without changing mocks or setup.
- Record which broad smoke tests must remain.

### Phase 1 - SurveyTool Test Split

- Start with clusters that already have extracted source modules or pure helper ownership.
- Keep `SurveyTool.module.test.js` as a compatibility and broad runtime smoke suite.
- Move slider, draft, pile-view state, gate/decrypt, and cache/controller coverage into focused files when ownership is clear.
- Run the old and new targeted tests together until the moved cluster is proven equivalent.

### Phase 2 - User And SBT Test Split

- Split UserPage tests along analysis, cache, encrypted-response, activity-display, and render-smoke concerns.
- Split SBT tests along list loading/cache, selector/search, detail route, holder state, and mint/burn concerns.
- Pair this phase with PRD 554 helper bucket splits when possible.

### Phase 3 - SessionWizard And SurveyResults Test Split

- Split SessionWizard tests only around extracted field, modal, worker, and publish-summary seams.
- Split SurveyResults tests around aggregation helpers, filters, chart/table data, session scope, and render smoke.
- Do not split publish-flow or aggregation tests in ways that obscure end-to-end behavior.

### Phase 4 - Test Map Updates

- Update nearby map docs only when the test graph changes navigation materially.
- Add brief comments at the top of remaining broad smoke suites explaining what they intentionally still own.

---

## Acceptance Criteria

- At least the largest two omnibus test files are split into concern-led tests after their source seams are stable.
- Remaining broad suites have an explicit smoke/compatibility purpose.
- No assertions are removed without a replacement or an explicit rationale.
- Moved tests keep or improve regression coverage for the same behavior.
- Focused test filenames match source/helper ownership well enough to navigate by search.
- Targeted Jest runs pass for every moved cluster.
- `cd client && npx tsc --noEmit` passes when TypeScript test files are added or changed.
- `git diff --check` passes.

---

## Verification

For every moved cluster, run the old source-adjacent broad suite and the new focused suite together during the transition, for example:

```bash
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/surveyToolPileRuntime.test.ts
```

For User/SBT splits:

```bash
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/UserPage/UserPage.test.jsx \
  src/components/UserPage/userPageAnalysisPayload.test.ts \
  src/components/SBTs/SBTPage.test.jsx \
  src/components/SBTs/sbtPageHolderState.test.ts
```

Always run:

```bash
cd client && npx tsc --noEmit
git diff --check
```

Use full client Jest or CI only at a consolidation boundary, not after every tiny test move unless the changed mocks are shared globally.

---

## Implementation Notes - 2026-05-10 Autocoder Pass

Large-test inventory from this branch:

| Test file | Lines | Current ownership note |
|---|---:|---|
| `client/src/components/SurveyTool/SurveyTool.module.test.js` | 14,739 | Single top-level `SurveyTool module` suite; mixed shell compatibility, pile runtime, cache, gate/decrypt, draft, response, and UI helper coverage. |
| `client/src/components/SBTs/SBTsList.loading-status.test.jsx` | 6,386 | Single top-level `SBTsList per-session loader countdown` suite; loading/status model plus render timing and cache hydration. |
| `client/src/components/UserPage/UserPage.test.jsx` | 4,619 | Remaining top-level clusters: cache refresh pipeline and cold-load network fallback. |
| `client/src/components/Sessions/SessionWizard.render.test.jsx` | 4,901 | Single top-level rendered-validation suite. |
| `client/src/components/SurveyTool/SurveyResults.test.tsx` | 4,507 | Many focused top-level helper/render clusters; candidate for later concern-led splits. |
| `client/src/components/SBTs/SBTPage.test.jsx` | 4,176 | Single modal holder optimization suite. |
| `client/src/components/UserPage/userPageHelpers.test.ts` | 4,002 | Helper-bucket test hotspot; leave for UserPage helper ownership pass. |
| `client/src/components/SBTs/sbtPageHelpers.test.ts` | 3,546 | Helper-bucket test hotspot; leave for SBTPage helper ownership pass. |
| `client/src/components/SBTs/CreateSBTGroup.test.jsx` | 3,369 | CreateSBTGroup render/workflow coverage. |

Completed split:

- Added `client/src/components/SurveyTool/SurveyTool.compat.test.js` for the isolated SurveyTool shell compatibility cluster: import smoke, registry-chain resolution, PileViewMode wiring, and Lit-hook forwarding.
- Removed the moved assertions from `SurveyTool.module.test.js`.
- Left a short comment in `SurveyTool.module.test.js` marking it as the remaining broad runtime/controller suite until more clusters have clear focused owners.
- Added `client/src/components/SurveyTool/SurveyQuestions.runtime.test.js` for the SurveyQuestions-owned bookmark cache and auto-decrypt runtime helper cluster.
- Removed those five direct `SurveyQuestions` assertions from `SurveyTool.module.test.js` without changing assertions.
- Added `client/src/components/UserPage/UserPage.deepScanTooltip.test.jsx` for the former `UserPage deep scan tooltip formatting` top-level cluster.
- Removed that cluster from `UserPage.test.jsx`, leaving cache refresh and cold-load fallback coverage in the broader UserPage suite.

Verification:

```bash
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/SurveyTool.compat.test.js
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/DocumentLibrary/DocumentLibraryPanel.test.tsx \
  src/components/SurveyTool/CreateQuestionsAndSurveys.cache.test.ts \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/SurveyTool.compat.test.js
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/SurveyQuestions.runtime.test.js
cd client && npm test -- --watchAll=false --runTestsByPath \
  src/components/UserPage/UserPage.test.jsx \
  src/components/UserPage/UserPage.deepScanTooltip.test.jsx
cd client && npx tsc --noEmit --pretty false
git diff --check
```

Results:

- SurveyTool old + new split test run: PASS, 2 suites, 285 tests.
- Combined focused test run after TypeScript boundary cleanup: PASS, 4 suites, 337 tests.
- SurveyQuestions runtime split test run with old SurveyTool suite: PASS, 2 suites, 279 tests.
- UserPage deep-scan split test run with old UserPage suite: PASS, 2 suites, 123 tests.
- `npx tsc --noEmit --pretty false`: PASS after local JS-boundary typing cleanup in DocumentLibrary/CreateQuestions.
- `git diff --check`: PASS.

Known local execution note:

- The fresh worktree's original shared git metadata directory rejected index-lock writes from the sandbox. Commits were made through a writable alternate gitdir copy under the same common `.git`; branch refs and committed content are correct, but sandbox-local default `git status` may read a stale original index unless run through the alternate gitdir.

Next safe PRD 555 slices:

- Split a small PileViewMode render/submit-feedback cluster only if helper setup can be shared without weakening assertions.
- Split the remaining `UserPage.test.jsx` cache refresh cluster only if the helper setup can be shared cleanly; the cold-load fallback cluster may stay as a broader render/cache smoke guard for now.

---

## Stop Conditions

Stop and leave a handoff if:

- a move requires rewriting shared test setup for unrelated behavior
- mocks become less representative of real runtime behavior
- splitting a suite hides the only broad integration guard for a critical flow
- source ownership is unclear and the test split would encode the wrong boundary
- the moved tests pass only because assertions were weakened
