# PRD 550 - Modernization Churn Continuation Handoff

## Integration Status - 2026-05-11

The modernization branch is merged into
`autocoder/integration-agent-storage-modernization` as a set of safe typed/test
and dependency-cleanup slices. It is not the end of modernization. Remaining
work should stay leaf-oriented: PRD 555 test decomposition, PRD 430 selector
naming cleanup, narrowly scoped typing leaves, and a separate client toolchain
decision.

Do not use this PRD as permission for broad SBTPage class-state typing,
CRA/toolchain migration, or behavior changes during a Telegram continuation.

**Priority:** High
**Effort:** Medium-high
**Status:** Draft
**Category:** TypeScript modernization / tech debt
**Created:** 2026-05-03
**Last refreshed:** 2026-05-10

---

## Problem

The local modernization branch has made broad progress on TypeScript boundary cleanup, but safe leaves remain across large client surfaces. The next run should continue from this handoff instead of restarting discovery, preserve runtime behavior, and keep changes in small reviewable slices.

This handoff was refreshed after the latest UserPage and small SurveyTool typing continuation.

---

## Goals

- Continue reducing obvious `any` / broad-record debt where the local boundary is clear.
- Preserve runtime behavior unless a clear bug is found and covered.
- Prefer parser-owned normalization and permissive known-fields-plus-passthrough shapes.
- Keep using TypeScript-only boundary types. Do not add runtime schema dependencies.
- Keep worker config/cache replica types separate from public session metadata.
- Continue one adapter, helper, or component leaf at a time.
- Run focused tests, `npx tsc --noEmit --pretty false`, and `git diff --check` for each meaningful batch.
- Leave an updated TODO handoff whenever pausing.

## Non-Goals

- No dependency additions.
- No `ethers` upgrade.
- No smart contract changes.
- No public contract interface changes.
- No secrets, production config, or worker KV changes.
- No MainSite class-to-function conversion.
- No giant `MainSiteHost` rewrite.
- No SurveyQuestions structural decomposition until safer lanes are exhausted.

---

## Architecture Rules

- Use shared TypeScript-only boundary types when shared ownership exists.
- Use local `Record<string, unknown>` / `[key: string]: unknown` shapes for component-local passthrough payloads.
- Keep runtime normalization in parser/controller/helper owners.
- Avoid brittle exact deep schemas for cache, metadata, AI, or legacy persisted payloads.
- Tighten host/controller adapters one controller at a time.
- Skip a lane if the next step becomes architecture-heavy; move to another independent safe leaf.

---

## Current Pause Point

The branch has the earlier thematic squash after base `a7fce9bb`, followed by the latest continuation commits:

```text
75fc2fef refactor(autocoder): type main site boundaries
d180b610 refactor(autocoder): type session wizard boundaries
fdf05ada refactor(autocoder): type survey tool controllers
4552853d refactor(autocoder): type sbt management boundaries
46875025 refactor(autocoder): type create sbt helper boundaries
89dc98a4 refactor(autocoder): type sbt page helper boundaries
1d7a1f59 refactor(autocoder): type user page boundaries
1ca54ee4 docs(autocoder): refresh modernization churn handoff
c16da11f refactor(autocoder): type user page analysis cache helpers
eed6de52 refactor(autocoder): type user page navigation helpers
eff304bc refactor(autocoder): type survey post-submit cache boundary
f950bd50 refactor(autocoder): type beeswarm plot event boundary
68a2eeec refactor(autocoder): type survey page prop boundary
```

This PRD should remain the final docs commit after the code commits.

Safety branches preserving earlier pre-squash local history:

```text
autocoder/pre-userpage-final-squash-20260503002833
autocoder/pre-final-userpage-squash-20260503004424
autocoder/pre-final-modernization-squash-20260503010523
autocoder/pre-final-modernization-squash-20260503013136
autocoder/pre-final-modernization-squash-20260503020034
```

Earlier post-squash code-equivalence check:

