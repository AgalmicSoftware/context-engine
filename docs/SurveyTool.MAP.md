# SurveyTool.jsx Map

## Quick Reference
- File: `client/src/components/SurveyTool/SurveyTool.jsx`
- Current length: **15,776 lines**
- Component type: **multi-class React class-component module**
- Class declarations: **5** (`SurveyTool`, `SurveySelector`, `QuestionsDashboard`, `SurveyQuestions`, `PileViewMode`)
- Practical hierarchy: **4 primary UI components** + `PileViewMode` subclass (`extends SurveyQuestions`)
- Method inventory: **276 class methods/properties** + **73 top-level helper functions**
- Summary: This file implements the full survey/question runtime: mode selection, survey list + filters, question dashboards, response editing/decrypting, draft persistence, encryption audience/gate logic, chain submission, and the pile-card interaction mode. `SurveyQuestions` is the core state machine; other classes are orchestration/adapters around it.
- Shared dependency: audio capture/transcription now lives at `client/src/components/Shared/AudioInput/AudioInput.tsx` and is consumed by `SurveyTool`, `SurveySelector`, and `QuestionFilter`.

## Component Hierarchy

```text
SurveyTool (992-1610)  [entry mode wrapper]
  -> SurveySelector (1613-2599)  [survey/questions selector + filter + results]
     -> QuestionsDashboard (2602-2809)  [question list in "questions" mode]
     -> SurveyQuestions (2812-13335)  [main response editor/viewer]
        -> PileViewMode (13338-15774)  [card/pile UX variant, extends SurveyQuestions]
```

## Section Index