```bash
backup=autocoder/pre-final-modernization-squash-20260503020034
git diff --stat "$backup"..HEAD -- ':!TODO/PRDs/550_modernization-churn-continuation-handoff.md'
```

Expected result from that squash pass: no diff output. The squashed code tree preserved the pre-squash code changes; only the refreshed TODO handoff differed.

---

## Completed In This Churn Lane

- MainSite host/controller boundaries were tightened across cache readiness, persistence, route/session helpers, metadata cache helpers, storage eviction helpers, telemetry helpers, and related tests.
- SessionWizard local boundaries were moved away from broad `any` usage where shared session boundary types or local unknown-record shapes were clear.
- SurveyTool controller leaves were typed across pile/cache/session/response controllers with focused controller tests retained.
- SBT management surfaces were typed across list render buckets, list callbacks, list props, selector render/handler paths, SBTSelector universe discovery, SBTSelector option loading, and list/cache helper tests.
- CreateSBTGroup helper boundaries were typed across recovery-code persistence, deferred deploy plan helpers, deferred draft upload finalization, QR/image helpers, and predictable deploy payloads. A focused QR render-to-blob guard test was added.
- SBTPage helper boundaries were typed across recovery-code cache store helpers, password auto-mint, mint/burn wrappers, info loading, holder-state callbacks, invite claim helpers, and the contract-script boundary. Minting behavior, password semantics, invite links, and contract-write flows were preserved.
- `CompareAddresses` cache/helper boundaries were typed with local unknown-record guards, and focused cache helper tests were updated.
- `SimUserPage` demo JSON adapters and test mocks were moved to local typed passthrough shapes.
- `UserPage` analysis/global helper boundaries, deep-scan progress rows, tooltip rendering helpers, spinner status adapters, cached response payload parsing, legacy payload normalization, response-recency helpers, bookmark cache helpers, managed cache handling, profile telemetry, deep-scan report intake, nickname helpers, refresh memo/queue helpers, network-cache readers, gate-access cache helpers, encrypted response helpers, decrypt survey binding, aggregate section helpers, UI helper callbacks, AI session-scope helpers, analysis-cache helpers, and small navigation/toggle helpers were typed.
- `surveyToolPostSubmitCacheController.ts` now uses permissive submitted-response and receipt boundary types instead of broad `any` payloads.
- `BeeswarmPlot.tsx` now uses unknown passthrough point fields and a minimal tooltip event boundary.
- `SurveyPage.tsx` now has a known passthrough prop shape with an `unknown` index signature instead of `[key: string]: any`.

---

## Verification Snapshot

Latest continuation verification:

```bash
cd client
npm test -- --watchAll=false --runTestsByPath \
  src/components/UserPage/UserPage.test.jsx \
  src/components/SurveyTool/SurveyTool.module.test.js \
  src/components/SurveyTool/BeeswarmPlot.test.tsx \
  src/components/SurveyTool/BeeswarmPlot.module.test.ts \
  src/components/SurveyTool/SurveyPage.test.tsx
npx tsc --noEmit --pretty false
cd ..
git diff --check 1ca54ee4..HEAD
```

Results:

```text
Latest targeted Jest set: PASS, 5 suites, 403 tests
npx tsc --noEmit --pretty false: PASS
git diff --check 1ca54ee4..HEAD: PASS
```

Focused verification during this continuation also included:

```text
UserPage.test.jsx: PASS, 122 tests
SurveyTool.module.test.js: PASS, 274 tests
BeeswarmPlot.test.tsx + BeeswarmPlot.module.test.ts: PASS, 4 tests
SurveyPage.test.tsx + SurveyTool.module.test.js: PASS, 277 tests
```

Earlier post-squash verification:

```text
Broad touched-surface Jest set: PASS, 55 suites, 992 tests
npx tsc --noEmit --pretty false: PASS
git diff --check a7fce9bb..HEAD: PASS
Post-squash code-equivalence diff against autocoder/pre-final-modernization-squash-20260503020034, excluding this PRD: PASS, no diff output
```

Known existing Jest noise:

- ReactDOMTestUtils `act` deprecation warning.
- FontAwesome `defaultProps` warning.
- Existing async state update warnings around SBT list/selector and SurveyQuestions tests.
- Existing jsdom `HTMLCanvasElement.prototype.toDataURL` warning noise in `UserPage.test.jsx`.
- Expected logged errors in tests that intentionally exercise failure paths.

---

## Fresh Hotspot Snapshot

Production-file command:

```bash
rg --count-matches --glob '*.{ts,tsx,js,jsx}' --glob '!*.test.*' \
  "AnyRecord|Record<string, any>|: any|as any|\\[key: string\\]: any|\\.\\.\\.args: any\\[\\]" \
  client/src/components/MainSite \
  client/src/components/Sessions/SessionWizard.tsx \
  client/src/components/SBTs \
  client/src/components/UserPage/UserPage.tsx \
  client/src/components/SurveyTool \
  client/src/utilities/session | sort
```

No output currently from:

```text
client/src/components/MainSite
client/src/components/Sessions/SessionWizard.tsx
client/src/utilities/session
client/src/components/UserPage/CompareAddresses.tsx
client/src/components/UserPage/SimUserPage.tsx
client/src/components/SurveyTool/BeeswarmPlot.tsx
client/src/components/SurveyTool/SurveyPage.tsx
client/src/components/SurveyTool/surveyToolPostSubmitCacheController.ts
```

Remaining production hotspots:

```text
client/src/components/SBTs/CreateSBTGroup.tsx:1
client/src/components/SBTs/SBTPage.tsx:2
client/src/components/SBTs/SBTSelector.tsx:4
client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx:336
client/src/components/SurveyTool/QuestionFilter.tsx:254
client/src/components/SurveyTool/SingleQuestionResponse.tsx:116
client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx:143
client/src/components/SurveyTool/SurveyResults.tsx:430
client/src/components/SurveyTool/SurveySelector.tsx:115
client/src/components/SurveyTool/SurveyTool.tsx:52
client/src/components/SurveyTool/surveyToolHydrationController.ts:36
client/src/components/SurveyTool/surveyToolResponseGateController.ts:42
client/src/components/UserPage/UserPage.tsx:73
```

Oversized components still worth decomposing only through safe helper leaves:

```text
client/src/components/MainSite/MainSite.tsx:6522 lines
client/src/components/UserPage/UserPage.tsx:6444 lines
client/src/components/SBTs/CreateSBTGroup.tsx:5568 lines
client/src/components/SBTs/SBTPage.tsx:5638 lines
client/src/components/SurveyTool/SurveyResults.tsx:5414 lines
client/src/components/Sessions/SessionWizard.tsx:5101 lines
client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx:3977 lines
client/src/components/SurveyTool/QuestionFilter.tsx:3591 lines
client/src/components/SBTs/SBTSelector.tsx:3121 lines
client/src/components/SurveyTool/SurveySelector.tsx:1852 lines
client/src/components/SurveyTool/SingleQuestionResponse.tsx:1598 lines
client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx:2363 lines
```

Test-local hotspots remain in SBTSelector and SurveyTool tests. Do not prioritize test typing over production leaves unless touching the test for a behavior guard.

---

## Debt Coverage Update - 2026-05-05

The May 5 debt snapshot showed that the main debt areas are covered, but the coverage is now split across execution PRDs:

| Debt area | Current owner |
|---|---|
| Continued low-risk TS/helper churn | [PRD 532](532_low-risk-modernization-churn-execution-plan.md) |
| Oversized helper buckets created by modernization | [PRD 554](554_post-modernization-helper-consolidation-and-agent-navigation.md) |
| Oversized regression-test suites | [PRD 555](555_post-modernization-test-suite-decomposition.md) |
| `contractScripts.impl.ts` as a post-TS web3/domain hotspot | [PRD 556](556_contractscripts-post-ts-domain-split.md) |
| Deferred web3 runtime convergence after modernization | [PRD 525](525_web3-runtime-convergence-after-modernization.md) |