| Section | Lines | Purpose | Key Methods |
|---|---:|---|---|
| Imports/constants/perf helpers | 1-124 | Dependencies, perf counters and microtask scheduler | `isSurveyPerfCountersEnabled`, `bumpSurveyPerfCounter`, `scheduleMicrotask` |
| Top-level utility helpers | 130-559 | URL prefix handling, merge helpers, signatures, draft diff helpers | `applyExistingGroupPrefix`, `mergeDecryptedViewedResponse`, `buildSurveyDraftSemanticSignature`, `shouldEncryptResponseFieldForSubmit` |
| Slug/cache/filter helpers | 562-990 | Session slug resolution and cache wrappers shared by all classes | `resolveSlugForIds`, `resolveEffectiveSlug`, `readQuestionsCache`, `writeSurveysCache`, `normalizeSurveyToolFilterState`, `computeSubmitLabel` |
| `SurveyTool` class: constructor + URL filter hydration | 992-1139 | Root wrapper state and top-level cache updater | `constructor`, `handleTopLevelFilterStateUrlUpdate`, `findSurveyInAllCaches` |
| `SurveyTool` class: lifecycle + data load + render | 1142-1609 | Initial fetch + mode-specific render (`singleQuestionMode` / full / pile) | `componentDidMount`, `componentDidUpdate`, `getSurveyData`, `fetchSurveys`, `ensureQuestionCached`, `render` |
| `SurveySelector` class: state + lifecycle | 1613-1742 | Survey list state, long-load timing, refresh triggers | `constructor`, `componentDidMount`, `componentDidUpdate` |
| `SurveySelector` class: filters/URL/view mode/actions | 1744-2222 | Filter synchronization, URL updates, results toggles, clipboard helpers | `computeFilteredQuestionCount`, `handleUrlBasedView`, `updateSelectedSurvey`, `selectSurvey`, `updateURL`, `toggleShowResults` |
| `SurveySelector` render tree | 2224-2598 | Dropdown, view switching, nested `SurveyQuestions`/`QuestionFilter` wiring | `render` |
| `QuestionsDashboard` class | 2602-2808 | Question list loading and filtered question handoff | `loadQuestions`, `handleFilteredQuestions`, `render` |
| `SurveyQuestions`: core state + scheduling internals | 2812-3579 | Primary response state machine, auto-decrypt queue setup, gate capability checks | `constructor`, `queueAutoDecryptVisibleSweep`, `refreshCanDecryptOtherResponses` |
| `SurveyQuestions`: lifecycle transitions | 3581-4170 | Initial hydration, account/path/cache transition handling, unmount cleanup | `componentDidMount`, `componentDidUpdate`, `componentWillUnmount` |
| `SurveyQuestions`: question payload/decrypt context | 4175-4724 | Draft scope, masked prompt reload, slider controls, per-question UI controls | `_getDraftScope`, `buildQuestionDecryptContext`, `fetchQuestionPayloadWithDeterministicContext`, `handleReloadMaskedPrompt` |
| `SurveyQuestions`: edit diffing + auto-decrypt sweep | 4731-5389 | Diff engine for changed fields + auto-decrypt queue processing | `getChangedQidsAndFields`, `maybeAutoDecryptVisibleFields`, `processAutoDecryptQueue` |
| `SurveyQuestions`: draft persistence + hydration | 5392-7102 | Draft keying/migration/persist/clear and response rehydration | `getDraftKey`, `loadDraft`, `persistDraft`, `clearDraftFor`, `ensurePriorResponsesForRenderedIds`, `rehydrateDraftForRenderedIds` |
| `SurveyQuestions`: fetch/decrypt handlers | 7105-9176 | Fetch pool/response data and decrypt own/viewed payloads | `fetchQuestionPool`, `fetchSurveyResponse`, `fetchSingleQuestionData`, `handleDecryptEdit`, `handleDecryptQuestionAnswerInternal` |
| `SurveyQuestions`: input/edit/render helpers | 9180-10770 | Field handlers, lock toggles, JSON preview, question rendering | `handleAnswer`, `toggleAnswerEncryption`, `prepareJsonAndHash`, `renderQuestion` |
| `SurveyQuestions`: encryption + gate policy + submit | 10773-12641 | Lit policy resolution, encryption by audience, submission pipeline | `encryptData`, `getResponseGatePolicy`, `buildRecipientsFromGates`, `encryptAndUpload`, `submitSurveyResponse` |
| `SurveyQuestions`: answer renders + main render | 12644-13334 | Read-only answer renderers and full component render | `renderQuestionAnswer`, `renderSurveyAnswers`, `render` |
| `PileViewMode`: constructor/warm seed/signatures | 13338-13749 | Pile-specific state seeding, list signatures, loading logic | `constructor`, `buildWarmPileSeedState`, `buildQuestionListSignature`, `isPileLoadingVisible` |
| `PileViewMode`: lifecycle + navigation/actions | 13751-14336 | Pile lifecycle, next/prev/create/filter entry points | `componentDidUpdate`, `handleNext`, `handlePrev`, `prefillUserAnswersFromCache` |
| `PileViewMode`: load/filter/render | 14339-15773 | Pile data load/sort, response-state sync, card rendering | `loadAndSortQuestions`, `handleFilter`, `renderActiveQuestion`, `render` |
| Module export | 15776 | Default export | `export default SurveyTool` |

## Method Index (Grouped by Responsibility)

### Shared slug/cache/filter utilities (top-level)
- `resolveSlugForIds` (570-626)
- `resolveEffectiveSlug` (647-656)
- `readQuestionsCache` (668-670)
- `readSurveysCache` (681-683)
- `writeQuestionsCache` (678-680)
- `writeSurveysCache` (691-693)
- `normalizeSurveyToolFilterState` (832-835)
- `computeSubmitLabel` (932-952)

### Survey shell orchestration (`SurveyTool`)
- `handleTopLevelFilterStateUrlUpdate` (1102-1121)
- `findSurveyInAllCaches` (1123-1139)
- `getSurveyData` (1201-1265)
- `fetchSurveys` (1273-1357)
- `ensureQuestionCached` (1361-1448)
- `render` (1451-1609)

### Survey listing, URL sync, and filtering (`SurveySelector`)
- `computeFilteredQuestionCount` (1751-1798)
- `handleUrlBasedView` (1804-1820)
- `fetchSurveys` (1849-1912)
- `updateSelectedSurvey` (1914-1954)
- `selectSurvey` (1961-1989)
- `updateURL` (1992-2002)
- `selectOption` (2009-2025)
- `toggleShowResults` (2038-2086)
- `handlePendingStatsChange` (2095-2109)
- `render` (2224-2598)

### Question list dashboard (`QuestionsDashboard`)
- `loadQuestions` (2666-2718)
- `handleFilteredQuestions` (2720-2728)
- `render` (2734-2808)

### Response hydration, drafts, and edit tracking (`SurveyQuestions`)
- `_getDraftScope` (4175-4179)
- `_getEffectiveDraftSlug` (4183-4195)
- `getDraftKey` (5392-5412)
- `loadDraft` (5414-5550)
- `persistDraft` (5562-5744)
- `clearDraftFor` (5782-5870)
- `ensurePriorResponsesForRenderedIds` (5985-6071)
- `rehydrateDraftForRenderedIds` (6073-6175)
- `getChangedQidsAndFields` (4885-5195)
- `computePendingEditStatsAtIndex` (12134-12189)
- `handleRevertPendingChanges` (6311-6376)
- `recalculateEditStats` (6972-7009)

### Encryption audience, gating, and Lit policy (`SurveyQuestions`)
- `getResponseGatePolicy` (10945-11016)
- `getResponseGateRecipientSpecs` (11018)
- `getQuestionEncryptionGates` (11064-11072)
- `resolveGatedPromptGateNames` (11074-11149)
- `buildRecipientsFromGates` (11151-11189)
- `isQuestionLockedForResponse` (11191-11194)
- `getEffectiveRecipientsForQid` (11196-11202)
- `resolveFieldEncryptionAudience` (11246-11254)
- `collectGateSbtAddressesForHydration` (11279-11310)
- `hydrateGateSbtLabels` (11312-11383)
- `buildLockedQuestionGateDetails` (11385-11476)
- `applyAnswerEncryptionAudience` (11712-11751)
- `buildLitEncryptionOptions` (11753-11801)
- `buildLitEncryptionOptionsForRecipients` (11803-11833)
- `encryptData` (10773-10926)

### Submit + decrypt pipeline (`SurveyQuestions`)
- `encryptAndUpload` (11836-12126)
- `verifyEncryption` (12280-12310)
- `submitSurveyResponse` (12312-12641)
- `fetchQuestionPool` (7105-7246)
- `fetchSurveyResponse` (7323-7437)
- `fetchSingleQuestionData` (7600-8360)
- `handleDecryptEdit` (8363-8568)
- `handleDecryptViewedResponseFieldInternal` (8579-8785)
- `handleDecryptQuestionAnswerInternal` (8795-9176)
- `maybeAutoDecryptVisibleFields` (5198-5321)
- `processAutoDecryptQueue` (5325-5389)

### Pile mode navigation/filtering (`PileViewMode`)
- `buildWarmPileSeedState` (13405-13478)
- `buildQuestionListSignature` (13540-13555)
- `buildPileVisibleResponseSignature` (13572-13607)
- `isPileLoadingVisible` (13672-13712)
- `scheduleLoadAndSortQuestions` (13740-13749)
- `handleNext` (13994-14009)
- `handlePrev` (14012-14024)
- `prefillUserAnswersFromCache` (14193-14336)
- `loadAndSortQuestions` (14339-14668)
- `ensureVisiblePileResponseState` (14713-14805)
- `handleFilter` (14838-14984)
- `renderActiveQuestion` (14987-15350)
- `render` (15353-15773)

## Response Lifecycle (SurveyQuestions)