Interpretation:

- Type debt has materially improved, but large runtime and helper files still need concern-led navigation cleanup.
- Test debt is now explicit: keep the safety net, but split omnibus suites once source ownership stabilizes.
- `contractScripts.impl.ts` should get a domain split before any ethers/viem runtime convergence is attempted.
- PRD 525 remains last; do not mix runtime migration into helper, test, or domain-split cleanup.

---

## Recommended Next Queue Head

Start with:

```text
client/src/components/UserPage/UserPage.tsx
```

Exact next leaf:

```text
Type UserPage analyzeUser payload extraction boundary
```

Why this is next:

- MainSite, SessionWizard, session utilities, CompareAddresses, SimUserPage, BeeswarmPlot, SurveyPage, and the post-submit cache controller are clean in the scoped production hotspot scan.
- CreateSBTGroup, SBTPage, and SBTSelector are down to class-level props/state/index residues; do not force broad class typing rewrites as casual churn.
- `surveyToolHydrationController.ts` and `surveyToolResponseGateController.ts` still have focused tests, but their remaining hotspots cross several callback contracts and should be handled one function-family at a time, not as a drive-by pass.
- UserPage still has a well-tested `analyzeUser` cluster. The next safe slice is local payload extraction typing, not changing AI routing or cache semantics.

Suggested implementation:

1. Limit the next leaf to local `analyzeUser` helper shapes: `extractAdditionalComment`, `extractImportance`, SBT summary mapping, question response mapping, survey response sample mapping, and created-survey cache reads.
2. Add local permissive unknown-record types for response fields and analysis payload rows.
3. Preserve the exact `userData` payload shape sent to `analyzeUserOpinions`.
4. Do not alter AI session selection, fallback routing, analysis-cache keys, force refresh, or UI modal state in this leaf.
5. Run `UserPage.test.jsx`; it already covers analysis payload construction, cache hits/misses, and routing fallbacks.

Targeted verification:

```bash
cd client
npm test -- --watchAll=false --runTestsByPath src/components/UserPage/UserPage.test.jsx
npx tsc --noEmit --pretty false
cd ..
git diff --check
```

Suggested commit:

```text
refactor(autocoder): type user page analysis payload helpers
```

---

## 2026-05-10 Continuation Notes

This 12-hour modernization worktree started from a later branch state where the recommended UserPage queue head had already been cleared. A fresh scoped hotspot scan found only:

```text
client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx:2
client/src/components/SBTs/SBTPage.tsx:1
```

Completed safe churn:

- Tightened `CreateQuestionsAndSurveys.generateQuestionId` so option and single-select inputs cross the local boundary as `unknown`, then normalize into the shared question-id helper without changing generated IDs.

Skipped/deferred:

- Attempted to replace `SBTPage` class state `any` with `ReturnType<typeof buildSbtPageInitialState>`, then reverted it. The inferred initial-state shape leaves many fields as `unknown` and fans out into shell-wide render/input/contract state errors. Treat this as a dedicated SBTPage typing pass, not casual churn.

Verification for the completed slice:

```text
CreateQuestionsAndSurveys.cache.test.ts + createQuestionsAndSurveysHelpers.test.ts: PASS, 2 suites, 81 tests
npx tsc --noEmit --pretty false: PASS
git diff --check: PASS
```

Current recommendation:

- Switch back to PRD 555 test decomposition at the next plateau, or proceed to PRD 430 SCSS naming cleanup. Leave broad SBTPage state typing deferred until the class shell can be narrowed deliberately.

---

## Blockers

No current blockers. Continuing beyond this point is useful, but the next steps are new churn leaves rather than an unfinished edit.