```text
Load Context
  -> resolve slug + question/survey IDs
  -> fetch current pool/response
     (`fetchQuestionPool`, `fetchSurveyResponse`, `fetchSingleQuestionData`)
  -> hydrate local editable state
     (`loadDraft`, `rehydrateDraftForRenderedIds`, `prefillSurveyResponses`)

Edit Phase
  -> field handlers mutate slice
     (`handleAnswer`, `handleAdditional`, `handleImportance`, `handleConviction`)
  -> diff engine computes pending changes
     (`getChangedQidsAndFields`, `computePendingEditStatsAtIndex`)
  -> optional decrypt helpers run
     (`handleDecryptEdit`, `maybeAutoDecryptVisibleFields`)

Submit Phase
  -> submit trigger
     (`handlePrimarySubmitClick` -> `encryptAndUpload`)
  -> optional encryption
     (`encryptData`, `buildLitEncryptionOptions*`, `verifyEncryption`)
  -> chain submission + receipt wait
     (`submitSurveyResponse`)
  -> success reconciliation
     (clear drafts, set baseline, refresh caches/nonces)
```

## Encryption and Gating Flow

```text
Question state + gate config
  -> gate policy resolution
     (`getResponseGatePolicy`, `buildRecipientsFromGates`)
  -> per-field audience resolution
     (`resolveFieldEncryptionAudience`, `applyAnswerEncryptionAudience`)
  -> Lit option selection
     self: no ACL recipients
     gate: recipient ACL via `buildLitEncryptionOptionsForRecipients`
  -> encrypt changed fields
     (`encryptData` / `cryptoUtils.encryptMultipleAnswers`)
  -> verify envelopes and submit
     (`verifyEncryption`, `submitSurveyResponse`)
```

## State Machine (Key Variables by Component)

### `SurveyTool` (992-1610)
| State variable | Gates |
|---|---|
| `loading` | Blocks top-level list/content until initial survey load completes |
| `showResultsModal` | Controls root-level results modal visibility |
| `hydratedFilterState` | One-time URL filter bootstrap consumed by children |
| `questionsCacheNonce` | Forces child refresh when cache-derived question state changes |

### `SurveySelector` (1613-2599)
| State variable | Gates |
|---|---|
| `viewMode` (`questions`/`survey`) | Switches between question dashboard and survey response view |
| `selectedSurveyIndex` | Active survey context for renders + URL sync |
| `loading` | Drives dropdown spinner states and “loading” labels |
| `showLongLoading` | Enables long-wait fallback messaging |
| `filterModalOpen` / `filterState` / `filteredQuestionCount` | Controls filter UX + count labels |
| `showResults` | Toggles `SurveyResults` panel |
| `pendingSubmitStats` | Drives submit button badge/disable states in selector header |

### `SurveyQuestions` (2812-13335)
| State variable | Gates |
|---|---|
| `surveysResponseState` | Canonical editable response slice |
| `isEditing` + `displayAnswerMode` | Edit/view mode toggle behavior |
| `isSubmitting` + `submissionComplete` + `submissionError` | Submit pipeline lockouts and error UX |
| `modifiedCount` + `isDirty` + `hasEncryptedChanges` | Pending-change indicators and submit eligibility |
| `userAnswers` + `userHasResponse` + `userResponseEncrypted` | Baseline source and view defaults |
| `autoDecryptEnabled` + `autoDecryptAttempted` | Auto-decrypt queue behavior and retries |
| `prefillQueuedAfterCache` + `isHydratingPriorResponses` | Deferred prefill while caches become ready |
| `canDecryptOtherResponses` + `canDecryptOtherResponsesStatus` | Whether decrypt buttons are shown for viewed responses |
| `lockAudienceMenuByQuestion` + `lockAudienceGateDetailsByQuestion` | Per-question encryption audience UI state |

### `PileViewMode` (13338-15774)
| State variable | Gates |
|---|---|
| `pileQuestions` + `activePileIndex` | Current card list and active card index |
| `loading` + `showLongLoading` + `loadingElapsedSec` | Pile loading/progress UX |
| `allQuestionsForFilter` + `filterState` + `filterModalOpen` | Pile filtering pipeline |
| `hasHiddenGatedQuestions` | Empty-state messaging for gated-only results |
| `showCreate` | Inline create-survey area visibility |
