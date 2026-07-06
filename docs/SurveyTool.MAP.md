# SurveyTool Runtime Map

## Quick Reference
- Entry wrapper: `client/src/components/SurveyTool/SurveyTool.tsx`
- Shared runtime: `client/src/components/SurveyTool/SurveyQuestions.tsx`
- Pile-mode controller: `client/src/components/SurveyTool/SurveyPileViewMode.tsx`
- Pile helper cluster: `client/src/components/SurveyTool/surveyPile*.ts(x)`
- Current shape: `SurveyQuestions.tsx`, `SurveyResults.tsx`, and `SurveyPileViewMode.tsx` remain the largest runtime owners; helper/display modules listed below document ownership boundaries rather than stable line-count targets.
- Summary: the runtime is no longer one monolithic file, but `SurveyQuestions.tsx` is still the dominant shared state machine. `SurveyQuestions.tsx` is now a function component backed by `useReducer`, with initial state and reducer logic in `surveyQuestionsState.ts`, behavior-level RTL coverage routed through `surveyQuestionsTestHarness.tsx`, and class-parity refs preserving live props/state reads, instance fields, setState callback ordering, and mount/update cleanup ordering. `SurveyPileViewMode.tsx` no longer subclasses `SurveyQuestions`; it is a typed pile-mode function wrapper that attaches the pile runtime strategy to the shared SurveyQuestions engine through an explicit dynamic engine boundary. `SurveyQuestions.tsx` also has a presentational route surface for loading/top-strip/answer-vs-authoring/JSON/tag-modal composition with centralized route-surface prop contracts, route JSON-controls prop assembly, route authoring/JSON-preview readiness descriptors, passive JSON tree, submitted-response, survey-answer, submit-footer, full-question slider, full-question response input display/action descriptors, full-question content/display sections, gated-prompt card chrome, primary-submit decision dispatch, submit-readiness descriptors, submitted-response URL planning, submit-start/status sequencing, stale-submit cleanup, submit completion/status handoff, single-question source-restore context planning, single-question cache-bootstrap flow planning, cache-bootstrap stop-handling planning, seeded response hydration patch planning, current-question preservation planning, and question/survey decrypt planning extracted while keeping submit execution, real decrypt execution, JSON generation/copy execution, cache reads/writes, fetches, retry scheduling, live route/navigation state, question rendering, and mutation behavior in the shared runtime. `SurveyResults.tsx` is now a function component backed by `useReducer`, with initial state and reducer logic in `surveyResultsState.ts` and behavior-level RTL coverage routed through `surveyResultsTestHarness.tsx`; PRD 651 SV-R slices moved question-mode cache normalization, manual-refresh target state/follow-up application, browser download execution, HTML/PDF report render/export execution, AI analysis-section calls, locked encrypted-field normalization/signatures, locked-response envelope decrypt, CSV/JSON export payload builders, HTML report count/question-row shaping, analysis response-row shaping, analysis segment-dimension shaping, HTML snapshot assembly, locked-response row selection, locked-gate detail shaping, local-storage polling decision planning, demo alternate-results prop assembly, and generated analysis completion cache-write dispatch behind focused controllers/domain ports, reducing the file to 4418 lines. It still owns route/session state, export filename/status side effects, nonce refresh status application, feedback timers/logging, concrete state application, final generated-artifact lifecycle state application, and result mutation. Analysis artifact persistence now has parent-level lifecycle coverage for success, cached-ready final state cleanup, blocked/no-op eligibility, partial failure/retry recovery, status output, stale artifact regeneration, stale cached artifact rejection, no-artifact no-read persistence skips, typed cache read args, read exception fallback, partial cached payload rejection, generated completion identity/cache-write/lifecycle dispatch descriptors, report download identity/settlement descriptors, and no-download side effects.

## Current Runtime Hierarchy

```text
SurveyTool.tsx  [top-level wrapper]
  -> SurveySelector.tsx  [survey/questions selector + filter + results]
     -> QuestionsDashboard.tsx  [question list in "questions" mode]
     -> SurveyQuestions.tsx  [shared full response runtime]
        -> SurveyQuestionsRouteSurface.tsx  [route-level loading surface + section coordinator]
           -> SurveyQuestionsTopRouteSection.tsx  [route toggle + response notice strip slot]
              -> SurveyQuestionsTopStrip.tsx  [route toggle + response notice strip]
           -> SurveyQuestionsRouteBodySection.tsx  [viewed-response vs authoring route body]
              -> SurveyQuestionsAuthoringRouteSection.tsx  [authoring panel + submitted-response/footer slots]
                 -> SurveyQuestionsAuthoringPanel.tsx  [editable question presentation]
                 -> SurveyQuestionsSubmittedResponseView.tsx  [submitted-response display]
                 -> SurveyQuestionsSubmitFooter.tsx  [submit/footer display]
              -> SurveyQuestionsResponseRouteSection.tsx  [viewed-response wrapper]
                 -> SurveyQuestionsResponseView.tsx  [viewed-response presentation]
           -> SurveyQuestionsJsonRouteSection.tsx  [bottom JSON route section]
              -> SurveyQuestionsJsonControls.tsx  [bottom JSON controls]
           -> SurveyQuestionsTagModalSlot.tsx  [tag modal route slot]
        -> surveyQuestionsRouteSurfaceTypes.ts  [route-surface prop contracts]
        -> surveyQuestionsRouteJsonControlsProps.ts  [route JSON display/copy/toggle prop assembly]
        -> SurveyQuestionsFullQuestionContentSections.tsx  [full-question answer/comment display slots]
        -> SurveyQuestionsFullQuestionDisplay.tsx  [full-question card display assembly]
        -> SurveyQuestionsFullQuestionGatedPromptCard.tsx  [full-question gated-prompt card chrome]
        -> SurveyQuestionsFullQuestionResponseInput.tsx  [question-type response input rendering from descriptors]
        -> SurveyQuestionsFullQuestionSliderSection.tsx  [shared full/pile slider display]
        -> SurveyQuestionsJsonTree.tsx  [JSON tree display]
        -> SurveyQuestionsSurveyAnswersView.tsx  [survey answer list display]
        -> SurveyQuestionsUserResponseNotice.tsx  [existing-response notice actions]
        -> surveyQuestionsFullQuestionResponseInputState.ts  [response input display/action descriptors]
        -> surveyQuestionsSubmitController.ts  [primary-submit plan dispatch + submitted URL planning + submit-start/stale/completion status handoff]
        -> surveyQuestionsState.ts  [initial state factory + reducer for hook state]
        -> surveyQuestionsTypes.ts  [shared state/display builders, including submit readiness]
        -> surveyToolSingleQuestionCacheBootstrapController.ts  [single-question source-restore, cache-bootstrap flow, seeded hydration, and current-pool preservation planning]
        -> surveyToolDecryptFlow.js  [decrypt planning, state builders, and question-decrypt attempt/status helpers]
        -> SurveyPileViewMode.tsx  [pile/card UX strategy wrapper over SurveyQuestions]
        -> surveyPileQuestionListEquivalence.ts  [pile question-list equivalence descriptors]
        -> surveyPileVisibleQuestionIds.ts  [pile visible-question ID window descriptors]
        -> surveyPileResponseSignature.ts  [pile visible-response signature descriptors]
     -> SurveyResults.tsx  [survey/question results runtime and execution owner]
        -> surveyResultsState.ts  [initial state factory + reducer for hook state]
        -> surveyResultsHtmlReportModalProps.ts  [HTML report modal prop assembly]
        -> surveyResultsHtmlReportModalDescriptor.ts  [HTML report modal display descriptors]
        -> SurveyResultsReportSurface.tsx  [presentational results route/report surface composition]
           -> SurveyResultsModalHeader.tsx  [modal title, links, bookmark, sync/header presentation]
           -> SurveyResultsDisplayPanels.tsx  [results display panel ordering]
              -> SurveyResultsFilterSummary.tsx  [filter count summary display]
              -> SurveyResultsIndividualResponsesList.tsx  [individual response list empty state + card collection]
                 -> SurveyResultsIndividualResponseCard.tsx  [individual responder card chrome, links, toggle shell]
                 -> SurveyResultsIndividualResponseBody.tsx  [individual response row display model + body composition]
              -> SurveyResultsQuestionListPanel.tsx  [survey/question-mode question list panel]
              -> SurveyResultsQuestionSummariesPanel.tsx  [survey aggregate/question summary panel]
           -> SurveyResultsDemoSurface.tsx  [demo alternate-results surface display]
           -> SurveyResultsHtmlReportExportModal.tsx  [HTML report export modal presentation]
              -> SurveyResultsHtmlReportSectionTable.tsx  [HTML report section availability/toggle table]
              -> SurveyResultsHtmlReportAnalysisControls.tsx  [HTML report analysis-generation action display]
              -> SurveyResultsHtmlReportActionControls.tsx  [HTML report close/download action controls]
        -> SurveyResultsPanels.tsx  [typed sync-status plan rendering]
           -> SurveyResultsSyncDetailsDisplay.tsx  [sync detail rows/progress display]
        -> SurveyResultsStatusMessages.tsx  [alert/loading status presentation]
        -> surveyResultsFilterStatusController.ts  [filter/status display plans]
        -> surveyResultsSyncStatusController.ts  [sync-status progress display plans]
        -> surveyResultsBlockNumbers.ts  [shared block-number/latest-block guards]
        -> surveyResultsCacheReadinessDisplayPlan.ts  [composed cache/readiness display plan]
        -> surveyResultsCacheControllerSnapshot.ts  [cache-controller input snapshot]
        -> surveyResultsManualRefreshController.ts  [manual-refresh injected-port dispatch decision]
        -> surveyResultsManualRefreshStatusApplicationController.ts  [manual-refresh target-block state and follow-up application port]
        -> surveyResultsQueuedRefreshController.ts  [queued-refresh injected-port dispatch decision]
        -> ../../domains/surveys/surveyResultsCachePort.ts  [concrete results cache read/write/list/subscribe port]
        -> ../../domains/surveys/surveyResultsFetchResponsesRuntime.ts  [fetch-response request coalescing runtime]
        -> ../../domains/surveys/surveyResultsLocalStoragePollingRuntime.ts  [local-storage polling timer/backoff runtime]
        -> ../../domains/surveys/surveyResultsQueuedRefreshRuntime.ts  [queued refresh microtask/frame coalescing runtime]
        -> ../../domains/surveys/surveyResultsAnalysisArtifactMergePort.ts  [analysis artifact merge/normalize port]
        -> ../../domains/crypto/cryptoGatePort.ts  [shared Lit/SBT-gated decrypt execution port]
        -> surveyResultsFallbackQuestionHelpers.ts  [selected-question fallback planning]
        -> surveyResultsFallbackQuestionWriteController.ts  [selected-question fallback injected write dispatch]
        -> surveyResultsQuestionMetadataReadController.ts  [selected-question metadata cache read status]
        -> surveyResultsQuestionNetworkReadController.ts  [scoped question-network cache read status]
        -> surveyResultsQuestionModeCacheNormalizationController.ts  [question-mode cached response/question normalization]
        -> surveyResultsBookmarkCacheReadPorts.ts  [bookmark cache read identity and list selection]
        -> surveyResultsCacheWriteEligibilityPlan.ts  [filter, survey/question bookmark, and analysis artifact cache-write eligibility/pre-readiness plans]
        -> surveyResultsAnalysisLifecyclePlan.ts  [analysis artifact lifecycle planning]
        -> surveyResultsAnalysisLifecycleController.ts  [analysis lifecycle injected status/order dispatch]
        -> surveyResultsAnalysisArtifactCachePorts.ts  [analysis artifact cache target/key/read request/selection port contracts]
        -> surveyResultsAnalysisArtifactReadController.ts  [analysis artifact injected read dispatch]
        -> surveyResultsAnalysisGeneratedArtifactCompletionPlan.ts  [generated analysis artifact completion planning]
        -> surveyResultsAnalysisArtifactWriteController.ts  [analysis artifact injected write dispatch]
        -> surveyResultsFilterBookmarkWriteController.ts  [filter-bookmark injected write dispatch]
        -> surveyResultsSurveyQuestionBookmarkWriteController.ts  [survey/question bookmark injected write dispatch]
        -> surveyResultsLockedFieldHelpers.ts  [locked field/gate normalization and signatures]
        -> SurveyResultsSurveyViewModeToggle.tsx  [survey individual/aggregate toggle presentation]
        -> SurveyResultsFilterSummary.tsx  [filter count summary display]
        -> SurveyResultsQuestionListCard.tsx  [question table card shell]
        -> SurveyResultsQuestionTable.tsx  [question result table presentation]
        -> SurveyResultsQuestionTableRow.tsx  [question result table row presentation]
        -> SurveyResultsExportControls.tsx  [export dropdown/button presentation]
        -> SurveyResultsFilterExportControls.tsx  [filter/export control strip presentation]
        -> surveyResultsExportPlans.ts  [export labels, filenames, generation, and download plans]
        -> surveyResultsExportController.ts  [export generation/download plan orchestration]
        -> surveyResultsBrowserDownloadPort.ts  [CSV/JSON browser download execution port]
        -> surveyResultsExportRows.ts  [filtered-question export row selection]
        -> surveyResultsDemoAnalysisArtifact.ts  [demo analysis artifact composition]
        -> surveyResultsAnalysisGenerationPort.ts  [AI analysis-section generation request port]
        -> surveyResultsHtmlReportSelection.ts  [HTML report selected-section defaults]
        -> surveyResultsHtmlReportStatePatches.ts  [HTML report modal/analysis state patches]
        -> surveyResultsHtmlReportReadiness.ts  [HTML report section readiness plans]
        -> surveyResultsHtmlReportModalDescriptor.ts  [HTML report modal display descriptors]
        -> surveyResultsHtmlReportDownloadAttempt.ts  [HTML report download attempt and settlement plans]
        -> surveyResultsHtmlReportDownloadRequest.ts  [HTML/PDF report download request/execution-plan identity]
        -> surveyResultsHtmlReportDownloadPort.ts  [HTML/PDF report download backend port]
        -> surveyResultsHtmlReportExporterPort.ts  [report render plus HTML/PDF export execution port]
        -> SurveyResultsQuestionSummary.tsx  [selected-question summary display assembly]
           -> SurveyResultsAggregatorSummaries.tsx  [freeform/multichoice summary selection]
              -> SurveyResultsAggregatorSummaryDisplay.tsx  [summary rows/distribution display]
        -> SurveyResultsQuestionSummaryCard.tsx  [per-question summary card shell]
        -> SurveyResultsIndividualResponsesList.tsx  [individual response list collection]
        -> SurveyResultsIndividualResponseCard.tsx  [individual response card shell]
        -> SurveyResultsIndividualResponseBody.tsx  [individual response body display]
        -> SurveyResultsQuestionSummariesList.tsx  [aggregate/question summary list shell]
        -> surveyResultsQuestionSummaryStatusController.ts  [question-summary metadata + empty/error display plans]
        -> surveyResultsSummaryModels.ts  [pure freeform/multichoice summary view models]
```

## Responsibility Map

| File | Primary role | Notes |
|---|---|---|
| `SurveyTool.tsx` | Route/mode shell | Functional component with hooks; chooses full vs pile mode, wires shared props/nonces downward, and uses a dual-mode export pattern (hooks runtime for production, legacy shim for tests) |
| `SurveySelector.tsx` | Survey selection + URL/filter routing | Handles selector state, result toggles, and switching between question/survey views |
| `QuestionsDashboard.tsx` | Standalone question list entry | Narrow orchestration layer for "questions" mode |
| `SurveyQuestions.tsx` | Shared survey/question runtime | Function component backed by `useReducer` with class-parity refs for live props/state, instance-field bags, setState callback ordering, and mount/update cleanup ordering. Owns draft persistence, response hydration, pending-edit computation, encryption/decrypt execution, live route/navigation state, cache/storage/worker/wallet interactions, retry scheduling, JSON generation/copy execution, question rendering, and submission execution while using `surveyQuestionsState.ts` for initial state/reducer logic and delegating route-level loading/top-strip/answer-vs-authoring/JSON/tag-modal composition to `SurveyQuestionsRouteSurface.tsx`, route JSON controls display/copy/toggle prop assembly to `surveyQuestionsRouteJsonControlsProps.ts`, route authoring and JSON-preview readiness descriptors to `surveyQuestionsTypes.ts`, full-question card display assembly to `SurveyQuestionsFullQuestionDisplay.tsx`, full-question answer/comment display slot assembly to `SurveyQuestionsFullQuestionContentSections.tsx`, response-input display/action descriptors to `surveyQuestionsFullQuestionResponseInputState.ts`, gated-prompt card chrome to `SurveyQuestionsFullQuestionGatedPromptCard.tsx`, shared full/pile slider display to `SurveyQuestionsFullQuestionSliderSection.tsx`, primary-submit inert/navigation/dispatch plan execution, pending-stat fallback normalization, submit-readiness descriptors, submitted-response URL planning, submit-start/status sequencing, stale-submit cleanup, and post-submit completion/status state handoff to `surveyQuestionsSubmitController.ts` / `surveyQuestionsTypes.ts`; delegates single-question source-restore context, cache-bootstrap status decisions, stop-handling descriptors, seeded hydration patch shape, and current-question preservation state planning to `surveyToolSingleQuestionCacheBootstrapController.ts`; delegates question-decrypt attempt-start, busy-token ownership, stale/newer-token completion, failure status planning, and bulk survey decrypt source/stale status planning to `surveyToolDecryptFlow.js` |
| `surveyQuestionsState.ts` | SurveyQuestions hook state boundary | Provides `createInitialSurveyQuestionsState`, strategy-aware runtime initial-state composition, and widened patch/updater reducer behavior used by the `SurveyQuestions` function component conversion |
| `surveyQuestionsTestHarness.tsx` | SurveyQuestions RTL harness | Mounts the unconnected SurveyQuestions component with Redux/Router wrappers, route synchronization, rerender helpers, and default props for behavior-level class-coupling ports |
| `SurveyQuestionsRouteSurface.tsx` | Route-level presentation coordinator | Renders loading and delegates top-strip, viewed-response vs authoring route body, JSON controls, submitted-response slot, submit footer slot, and tag modal placement to route section components from parent-provided descriptors, render nodes, and callbacks while leaving route state, submit, decrypt, cache, fetch/retry, worker/audio, response persistence, and state mutation in `SurveyQuestions` |
| `surveyQuestionsRouteSurfaceTypes.ts` | Route-surface prop contracts | Centralizes the display-only route surface and section prop contracts so the route coordinator, top strip, body, authoring, response, JSON, and tag modal sections share one typed boundary while leaving all callback execution and state mutation in `SurveyQuestions` |
| `surveyQuestionsRouteJsonControlsProps.ts` | Route JSON controls prop assembly | Builds the explicit bottom JSON controls display, copy, toggle, payload, tree-renderer, and ref props from parent-provided values while leaving JSON generation, clipboard execution, toggle state, route state, and mutation behavior in `SurveyQuestions` |
| `SurveyQuestionsTopRouteSection.tsx` | Route top-strip section | Adapts route/top-strip display descriptors into the existing toggle and submitted-response notice slot while leaving route state and response action handlers in `SurveyQuestions` |
| `SurveyQuestionsRouteBodySection.tsx` | Route body branch | Chooses viewed-response vs authoring route body from explicit props while leaving response state, question rendering, submit, decrypt, cache, route, and mutation behavior in `SurveyQuestions` |
| `SurveyQuestionsAuthoringRouteSection.tsx` | Authoring route body section | Places the authoring panel, submitted-response slot, and submit footer from descriptors/render nodes while leaving submit execution, JSON generation, question rendering, and response state in `SurveyQuestions` |
| `SurveyQuestionsResponseRouteSection.tsx` | Viewed-response route body section | Renders the viewed-response branch from parent-provided response descriptors and render callbacks while leaving answer rendering, decrypt, cache, fetch/retry, and route state in `SurveyQuestions` |
| `SurveyQuestionsJsonRouteSection.tsx` | Bottom JSON route section | Adapts parent-provided JSON display state, tree renderer, copy callbacks, and toggle callbacks into the bottom JSON controls while leaving JSON generation, copy side effects, and toggle state in `SurveyQuestions` |
| `SurveyQuestionsTagModalSlot.tsx` | Route tag modal slot | Renders the active tag modal from parent-owned visibility and close callback while leaving tag state mutation in `SurveyQuestions` |
| `SurveyQuestionsAuthoringPanel.tsx` | Editable question presentation | Renders the edit-mode question list shell, JSON/back-to-top controls, locked banner, submit node placement, and submitted-response fallback from explicit props while leaving submit, JSON generation, question rendering, and gate/decrypt behavior in `SurveyQuestions` |
| `SurveyQuestionsFullQuestionContentSections.tsx` | Full-question answer/comment display slot assembly | Chooses main-answer and additional-comment display slots from parent-provided render callbacks while leaving answer rendering, decrypt execution, cache, route, submit, and mutation behavior in `SurveyQuestions` |
| `SurveyQuestionsFullQuestionDisplay.tsx` | Full-question card display assembly | Wires the parent-provided card shell, footer icons, slider section, answer/comment renderers, and decrypt-control renderers from explicit display state while leaving answer mutation, decrypt execution, submit, cache, storage, route, and gate behavior in `SurveyQuestions` |
| `SurveyQuestionsFullQuestionGatedPromptCard.tsx` | Full-question gated-prompt card chrome | Renders the gated prompt card shell, header, notice, prompt content, and tag dropdown nodes from parent-prepared slots while leaving prompt decrypt, gate notice derivation, tag dropdown behavior, route, submit, cache, and state mutation in `SurveyQuestions` |
| `SurveyQuestionsFullQuestionResponseInput.tsx` | Full-question response input rendering | Renders multichoice, rating, binary, and default audio/text answer controls from explicit response-input descriptors while routing response, rating, and encryption actions through typed action descriptors that remain inert while disabled/submitting; leaves handler execution, draft persistence, encryption, submit, cache, route, worker execution, and state mutation in `SurveyQuestions` |
| `SurveyQuestionsFullQuestionSliderSection.tsx` | Shared slider display section | Renders the bullhorn hint, slider mode tabs, and score slider from explicit props for full mode and pile mode while leaving score state, commit timing, cache, route, and submit behavior in the parent controllers |
| `SurveyQuestionsJsonControls.tsx` | Bottom JSON controls view | Renders question/response/survey JSON toggles and copy panels from explicit props while leaving JSON generation, copy side effects, and toggle state in `SurveyQuestions` |
| `SurveyQuestionsJsonTree.tsx` | JSON tree display | Normalizes display-only JSON input into the existing tree row presentation while leaving JSON generation and copy side effects in `SurveyQuestions` |
| `SurveyQuestionsResponseView.tsx` | Viewed-response display view | Renders viewed-response loading, no-response, address heading, single-question answer, and full-survey answer states from explicit props while leaving answer rendering callbacks and response state in `SurveyQuestions` |
| `SurveyQuestionsSubmittedResponseView.tsx` | Submitted-response display view | Renders the hidden/loading/single-question/survey submitted-response states from explicit props while leaving answer rendering callbacks and response state in `SurveyQuestions` |
| `SurveyQuestionsSubmitFooter.tsx` | Submit footer display | Renders submit button states, submitted indicator, pending-clear affordance, and response link from explicit props while leaving submit/revert behavior and pending-state computation in `SurveyQuestions` |
| `SurveyQuestionsSurveyAnswersView.tsx` | Survey answer list display | Matches submitted responses to the existing question-answer renderer from explicit props while leaving answer rendering and response state in `SurveyQuestions` |
| `SurveyQuestionsTopStrip.tsx` | Route toggle + response notice strip | Renders the answer-mode toggle and existing-response notice from explicit props while leaving route state and response action handlers in `SurveyQuestions` |
| `SurveyQuestionsUserResponseNotice.tsx` | Existing-response notice view | Renders the Start Fresh / Decrypt Edit / submitted-link / Exit Editing action cluster from explicit props while leaving response state and handlers in `SurveyQuestions` |
| `surveyQuestionsFullQuestionResponseInputState.ts` | Response-input descriptor helpers | Defines question-type input display descriptors and typed answer/rating/encryption action descriptors, including disabled/question-id dispatch readiness, while leaving action execution and state application in `SurveyQuestions` |
| `surveyQuestionsSubmitController.ts` | Primary-submit dispatch/status handoff | Runs already-built primary-submit plans through injected navigation and submit-dispatch ports, activates the submit guard before dispatch, normalizes parent-provided pending-stat fallbacks, plans submitted-response URLs after a receipt, applies submit-start/stale/completion/failure status callbacks in parent-defined order, and does not own pending-edit computation, live route state, submit execution, decrypt, cache, storage, worker, wallet, or JSON behavior |
| `surveyQuestionsTypes.ts` | Shared state/display/readiness builders | Defines SurveyQuestions state patches, display state builders, route authoring readiness, route JSON-preview availability, primary-submit plans, and submit-readiness descriptors from passed-in values while leaving question rendering, JSON generation, submit execution, route mutation, cache/decrypt/fetch/worker behavior, and state application in `SurveyQuestions` |
| `surveyToolSingleQuestionCacheBootstrapController.ts` | Single-question source-restore and cache-bootstrap planning | Resolves route question-id gating, retry cleanup decisions, scoped slug/candidate planning, blocked-question state descriptors, cache/recent-payload bootstrap status, pure parent flow plans, stop-handling descriptors, seeded response hydration patch shape, and current-question preservation state shape while leaving cache reads/writes, metadata fetches, response fetches, retry scheduling, route/session state, and state application in `SurveyQuestions` |
| `surveyToolDecryptFlow.js` | Decrypt planning and state helpers | Builds decrypt display state, task keys, source baselines, success/failure/stale state patches, question-decrypt attempt/status plans, and bulk survey decrypt source/stale status plans while `SurveyQuestions` keeps real decrypt invocation, wallet/provider behavior, cache, storage, and UI side effects parent-owned |
| `SurveyPileViewMode.tsx` | Pile-mode strategy wrapper | Typed function component that renders the shared `SurveyQuestions` runtime with a pile runtime strategy, owning pile load/filter/window coordination and pile-specific render/action UX without subclassing the shared runtime |
| `surveyPileQuestionListEquivalence.ts` | Pile question-list equivalence descriptors | Compares parent-provided pile question lists using an injected question-signature reader without owning cache reads/writes, hydration, decrypt, submit, route, timers, or state application |
| `surveyPileVisibleQuestionIds.ts` | Pile visible-question ID window descriptors | Builds normalized visible pile question ID windows from parent-provided pile questions and active index without owning cache reads/writes, hydration, decrypt, submit, route, timers, or state application |
| `surveyPileResponseSignature.ts` | Pile visible-response signature descriptors | Builds visible-response signatures from injected question-id normalization, response tokenization, and hash functions without owning cache reads/writes, hydration, decrypt, submit, route, timers, or state application |
| `SurveyResults.tsx` | Survey/question results runtime and execution owner | Function component backed by `useReducer` with class-parity refs for live props/state, instance-field bags, setState callback ordering, and mount/update cleanup ordering. 4418 lines after the PRD 651 SV-R port slices. Owns result hydration, filter state, export filename/status side effects, route/session state, filter-bookmark feedback timer/state/logging, survey/question bookmark logging/state application, nonce refresh status application, generated-artifact final state application, concrete state application, and result mutation behavior while using `surveyResultsState.ts` for initial state/reducer logic, shared typed guards for cache/latest-block parsing, `surveyResultsCachePort.ts` for concrete results cache read/write/list/subscribe calls, `contractScriptsChainScanReadsPort.ts` for latest-block reads, `surveyResultsAnalysisArtifactMergePort.ts` for generated artifact normalize/merge calls, `cryptoGatePort.ts` for locked-response envelope decrypt execution, `surveyResultsLockedFieldHelpers.ts` for locked encrypted-field/gate normalization and response signatures, `surveyResultsLockedResponsesModel.ts` for locked-row selection, `surveyResultsLockedGateDetailsModel.ts` for locked gate-detail shaping, and `surveyResultsFetchResponsesRuntime.ts`, `surveyResultsLocalStoragePollingRuntime.ts`, and `surveyResultsQueuedRefreshRuntime.ts` for fetch-request coalescing, local-storage polling timer/backoff, `surveyResultsLocalStoragePollDecision.ts` for polling signature/count-patch decisions, `surveyResultsDemoSurfaceProps.ts` for demo alternate-results prop assembly, and queued refresh microtask/frame scheduling; it delegates results route/report surface composition to `SurveyResultsReportSurface.tsx`, display panel ordering to `SurveyResultsDisplayPanels.tsx`, individual response body/card presentation to `SurveyResultsIndividualResponseBody.tsx` / `SurveyResultsIndividualResponseCard.tsx`, demo alternate-results surface rendering to `SurveyResultsDemoSurface.tsx`, question-mode cached response/question normalization to `surveyResultsQuestionModeCacheNormalizationController.ts`, export filename/control/download plans and CSV/JSON payload builders to `surveyResultsExportPlans.ts`, export orchestration to `surveyResultsExportController.ts`, CSV/JSON browser downloads to `surveyResultsBrowserDownloadPort.ts`, filtered-question export row selection to `surveyResultsExportRows.ts`, demo analysis artifact planning to `surveyResultsDemoAnalysisArtifact.ts`, AI analysis-section calls to `surveyResultsAnalysisGenerationPort.ts`, analysis response-row and segment-dimension shaping to `surveyResultsAnalysisDataModel.ts`, HTML report count/question-row data shaping to `surveyResultsHtmlReportDataModel.ts`, HTML report snapshot assembly to `surveyResultsHtmlReportSnapshotDataModel.ts`, HTML report selected-section defaults to `surveyResultsHtmlReportSelection.ts`, HTML report modal/export/analysis state-patch builders to `surveyResultsHtmlReportStatePatches.ts`, HTML report section readiness to `surveyResultsHtmlReportReadiness.ts`, HTML report modal prop assembly to `surveyResultsHtmlReportModalProps.ts`, HTML report modal display descriptors to `surveyResultsHtmlReportModalDescriptor.ts`, HTML report download attempt and settlement planning to `surveyResultsHtmlReportDownloadAttempt.ts`, HTML/PDF report download request and ready/blocked execution-plan identity to `surveyResultsHtmlReportDownloadRequest.ts`, HTML/PDF download backend calls to `surveyResultsHtmlReportDownloadPort.ts`, report render plus HTML/PDF export execution to `surveyResultsHtmlReportExporterPort.ts`, filter/export control presentation to `SurveyResultsFilterExportControls.tsx`, filter summary presentation to `SurveyResultsFilterSummary.tsx`, HTML report export modal presentation to `SurveyResultsHtmlReportExportModal.tsx`, filter/status display planning to `surveyResultsFilterStatusController.ts`, sync-status progress display planning to `surveyResultsSyncStatusController.ts`, typed sync-status plan rendering to `SurveyResultsPanels.tsx`, composed cache/readiness display planning to `surveyResultsCacheReadinessDisplayPlan.ts`, cache-controller input packaging to `surveyResultsCacheControllerSnapshot.ts`, manual-refresh injected-port dispatch decisions to `surveyResultsManualRefreshController.ts`, manual-refresh target-block state and polling follow-up application to `surveyResultsManualRefreshStatusApplicationController.ts`, queued-refresh injected-port dispatch decisions to `surveyResultsQueuedRefreshController.ts`, selected-question fallback planning to `surveyResultsFallbackQuestionHelpers.ts`, selected-question fallback injected write dispatch to `surveyResultsFallbackQuestionWriteController.ts`, read-only selected-question metadata decisions to `surveyResultsQuestionMetadataReadController.ts`, scoped question-network cache read/status decisions to `surveyResultsQuestionNetworkReadController.ts`, filter, survey/question bookmark, and analysis artifact cache-write eligibility/pre-readiness planning to `surveyResultsCacheWriteEligibilityPlan.ts`, typed analysis artifact cache key/read request/selection contracts to `surveyResultsAnalysisArtifactCachePorts.ts`, analysis artifact read dispatch to `surveyResultsAnalysisArtifactReadController.ts`, generated-artifact completion planning and cache-write dispatch to `surveyResultsAnalysisGeneratedArtifactCompletionPlan.ts`, typed analysis artifact lifecycle/failure-recovery planning to `surveyResultsAnalysisLifecyclePlan.ts`, analysis lifecycle status/order dispatch to `surveyResultsAnalysisLifecycleController.ts`, analysis artifact injected write dispatch to `surveyResultsAnalysisArtifactWriteController.ts`, filter-bookmark injected write dispatch to `surveyResultsFilterBookmarkWriteController.ts`, survey/question bookmark injected write dispatch to `surveyResultsSurveyQuestionBookmarkWriteController.ts`, refresh/status sequence, view/survey reset, and local-storage poll patch planning to `surveyResultsHelpers.ts`, selected-question summary display assembly to `SurveyResultsQuestionSummary.tsx`, and question-summary metadata/status planning to `surveyResultsQuestionSummaryStatusController.ts` |
| `../../domains/crypto/cryptoGatePort.ts` | Shared gated decrypt execution port | Late-binds `cryptoUtils.decryptEnvelopeValue` behind a typed Lit/SBT-gated decrypt contract intended for SurveyResults first and SurveyQuestions reuse later; it does not own gate policy construction, wallet/provider selection, state application, cache, route, or UI feedback |
| `surveyResultsState.ts` | SurveyResults hook state boundary | Provides `createInitialSurveyResultsState`, widened patch/updater reducer behavior, and filter-state preservation helpers used by the `SurveyResults` function component conversion |
| `surveyResultsTestHarness.tsx` | SurveyResults RTL harness | Mounts the unconnected SurveyResults component with Redux/Router wrappers, route synchronization, rerender helpers, and default props for behavior-level class-coupling ports |
| `surveyResultsHtmlReportModalProps.ts` | HTML report modal prop assembly | Combines modal display descriptors, style map, and individually named modal execution callbacks without invoking report rendering, AI generation, download, cache, route, or state behavior |
| `surveyResultsHtmlReportModalDescriptor.ts` | HTML report modal display descriptors | Builds typed analysis payload contracts and modal display descriptors from parent-built snapshots, analysis state, section selection, and readiness planning without owning AI generation, cache reads/writes, artifact persistence, render execution, PDF/HTML generation, browser download, route, or state application |
| `SurveyResultsReportSurface.tsx` | Results report/surface composition | Presentational shell for the results modal, header, display panels, demo alternate surface, and HTML report modal from parent-built props with separate display and execution prop contracts; it forwards explicit callbacks only and does not own report/export/download/cache/polling/AI/decrypt execution, route/session mutation, or state application |
| `SurveyResultsDisplayPanels.tsx` | Results display panel ordering | Renders the status, view-mode toggle, locked banner placement, and delegates filter summary, typed individual response list/body rows, question-list, and summary-list display panels from explicit props while leaving fetch, decrypt execution, filter state, route/session state, export/download execution, cache, polling, and mutation behavior in `SurveyResults` |
| `SurveyResultsFilterSummary.tsx` | Filter summary presentation | Renders total/filtered question and response counts plus hydrated-count spinners from explicit display-plan values while leaving count derivation, filter state, cache, polling, and mutation behavior in `SurveyResults` / `surveyResultsFilterStatusController.ts` |
| `SurveyResultsQuestionListPanel.tsx` | Survey/question-mode question list panel | Chooses the survey aggregate question-list card vs direct question-mode card from cache/readiness display descriptors while leaving table derivation, toggles, and scroll behavior in `SurveyResults` |
| `SurveyResultsQuestionSummariesPanel.tsx` | Survey aggregate/question summary panel | Chooses aggregate survey summaries vs question-mode summaries from explicit entries/render callbacks while leaving selected-summary rendering, decrypt overrides, filter state, and cache behavior in `SurveyResults` |
| `SurveyResultsDemoSurface.tsx` | Demo alternate-results surface display | Renders report, atlas, breakdown, and risk-matrix demo surfaces from parent-prepared props while leaving demo view selection, Polis data preparation, atlas node state, route/session state, cache, analysis generation, export/download execution, and mutation behavior in `SurveyResults` |
| `SurveyResultsModalHeader.tsx` | Results modal header presentation | Renders title, survey ID/document links, bookmark, demo-view controls, locked-response toggle slot, and sync-status slot from explicit props |
| `SurveyResultsPanels.tsx` | Results panel presentation helpers | Renders sync-status shell directly from `SurveyResultsSyncStatusDisplayPlan` while delegating detail rows to `SurveyResultsSyncDetailsDisplay.tsx` and leaving display-plan construction, refresh handlers, and state in `SurveyResults` |
| `SurveyResultsSyncDetailsDisplay.tsx` | Sync detail row display | Renders question/response sync track rows and progressbar/spinner text from parent-provided sync-status descriptors while leaving refresh execution, polling, cache, and state ownership in `SurveyResults` |
| `SurveyResultsStatusMessages.tsx` | Results status presentation | Renders alert and filter-loading states from explicit props while leaving alert/filter state in `SurveyResults` and display selection in `surveyResultsFilterStatusController.ts` |
| `SurveyResultsSurveyViewModeToggle.tsx` | Survey view-mode toggle presentation | Renders individual/aggregate switch labels and ARIA state from explicit props while leaving mode state and keyboard/click handlers in `SurveyResults` |
| `SurveyResultsQuestionListCard.tsx` | Question table card shell | Renders the collapsible View & Sort Questions card from explicit props while leaving table derivation, toggles, and scroll behavior in `SurveyResults` |
| `SurveyResultsQuestionTable.tsx` | Question result table presentation | Renders the sortable question table and delegates row display to `SurveyResultsQuestionTableRow.tsx` while leaving row derivation, sorting state, bookmark mutation, and scroll/view behavior in `SurveyResults` |
| `SurveyResultsQuestionTableRow.tsx` | Question result table row presentation | Renders question row links, prompt/type/count cells, bookmark icon state, and View action wiring from explicit props while leaving row derivation, sorting state, bookmark mutation, and scroll/view behavior in `SurveyResults` |
| `SurveyResultsExportControls.tsx` | Export controls presentation | Renders export area collapse, type dropdown, and download button from explicit props while leaving export type state in `SurveyResults` and export execution in `surveyResultsExportController.ts` |
| `SurveyResultsFilterExportControls.tsx` | Filter/export control strip presentation | Renders SBT filtering, question filtering, and export controls from explicit typed filter-state and callback props while leaving filter state mutation, storage-key derivation, SBT/question filter handlers, export payload generation, and download execution in `SurveyResults` |
| `SurveyResultsHtmlReportExportModal.tsx` | HTML report export modal presentation | Builds pure action-label/session/exporter display decisions, renders export-format selection and demo-mode toggle, and delegates section availability, analysis-generation affordance, and close/download controls to display components from explicit display props and named execution callback props while leaving snapshot construction, AI generation, export rendering, and browser download execution in `SurveyResults` |
| `SurveyResultsHtmlReportSectionTable.tsx` | HTML report section table display | Renders selected-section checkboxes, availability labels, and reason text from parent-provided typed section rows while forwarding only the named section-toggle callback for known report-section keys; it does not build snapshots, generate analysis, render reports, download files, read/write cache, or mutate state |
| `SurveyResultsHtmlReportAnalysisControls.tsx` | HTML report analysis action display | Renders typed analysis eligibility counts, reasons, errors, and the Generate Analysis button from parent display-plan values with zeroed partial-payload fallbacks while forwarding only the parent-owned generation callback; it does not call AI, merge artifacts, read/write cache, render reports, download files, or mutate state |
| `SurveyResultsHtmlReportActionControls.tsx` | HTML report action controls | Renders the Cancel and Download buttons from explicit readiness/label props while forwarding only the parent-owned close and report-download callbacks; it does not render reports, capture DOM/PDF, download files, generate analysis, read/write cache, or mutate state |
| `surveyResultsExportPlans.ts` | Results export labels and plans | Builds export labels, control display descriptors, base filenames, generation descriptors, inert download plans, questions-only/response CSV payloads, and JSON export payloads without owning export filename side effects, Blob/browser download execution, route, cache, fetch, decrypt, or state application |
| `surveyResultsExportController.ts` | Results export orchestration | Runs export generation/download plans, invokes injected content generators and browser download ports, and maps invalid/empty export alerts without owning export payload generation, route, cache, fetch, or decrypt behavior |
| `surveyResultsBrowserDownloadPort.ts` | Results browser download execution port | Owns the CSV/JSON Blob/object-URL/anchor-click execution behind a typed request while keeping export payload generation, route, cache, fetch, decrypt, and state application outside the port |
| `surveyResultsExportRows.ts` | Filtered-question export rows | Builds filtered question ID lists and cloned question export row descriptors from parent-provided aggregate buckets, parsed survey-response rows, and network question metadata without owning parsing memo state, alert state, cache reads/writes, browser download, route, or mutation behavior |
| `surveyResultsDemoAnalysisArtifact.ts` | Demo analysis artifact planning | Builds the local demo analysis artifact from parent-provided AI payload, timestamp, and input signature without owning AI generation, cache reads/writes, artifact persistence, render execution, PDF/HTML generation, browser download, route, or state application |
| `surveyResultsAnalysisGenerationPort.ts` | HTML report AI generation port | Wraps the analysis-section `callAI` request shape with late-bound module lookup while lifecycle/status, artifact merge, cache writes, export/download, route, and state application stay outside the port |
| `surveyResultsAnalysisDataModel.ts` | Analysis response data model | Builds AI-analysis response rows and segment dimensions from filtered response, question, SBT-filter, and gate inputs through injected parse/question metadata/label ports while leaving route/session state, cache, AI calls, and concrete state application in `SurveyResults` |
| `surveyResultsHtmlReportDataModel.ts` | HTML report count/question data model | Builds response-count maps, participant counts, and normalized report question rows from filtered response/question inputs through injected parse/question-id ports while leaving route/session state, exporter authorization, AI generation, cache, decrypt, and concrete state application in `SurveyResults` |
| `surveyResultsHtmlReportSnapshotDataModel.ts` | HTML report snapshot data model | Builds redacted HTML report snapshots from parent-provided counts, questions, filters, exporter metadata, and generated-analysis artifacts while leaving route/session state, cache, export execution, AI calls, and concrete state application in `SurveyResults` |
| `surveyResultsLockedResponsesModel.ts` | Locked-response row model | Selects banner-eligible locked response rows from survey-individual and aggregate result inputs through injected key, override, and field-eligibility ports while leaving gate-detail resolution, decrypt execution, cache, route, and concrete state application in `SurveyResults` |
| `surveyResultsLockedGateDetailsModel.ts` | Locked gate-detail model | Builds deduped SBT gate-detail links and generic-gate fallback state from locked rows, question metadata, and injected session/gate/label ports while leaving session-context construction, decrypt execution, cache, route, and concrete state application in `SurveyResults` |
| `surveyResultsLockedFieldHelpers.ts` | Locked field and gate helpers | Normalizes gate SBT entries, gate text, encrypted envelope candidates, locked/banner field eligibility, and locked-response signatures while leaving decrypt execution, gate-context resolution, cache, route, and state application in `SurveyResults` |
| `surveyResultsLocalStoragePollDecision.ts` | Local-storage poll decisions | Builds polling coarse/detailed signatures, forced-rescan decisions, and local block/count patch plans from parent-provided cache observations while leaving cache reads, timers, refresh scheduling, and concrete state application in `SurveyResults` |
| `surveyResultsDemoSurfaceProps.ts` | Demo alternate-results prop assembly | Selects aggregate versus individual demo report question sources and builds `SurveyResultsDemoSurface` props from parent-provided state/props while leaving memoization, route handlers, and surface rendering in `SurveyResults` / `SurveyResultsDemoSurface` |
| `surveyResultsHtmlReportSelection.ts` | HTML report section selection defaults | Provides the default selected-section set and normalization helper shared by readiness and state-patch builders without owning report rendering, analysis generation, browser download, route, or state application |
| `surveyResultsHtmlReportStatePatches.ts` | HTML report state patch planning | Builds modal open/close, section toggle, demo-mode, export-format, and analysis status state-patch descriptors from parent-provided values without owning AI generation, cache reads/writes, artifact persistence, render execution, PDF/HTML generation, browser download, route, or state application |
| `surveyResultsHtmlReportReadiness.ts` | HTML report section readiness planning | Builds section availability, labels/reasons, selected-section normalization, analysis-generation need, and authorized download-readiness descriptors from parent-built snapshots without owning AI generation, cache reads/writes, artifact persistence, render execution, PDF/HTML generation, browser download, route, or state application |
| `surveyResultsHtmlReportDownloadAttempt.ts` | HTML report download attempt/settlement planning | Builds blocked/ready download attempt descriptors and success/failure patch descriptors without owning AI generation, cache reads/writes, artifact persistence, render execution, PDF/HTML generation, browser download, route, or state application |
| `surveyResultsHtmlReportDownloadRequest.ts` | HTML/PDF report download request identity | Builds pure filename, export kind, render-option, and ready/blocked download execution-plan descriptors from parent-built snapshots, selected sections, authorization, analysis state, and format without rendering HTML, capturing DOM/PDF output, downloading files, generating analysis, reading/writing cache, or mutating state |
| `surveyResultsHtmlReportDownloadPort.ts` | HTML/PDF report download backend port | Late-binds the session-results HTML/PDF utility calls so Jest spies and module mocks keep intercepting while the parent/exporter controls snapshots, render requests, and state settlement |
| `surveyResultsHtmlReportExporterPort.ts` | HTML report exporter execution port | Owns render-to-HTML plus HTML/PDF backend dispatch from a parent-built snapshot/download request while leaving readiness, blocked state, cache, AI generation, route, and settlement state patches outside the port |
| `surveyResultsFilterStatusController.ts` | Results filter/status display planning | Builds pure alert/loading and filtered-count display plans without owning filter state mutation, SBT/question filtering, cache, fetch, decrypt, route, or export behavior |
| `surveyResultsSyncStatusController.ts` | Results sync-status display planning | Builds pure sync label/progress/color/spinner/quick-refresh visibility plans without owning polling, timers, manual refresh, cache, network block reads, fetch, decrypt, route, or export behavior |
| `surveyResultsBlockNumbers.ts` | Results block-number guards | Normalizes SurveyResults block values and latest-block maps for polling, sync display, refresh helpers, and read-only cache controllers without owning cache reads/writes, latest-block network reads, polling, timers, route, fetch, decrypt, export, or state application |
| `surveyResultsCacheReadinessDisplayPlan.ts` | Results cache/readiness display planning | Composes question-list, filter-summary, and sync-status display plans from parent-provided values without owning cache reads/writes, polling, timers, refresh dispatch, network block reads, fetch, decrypt, route, or export behavior |
| `surveyResultsCacheControllerSnapshot.ts` | Results cache-controller input snapshot | Packages parent-provided cache readiness, filter, polling, manual-refresh availability, selected identity, and selected-result inputs into a plain object without reading/writing cache, fetching, decrypting, exporting, scheduling timers, or mutating state |
| `surveyResultsManualRefreshController.ts` | Manual-refresh dispatch decision | Runs only the injected refresh port decision for question vs survey mode while leaving target block state, polling follow-up, decrypt, route, export behavior, and state application in `SurveyResults`; latest-block reads and polling backoff/timer ownership route through domain ports/runtimes |
| `surveyResultsManualRefreshStatusApplicationController.ts` | Manual-refresh status application controller | Reads the latest block through an injected port, applies the target-block state patch through an injected parent state port, and then dispatches manual refresh/backoff/poll/queue follow-ups in the pinned order without owning React state or cache/network implementations |
| `surveyResultsQueuedRefreshController.ts` | Queued-refresh dispatch decision | Runs only the injected queue-refresh port decision for parent-provided reasons while leaving refresh reason collection, polling, timers, cache reads/writes, fetch, decrypt, route, and export behavior in `SurveyResults` |
| `surveyResultsFallbackQuestionHelpers.ts` | Selected-question fallback planning | Builds plain fallback question objects and fallback write plans from passed-in selected question IDs and optional metadata while leaving memo bucket ownership, cache reads/persistence, fetch, decrypt, route, export, and state application in `SurveyResults` |
| `surveyResultsFallbackQuestionWriteController.ts` | Selected-question fallback injected write dispatch | Runs only the parent-provided fallback-question write port from an already-built plan and returns a plain result while leaving memo bucket ownership, cache reads/persistence, fetch, decrypt, route, export, polling, timers, and state application in `SurveyResults` |
| `surveyResultsQuestionMetadataReadController.ts` | Selected-question metadata cache read status | Reads selected-question metadata through an injected read-only port or parent-preloaded render cache, classifies ready/missing/loading metadata, and returns a plain result with an empty state patch while leaving cache writes/persistence, fallback object caching, fetch, decrypt, export, route, polling, and state application in `SurveyResults` |
| `surveyResultsQuestionNetworkReadController.ts` | Scoped question-network cache read status | Reads sync or async scoped question buckets through injected read-only ports, normalizes latest-block metadata, merges ready question/response network data, and returns a plain result/memo patch while leaving cache normalization, fetch/decrypt/export behavior, route, polling state application, and result mutation in `SurveyResults` |
| `surveyResultsQuestionModeCacheNormalizationController.ts` | Question-mode cache normalization controller | Filters demo fixture and wrong-session cached responses, preserves byte-identical live cached response payloads, and prunes demo-only question metadata without owning cache reads, aggregation, fetch, decrypt, export, route, or state application |
| `surveyResultsCacheWriteEligibilityPlan.ts` | Cache-write eligibility and pre-readiness planning | Derives filter, survey/question bookmark, and analysis artifact write targets, pre-read cache readiness, blocked reasons, payload shapes, invalid-cache warning flags, success-feedback decisions, and state-patch descriptors from passed-in values while leaving cache port execution, feedback/state application, AI generation, fetch, decrypt, export, route, polling state, and mutation behavior in `SurveyResults` |
| `surveyResultsAnalysisLifecyclePlan.ts` | Analysis artifact lifecycle planning | Chooses current vs cached analysis artifacts, requested/covered/missing report sections, target identity, payload descriptors, blocked reasons, lifecycle status/result, and failure-recovery state patches from passed-in values while leaving cache port execution, AI generation, artifact merge port execution, export/download execution, route, polling state, and state application in `SurveyResults` |
| `surveyResultsAnalysisLifecycleController.ts` | Analysis lifecycle injected status/order dispatch | Applies the parent-provided ready, blocked, generation-start, or failure-recovery state patch port for an already-built lifecycle plan and returns a typed status result while leaving cache reads/writes, AI generation, artifact merge, export/download execution, polling, route/session, and concrete state application ports in `SurveyResults` |
| `surveyResultsAnalysisArtifactCachePorts.ts` | Analysis artifact cache port contracts and read request planning | Defines typed analysis-cache read/write port signatures, cache-target normalization, cache-key derivation, sync read request descriptors, and selected-artifact extraction from passed-in cache values while leaving `peekCacheSync`, `readCache`, `writeCache`, AI generation, artifact merge, export/download execution, polling, route, decrypt, and state application in `SurveyResults` |
| `surveyResultsAnalysisArtifactReadController.ts` | Analysis artifact injected read dispatch | Runs only the parent-provided analysis-cache read port from an already-built read request, selects a matching cached artifact, and returns a typed read/skipped/failed result while leaving cache API selection, cache writes, AI generation, artifact merge, export/download execution, polling, route/session, decrypt, generation fallback, and state application in `SurveyResults` |
| `surveyResultsAnalysisGeneratedArtifactCompletionPlan.ts` | Generated analysis artifact completion planning | Describes generated-artifact usability, target identity, cache-write payload descriptor, lifecycle success patch descriptor, stale/missing-artifact failure shape, missing-section metadata, and cache-write-before-lifecycle dispatch from passed-in values while leaving AI generation, artifact merge port execution, final lifecycle state application, export/download execution, polling state, route/session, decrypt, and concrete state application in `SurveyResults` |
| `surveyResultsAnalysisArtifactWriteController.ts` | Analysis artifact injected write dispatch | Runs only the parent-provided analysis-cache write port from an already-built plan and returns a plain success/failure result while leaving cache reads, AI generation, artifact normalization/merge, export/download execution, route, polling, decrypt, and state application in `SurveyResults` |
| `surveyResultsFilterBookmarkWriteController.ts` | Filter-bookmark injected write dispatch | Runs only the parent-provided filter-bookmark write port from an already-built eligibility plan and returns a plain success/failure/status result while leaving cache reads, broad persistence, timers, feedback state application, fetch, decrypt, export, route, polling, and mutation behavior in `SurveyResults` |
| `surveyResultsSurveyQuestionBookmarkWriteController.ts` | Survey/question bookmark injected write dispatch | Runs only the parent-provided survey/question bookmark write port from an already-built eligibility plan and returns a plain success/failure/status result while leaving cache reads, broad persistence, state application, fetch, decrypt, export, route, polling, and mutation behavior in `SurveyResults` |
| `surveyResultsHelpers.ts` | Shared SurveyResults pure helpers | Includes selected fallback/status helpers plus refresh/status sequence, view/survey reset, local-storage poll, and write plans that derive ordered effect descriptors, target identity, dispatch eligibility, blocked reason, latest-block state-patch planning, and reset/poll state patches from parent-provided values while leaving latest-block reads, setState application, polling/backoff follow-up, queued refresh dispatch, cache reads/writes/persistence, fetch, decrypt, route, export, and timers in `SurveyResults` |
| `SurveyResultsQuestionSummary.tsx` | Selected question summary display assembly | Builds selected-question card props, applies parent-provided decrypted response overrides for display, computes latest visible response counts, chooses freeform/multichoice/default summary renderers, and wires bookmark/toggle callbacks while leaving decrypt execution, cache, fetch, route, export, and mutation behavior in `SurveyResults` |
| `SurveyResultsQuestionSummaryCard.tsx` | Question summary card shell | Renders summary headers, metadata warning, bookmark action, and selected summary body slots while leaving fallback planning, decrypt override application, and response renderer selection in `SurveyResultsQuestionSummary.tsx` |
| `SurveyResultsAggregatorSummaries.tsx` | Summary renderer selector | Chooses freeform, multichoice, and empty summary states from pure summary models while leaving model derivation in `surveyResultsSummaryModels.ts` and response/decrypt/cache ownership upstream |
| `SurveyResultsAggregatorSummaryDisplay.tsx` | Summary row/distribution display | Renders freeform answer rows, empty states, and multichoice distribution rows from descriptor-shaped summary props without callbacks, cache, decrypt, export, or route behavior |
| `SurveyResultsIndividualResponsesList.tsx` | Individual response list presentation | Renders individual response empty state and card collection from explicit props while leaving card chrome in `SurveyResultsIndividualResponseCard.tsx`, body composition in `SurveyResultsIndividualResponseBody.tsx`, and decrypt execution/state in `SurveyResults` |
| `SurveyResultsIndividualResponseCard.tsx` | Individual response card presentation | Renders responder links, external survey-response link, collapse toggle chrome, and the parent-provided response body slot while leaving response body composition, decrypt execution, filter state, and mutation behavior outside the card |
| `SurveyResultsIndividualResponseBody.tsx` | Individual response body presentation | Builds typed individual response display rows from record-normalized cached payloads, applies parent-provided decrypted override values for display, and renders `SingleQuestionResponse` cards while leaving locked-response decrypt execution, override state, cache, polling, export, route/session state, and mutation behavior in `SurveyResults` |
| `surveyResultsBookmarkCacheReadPorts.ts` | Bookmark cache read ports | Builds bookmark cache read identities and selects copied survey/question bookmark lists from typed cache-value records while leaving concrete cache reads, writes, feedback timers, logging, route/session state, and state application in `SurveyResults` |
| `SurveyResultsQuestionSummariesList.tsx` | Question summary list presentation | Renders aggregate/question summary list entries and no-results/error fallback from explicit props while leaving list display planning in `surveyResultsQuestionSummaryStatusController.ts` and selected-summary assembly in `SurveyResultsQuestionSummary.tsx` |
| `surveyResultsQuestionSummaryStatusController.ts` | Question-summary metadata/status display planning | Builds pure selected-question metadata fallback, summary-list empty state, error state, and inert/loading display plans without owning fetch, decrypt, cache, route, export, filters, or response rendering |
| `surveyResultsSummaryModels.ts` | Pure result summary view models | Builds latest-response, freeform, and multichoice summary models without touching component state, cache, decrypt, export, or route behavior |

## Frontend Architecture Readiness Matrix

| Area | Controller-routed | Typed contract module present | Test-pinned only | Parent-owned | Blocked reason | Next safe lane |
|---|---|---|---|---|---|---|
| SurveyResults cache and report boundaries | Concrete results cache access, question-mode cache normalization, filter bookmark, survey/question bookmark, selected fallback write, analysis artifact cache-read dispatch, analysis artifact cache-write dispatch, analysis artifact merge/normalize, analysis lifecycle status dispatch, generated-artifact completion cache-write dispatch, AI analysis-section calls, CSV/JSON browser downloads, HTML/PDF download backend dispatch, report render/export execution, CSV/JSON export payload builders, HTML report count/question-row shaping, analysis response-row shaping, analysis segment-dimension shaping, HTML snapshot assembly, locked encrypted-field/gate normalization, locked-response row selection, locked-gate detail shaping, local-storage polling decision planning, and locked-response envelope decrypt use narrow injected-port controllers or domain ports. Export label/filename/download planning, filtered-question export row selection, demo analysis artifact planning, HTML/PDF report download identity, ready/blocked execution plans, modal/export/analysis state patches, and settlement patches remain pure-descriptor routed. | `surveyResultsQuestionModeCacheNormalizationController.ts`, `surveyResultsBrowserDownloadPort.ts`, `surveyResultsHtmlReportDownloadPort.ts`, `surveyResultsHtmlReportExporterPort.ts`, `surveyResultsAnalysisGenerationPort.ts`, and `cryptoGatePort.ts` now cover the PRD 651 SV-R execution-port slices. Existing cache, artifact, export-plan, analysis-data-model, snapshot-data-model, locked-field-helper, locked-response-model, locked-gate-detail-model, local-storage-poll-decision, report-data-model, report-download-request, lifecycle, write-eligibility, and state-patch modules still hold the descriptor contracts. | Cache-normalization byte identity, browser-download Blob/object-URL/anchor metadata, HTML/PDF report utility late binding, report render/download request identity, AI `callAI` option identity, CryptoGate utility spy preservation, CSV/JSON export payload identity, response CSV latest-row dedupe/metadata fallback, HTML report response-count/participant/question-row identity, analysis response-row and segment-dimension identity, HTML snapshot identity, locked field/gate helper identity, locked-response row identity, locked gate-detail identity, local-storage poll decision identity, generated completion cache-write-before-lifecycle order, and the existing artifact/export/report lifecycle matrices are pinned. | export filename/status side effects, feedback timers, warning/error logging, route/session state, nonce refresh status application, generated-artifact final state application, concrete React state application, and result mutation. | The remaining broad persistence crosses parent feedback lifecycles, route/session state, concrete state application, and final generated-artifact status application. Q7 decrypt remains live-E2E-blocked until an operator runs the gated results flow. | Next safe lane: keep route/session, feedback timers, export filename/status side effects, final generated-artifact state application, and concrete state application parent-owned unless another descriptor/runtime slice can be proven with focused fake-port tests. |
| SurveyResults refresh/status and read-only cache orchestration | Manual refresh dispatch, manual-refresh target-block state plus polling follow-up application, queued refresh, selected metadata reads, scoped network reads, fallback write dispatch, view/survey reset state, local-storage poll state, concrete cache access, latest-block reads, fetch-request coalescing, local-storage polling backoff/timers, and queued refresh microtask/frame scheduling now have narrow helper/runtime/port boundaries. | `surveyResultsManualRefreshStatusApplicationController.ts`, `surveyResultsHelpers.ts`, `surveyResultsBlockNumbers.ts`, `surveyResultsCacheControllerSnapshot.ts`, `surveyResultsQuestionMetadataReadController.ts`, `surveyResultsQuestionNetworkReadController.ts`, `surveyResultsCachePort.ts`, `surveyResultsFetchResponsesRuntime.ts`, `surveyResultsLocalStoragePollingRuntime.ts`, and `surveyResultsQueuedRefreshRuntime.ts` hold the pure/read-only/runtime contract shapes. | Refresh/status no-op/failure sequencing, manual-refresh target patch and follow-up order, reset patch identity, local-storage poll patch identity, readiness display, malformed block guard behavior, metadata read, scoped network read, cache port call fidelity/late binding, fetch coalescing, polling backoff, hidden/closed/unmounted polling guards, queued refresh coalescing, and parent shell wiring are pinned. | concrete React state application, nonce refresh status application, route/session state, feedback timers, and result mutation. | The remaining lifecycle still crosses parent state application, route/session state, nonce refresh, feedback timers, and result mutation. | Next safe lane: keep state application, route/session mutation, nonce refresh, and feedback timers parent-owned unless another runtime slice can be proven with focused fake-port tests. |
| SurveyQuestions response input and route readiness | Full-question response input display/action descriptors, route authoring readiness, route JSON-preview availability, and submit-readiness descriptors are pure/helper-routed. | `surveyQuestionsFullQuestionResponseInputState.ts` defines question-type input state and answer/rating/encryption action identity; `surveyQuestionsTypes.ts` defines route authoring readiness, JSON-preview availability, and submit-readiness status from passed-in values. | Disabled multichoice/binary/rating no-dispatch, audio worker identity, callback argument order, rating commit identity, encryption-toggle inertness while submitting, encrypted upload readiness, masked single-question submit blocking, route editable-question readiness, JSON preview availability, and submit no-dispatch plans are pinned. | Handler execution, setState, draft persistence, question rendering, JSON generation, submit/encrypt/decrypt/Lit execution, cache reads/writes, fetch/retry/timers, route/session mutation, worker/audio execution, and telemetry remain parent-owned. | Further extraction would mostly package callbacks or create a generic renderer without deleting parent execution branches. | Next safe lane: only extract a direct question-type, response-action, or route-readiness descriptor when it removes parent branching and keeps execution parent-owned; otherwise move to SurveyQuestions final decomposition review. |
| SurveyQuestions decrypt/cache readiness | Submit-status handoff, single-question source-restore context decisions, cache-bootstrap flow decisions, cache-bootstrap stop-handling descriptors, seeded hydration patch planning, current-question preservation planning, and question-decrypt status planning have extracted pure/controller boundaries, but decrypt/cache restore execution is not controller-routed. | `surveyToolSingleQuestionCacheBootstrapController.ts`, `surveyToolResponseSourceController.ts`, and `surveyQuestionsJsonDerivation.ts` define source-restore/cache-bootstrap/source/JSON-readiness decisions from passed-in values. | Missing route question-id stop behavior, blocked-question state descriptors, retry cleanup decisions, scoped slug/candidate planning, encrypted submitted JSON readiness, same-envelope restore, refreshed-plaintext precedence, recent payload restore, stale recent-payload fallback to normal metadata loading, single-question cache-bootstrap flow/stop-handling planning, seeded hydration patch planning, current-question preservation patch shape, and disabled local-cache fallback are pinned. | Lit/decrypt execution, submit execution, worker/storage, cache reads/writes, fetches, route/navigation, retry scheduling, wallet/provider, and state mutation. | Source restore still meets real decrypt/cache/submit lifecycles inside the parent; only its pure setup/context decisions are helper-routed. | Next safe lane: keep Lit/decrypt, cache reads/writes, fetches, retries, route/session, and state application parent-owned; only extract another source/decrypt decision if it deletes parent branches without adding passive descriptors. |
| UserPage cache/decrypt/action boundaries | Analyze, bookmark, cache-refresh clicks, encrypted visibility status-request planning, cache refresh state patch planning, and deep-scan cache-refresh carry/loading input composition use injected or pure-plan helpers. | `userPageActionController.ts`, `userPageGateHelpers.ts`, `userPageLoadingStateHelpers.ts`, and UserPage helper modules define action/gate/readiness/loading/cache-refresh patch contracts from passed-in values. | Cached responses, gated visibility, no-account encrypted visibility inertness, no-account decrypt-click inertness, decrypt-click wiring, stale/refresh boundaries, incomplete cache lane AI/compare disabling, visible gated cached data, encrypted visibility terminal/read-status identities, cache refresh state patch planning, deep-scan refresh carry/loading input planning, and cached-analysis refresh boundaries are pinned. | Real decrypt execution, sponsored access promises, cache reads/writes, bookmark persistence, AI fetch, route mutation, timers, refresh execution, telemetry emission, and state application. | Cache/decrypt refresh still crosses user visibility, fetch, analysis, sponsored access, and parent state application. | Next safe lane: keep refresh execution and sponsored access parent-owned; only extract pure patch/display plans that delete parent decision code without forwarding broad prop bundles. |
| SBTPage/SBTsList realtime/cache readiness | Full-page mint/burn action rendering now sits in a passive action surface fed by a pure full-action display plan and named execution props; holder count/refresh/scan-progress presentation now sits in `SbtPageHolderStatusDisplay.tsx` fed by typed holder-count and scan-progress descriptors; mini-card display state, admin action display planning, mint-input display helpers, central holder-refresh lifecycle planning, cache-revision reload planning, load-rerun queue planning, SBT list runtime-port wrapper typing, SBT list interactive target lookup, realtime-progress bridge planning, session-chip progress visibility/display planning, session selector route/option display planning, passive session selector panel rendering, SBT list initial/chip loading-status collection planning, SBT list section loading-readiness/display planning, and SBT list section body chrome are extracted, but realtime/cache execution is not controller-routed. | SBT helper modules define holder/action/status/session/mini-card readiness plans, the full-page action display plan, the admin action display plan, pure central-refresh lifecycle plan, cache-revision reload plan, pending load-rerun queue plan, SBT list runtime-port wrappers, `SBTsList` realtime progress input/retention plans, session-chip progress desired-visibility/sticky transition/display plans, session selector route href/summary/option display plans, initial/chip loading-status collection plans, section discovery/search/spinner/refresh-busy readiness plans, and section loading/empty display plans from passed-in values; `SBTsList.tsx` is 3219 lines after delegating status/readiness display collection, session selector option/panel display, runtime-port wrapper typing, interactive ancestor lookup, and section body chrome while keeping the per-session snapshot resolver and timer/state execution parent-owned; `SbtPageFullActionButtons.tsx` consumes the full-action descriptors and routes only explicit mint/burn props through existing controllers; `SbtPageAdminActions.tsx` consumes admin display plans and named execution props; `SbtPageHolderStatusDisplay.tsx` defines the passive holder count and scan-progress display contracts consumed by `SbtPageStatsSection.tsx`; `sbtListRuntimePorts.ts` wraps the live contract helper and create-form cache reader bindings without taking over contract/cache execution; `sbtListRealtimeProgressHelpers.ts` describes live-progress bridge updates, stale-prune decisions, and next-prune timing without owning refs or timers; `sbtListChipProgressVisibilityHelpers.ts` describes chip progress text/width/style display decisions plus visibility initialization, pending-sync, delayed commit, timer-retention, and stale-meta removal decisions without owning refs, timers, render callbacks, or state updates; `sbtListSessionSelectorDisplayHelpers.ts` describes session route hrefs, collapsed-summary slugs, and chip option descriptors without owning chip toggles, opening tabs, discovery, route navigation, cache, timers, or state updates; `SbtListSessionUniversePanel.tsx` renders the passive open/closed selector panel, header controls, collapsed summary, chip selector, and show-more row while routing named callbacks back to `SBTsList.tsx`. | Complete cached-metadata readiness without refresh/direct metadata/cache write/owner fallback, full-page mint/burn display-plan identity and dispatch inertness, admin action display-plan identity/inertness, holder count/loading/refresh/scan display, stats-section descriptor wiring, mini-card button/status descriptors, passive admin/action disabled states, mint-input shell routing, holder/cache fallback, cache-revision reload lifecycle, load-rerun queue merging, forced-count refresh option planning, runtime-port live binding, interactive ancestor lookup, realtime progress bridge input/retention planning, session-chip visibility/display transition planning, session selector route/chip/summary option display planning, panel open/closed/show-more rendering, initial loader fallback/status row planning, chip loading-status selected-scope filtering, section discovery/search/spinner/refresh-busy readiness planning, section body content/loading/empty display, and already-tried event-scan suppression are pinned. | Realtime listeners, recent-progress ref mutation, localStorage/timer lifecycle, contract reads/writes, mint/burn/password/invite execution, metadata fetch/write, session chip toggle/open/show-more execution, refresh dispatch, cache rereads/writes, load-rerun scheduling, route, wallet/provider, and state mutation. | Realtime refresh, cache hydration, ref mutation, timeout scheduling, and rerun scheduling are still coupled to contract, cache reread, and timer lifecycles; only the central refresh, cache-revision reload, pending-rerun queue, runtime-port wrappers, SBT list realtime-progress bridge, session-chip progress visibility/display, session selector route/option/panel display, SBT list loading-status collection, SBT list section-readiness/display decisions, interactive ancestor lookup, and section body chrome are pure/display routed. | Next safe lane: leave SBT list unless another pure display model deletes parent branch logic; do not move listener, contract, wallet, metadata, cache-write, timer, refresh dispatch, cache reread, load-rerun scheduling, ref mutation, chip toggle/open/show-more, or state execution. |
| SessionWizard publish readiness/controller boundary | Publish step sequencing, register-step tx/status, completion callbacks, and worker auto-deploy slices use injected controllers; publish readiness, metadata fallback selection, execution-step display, progress display, published pending-SBT link display models, and publish-section shell visibility now sit behind explicit pure/display boundaries. | `sessionWizardPublishReadiness.ts`, `sessionWizardPublishController.ts`, `sessionWizardPublishLinks.ts`, `sessionWizardNormalModeCards.ts`, `SessionWizardPublishSection.tsx`, and publish summary props define explicit readiness/status/display contracts. | Worker/storage readiness, manual/uploaded metadata fallback, blank manual metadata blocked/inert state, custom-worker blocked publish state, manual controls, publish progress, pure UI execution-step planning, published pending-SBT link de-duping, publish-section visibility/callback wiring, and SBT finalization wiring are pinned. | Metadata upload, worker deploy execution, storage/Arweave writes, SBT deploy/finalization execution, wallet/provider/contract calls, route mutation, and state mutation. | Publish still crosses worker deploy, storage, registry write, pending SBT finalization, and wallet/contract lifecycles. | Keep publish readiness/progress/link planning pure; a future move must isolate one injected-port decision without owning upload, worker, storage, contract, or route execution. |

## Boundary Map

The right target is **not** “eliminate all sharing.” The right target is:

```text
explicit shared core
  + thin full-mode controller
  + thin pile-mode controller
```

Both full mode and pile mode should still share code where the semantics truly need to stay identical.

### Shared Core Should Own
- Response slice shape and baseline semantics
- Pending-edit diff rules and changed-field meaning
- Draft persistence and draft rehydration
- Local cache hydration semantics
- Shared hydration/read orchestration:
  - `surveyToolHydrationController.ts`
- Shared reset/restore orchestration:
  - `surveyToolResponseResetController.ts`
- Decrypt lifecycle primitives and task bookkeeping
- Parse/normalize/apply cached response helpers
- Common submit/encryption primitives when the behavior is mode-independent

### Full Mode Should Own
- Full survey progression/navigation
- Full-mode render coordination and wide-form layout decisions
- Full submit UX/state presentation
- Viewed-response presentation behaviors that are specific to the full survey screen

### Pile Mode Should Own
- Pile load/filter/window orchestration
- Pile optimistic baseline sync and visible-window backfill
- Pile loading / empty / gated / hologram presentation
- Pile-specific submit feedback and no-pending UX
- Card-stack navigation and card-shell rendering behavior

## Pile Refactor Status

The pile-only lane has already been split into explicit helpers/controllers. The pile runtime is no longer carrying all of this inline.

### Render Surface
- `surveyPileInteractionSurface.tsx`
- `surveyPileActiveQuestionCard.tsx`
- `surveyPileQuestionSections.tsx`
- `surveyPileViewState.ts`

### Flow and Load Planning
- `surveyPileQuestionFlow.ts`
- `surveyPileLoadController.ts`
- `surveyPileLoadPlanner.ts`
- `surveyPileScopeCacheData.ts`
- `surveyPileBaselineSync.ts`
- `surveyPileCacheSync.ts`

### Response and Hydration Planning
- `surveyPileResponseController.ts`
- `surveyPileResponseWindow.ts`
- `surveyPileHydrationPlan.ts`
- `surveyPileLifecycle.ts`
- `surveyPileQuestionListEquivalence.ts`
- `surveyPileVisibleQuestionIds.ts`
- `surveyPileResponseSignature.ts`

This means the next architectural win is no longer “another pile helper peel.” The remaining payoff is in clarifying the **shared core boundary**.

## Shared-Core Progress

The first shared-core move is no longer hypothetical. The following seams are already extracted from `SurveyQuestions.tsx`:

- `surveyToolHydrationController.ts`
  - prior-response backfill orchestration
  - local-cache slice build orchestration
  - missing-rendered-response lookup orchestration
  - full-mode and single-question prefill orchestration
  - draft hydration / local-cache rehydrate orchestration
- `surveyToolResponseResetController.ts`
  - account-change reset orchestration
  - revert-pending orchestration
  - start-fresh orchestration
  - exit-editing restore orchestration
  - auto-start-fresh decision wrapper
- `surveyToolSingleQuestionController.ts`
  - single-question viewed-response bootstrap orchestration
  - single-question own-response bootstrap orchestration
  - single-question response cache read / reread / write helpers
- `surveyToolResponseSourceController.ts`
  - shared baseline-source selection for diffing / restore paths
  - shared user-answer slice memo resolution
  - shared response consistency checks for optimistic submit settlement
- `surveyToolSingleQuestionMetadataController.ts`
  - single-question cache-state lookup
  - single-question metadata timeout / recovery fetch planning
  - single-question metadata cache normalization
- `surveyToolSingleQuestionCacheBootstrapController.ts`
  - cache state initialization for single-question mode
  - recent-payload seeding when cache is empty
  - recent-payload merge/upgrade for cached question data
- `surveyToolSingleQuestionMetadataBootstrapController.ts`
  - metadata refetch gating (masked payloads, force refetch)
  - candidate fetch orchestration via `fetchSingleQuestionMetadataCandidates`
  - winning-slug cache rebinding
  - cache normalization via `normalizeSingleQuestionMetadataForCache`
- `surveyToolChangedFieldsController.ts`
  - pure diff computation for `getChangedQidsAndFields`
  - `pickBestField` — case-insensitive field lookup with encryption fallback
  - `pickBestNumber` — case-insensitive numeric field lookup
  - `buildIndexedQuestionEntryKeys` — pure question ID key normalization and grouping
  - `computeChangedQidsAndFields` — baseline vs current response slice comparison with encryption-aware tolerance
  - `orchestrateGetChangedQidsAndFields` — full cache management, ID derivation, baseline resolution, and diff delegation
  - `computePendingEditStats` — cache-aware pending edit count and encrypted-edit count computation
- `surveyToolResponsePayloadController.ts`
  - pure response payload builder for `prepareJsonAndHash`
  - `buildResponsePayload` — builds canonical response JSON for single-question, standalone, and survey modes
  - handles answered-question filtering, importance-to-conviction fallback, encryption gate resolution
- `surveyQuestionsJsonDerivation.ts`
  - pure JSON-display derivation for the response-copy/preview surface
  - `buildSurveyQuestionsJson` — selects question JSON for full vs single-question mode
  - `shouldUseSubmittedResponseJson` and `buildSubmittedResponseJson` — choose and normalize submitted response JSON without touching submit/decrypt state
  - `buildSurveyDefinitionJson` — expands survey `questionIDs` into question objects for survey JSON display
- `surveyToolAudienceDerivationController.ts`
  - audience/gate derivation for encryption policy resolution
  - `getQuestionEncryptionGates` — encryption gate array extraction from question config
  - `normalizeFieldAudienceMode` — inherit vs explicit mode resolution for additional fields
  - `normalizeResponseEncryptionAudience` — audience collapse with locked-question and recipient checks
  - `resolveFieldEncryptionAudience` — field-level audience resolution with fallback chain
  - `buildEmptyResponseFieldState` — blank field state with correct encryption defaults
  - `buildInheritedAdditionalFieldState` — additional-comment state derived from answer encryption
  - `normalizeGateLabelText` — gate label sanitization
- `surveyToolResponseMutationController.ts`
  - pure state-transition logic for answer and additional-comment field updates
  - `resolveFieldEncryptionDefaults` — shared encryption-state resolution (locked, auto-encrypt, audience, gate)
  - `buildAnswerUpdatePlan` — answer value mutation with binary re-click, hash, and inherited additional propagation
  - `buildAdditionalUpdatePlan` — additional-comment mutation with inherit/explicit mode and encryption resolution
- `surveyToolFieldEncryptionController.ts`
  - pure state-transition logic for encryption toggle and audience selection
  - `buildEncryptionTogglePlan` — unified toggle for answer/additional with locked-question forcing and inherited additional propagation
  - `buildAnswerAudienceSelectionPlan` — explicit audience selection for answer field with inherited additional propagation
  - `buildAdditionalAudienceSelectionPlan` — additional-comment audience selection with inherit/follow/plaintext/explicit branches
- `surveyToolSubmitPrepController.ts`
  - pure pre-submission planning and verification
  - `buildFieldEncryptionWorkGroups` — groups changed fields by encryption recipients for batch Lit encrypt
  - `verifyEncryptionIntegrity` — post-encrypt verification that all marked fields have encryptedPortion
- `surveyToolRatingEnvelopeSubmitController.ts`
  - pure rating encryption carry-forward and envelope management for submit path
  - `RATING_FIELD_SPECS` — canonical importance/conviction field+envelope key pairs
  - `buildRatingBaseline` — snapshot on-chain rating values/envelopes for carry-forward
  - `pickAudienceForRatingEncryption` — audience/gate resolution for rating envelope encryption
  - `shouldEncryptRatingForQid` — determines whether rating encryption is active per question
  - `processRatingEnvelopesForSubmit` — main submit-path rating envelope processor (carry-forward, encrypt, nullify plaintext)
- `surveyToolSubmitTransactionController.ts`
  - pure submit-transaction helpers for response filtering, identifier hashing, and receipt normalization
  - `filterChangedResponsesForSubmit` — mode-based response filtering (single-question, survey, standalone) with changed-set gating
  - `ensureIdentifierHash` — identifier hashing with hashIdentifier → isHexString → id fallback chain
  - `normalizeSubmitReceipt` — tx receipt normalization (ethers wait, string hash, object hash) with __ce metadata attachment
- `surveyQuestionsSubmitController.ts`
  - primary-submit inert/navigation/dispatch plan execution through injected ports
  - submit-start/stale/success/failure status handoff with parent-owned side effects
  - submitted-response URL planning for post-submit UI after receipt normalization
- `SurveyQuestionsFullQuestionSliderSection.tsx`
  - shared full-mode / pile-mode score slider presentation
  - bullhorn hint, slider-mode tabs, and multi-question/single-question commit wiring via explicit callbacks
- `SurveyQuestionsFullQuestionContentSections.tsx`
  - full-question main answer and additional-comment display slot selection
  - display-only routing between read-only answer renderers, editable controls, masked copy, and decrypt prompts through parent-supplied render nodes
- `SurveyQuestionsFullQuestionDisplay.tsx`
  - full-question card display assembly from parent-provided render delegates
  - answer/comment, footer, and slider wiring without owning submit, decrypt, route, cache, storage, or field mutation behavior
- `SurveyQuestionsFullQuestionGatedPromptCard.tsx`
  - full-question gated-prompt card chrome from parent-provided content nodes
  - card/header/notice/tag dropdown placement without owning prompt decrypt, gate display derivation, submit, route, cache, storage, or field mutation behavior
- `surveyToolDecryptFlow.js`
  - shared decrypt display, task-key, baseline/source, and state-patch helpers
  - question-decrypt attempt-start status, busy-token ownership checks, owned stale/failure cleanup, success-status handoff planning, and bulk survey decrypt source/stale status planning
- `surveyToolPostSubmitCacheController.ts`
  - pure post-submit cache write-through logic
  - `writeSubmittedResponsesToLocalCaches` — atomic cache writes for question and survey responses with recency gating, meta stamping, and survey merge
- `surveyToolCanDecryptController.ts`
  - pure context/evaluation logic for canDecryptOtherResponses gate resolution
  - `buildCanDecryptContext` — shared context builder (slug, cfg, policy, snapshot) eliminating duplicate derivation
  - `evaluateCanDecryptPreCheck` — pure pre-check evaluation (needs-wallet / no-gate / proceed)
  - `resolveCanDecryptGateAccess` — async gate verdict resolution via injected checkAccess dependency
- `surveyToolResponseGateController.ts`
  - pure response-gate and lock-audience derivation with dependency injection
  - `buildRecipientsFromGates`
  - `resolveGateDisplayLabel`
  - `resolveConfiguredGateLabel`
  - `buildGateAudienceSbtItems`
  - `getQuestionGateOptions`
  - `getResponseGateOptions`
  - `getResponseGateOptionById`
  - `resolveFieldEncryptionGateId`
  - `getEffectiveRecipientsForField`
  - `resolveGatedPromptGateNames`
  - `resolveLockAudienceSessionName`
  - covered by `surveyToolResponseGateController.test.ts` with 16 tests

That means the single-question fetch lifecycle shell extraction is now substantially complete. The submit-path is now fully decomposed into extracted controllers (payload, changed-fields, rating envelopes, transaction helpers, post-submit cache), and the response-gate / lock-audience logic now lives in its own extracted controller, leaving `submitSurveyResponse` as a thin orchestrator and `writeSubmittedResponsesToLocalCaches` as a pure helper. The remaining inline code in `fetchSingleQuestionData` is mostly DI-bag assembly and side-effect interpretation, so the next shared-core question is no longer “can we extract a controller?” It is:

1. keep extracting smaller wrappers with diminishing returns, or
2. pick the next higher-payoff seam deliberately

## Recommended Next Candidates

The next realistic candidates are:

- Remaining decrypt/source restore wrappers beyond the extracted question-decrypt attempt/status handoff
- Further pile strategy boundary cleanup only when it can delete shared-runtime complexity without moving submit, decrypt, cache, route, worker, wallet, or state-application ownership
- Further reduction of the `fetchSingleQuestionData` DI-bag assembly (diminishing returns)

These are stronger architectural moves than another tiny helper peel because:

- they are already used by both full mode and pile mode
- they still hold meaningful orchestration weight
- response-gate derivation has already been extracted, so they are the remaining places where `SurveyQuestions.tsx` is still acting as a giant hybrid runtime

## Coordinated Flip Outcome

The inheritance boundary has been replaced. `SurveyQuestions.tsx` is the shared function runtime, and `SurveyPileViewMode.tsx` renders that runtime with a typed pile strategy instead of inheriting from it. The strategy owns pile-specific initial state, lifecycle hooks, render flow, and pile-only actions; the shared runtime still owns response/decrypt/submit/cache semantics.

The next natural code move is no longer an inheritance seam decision. Continue with one of these only when it removes real shared-runtime complexity without duplicating semantics:

1. Target a remaining shared decrypt/source-restore wrapper or small engine-bag assembly reduction.
2. Keep Lit/decrypt, submit, cache, route, worker, wallet, and state application ownership in the shared runtime until a smaller tested controller can own a pure decision only.

Do **not** start with:

- pile render helpers
- full-mode layout
- decrypt UI presentation
- submit UX presentation

Those are either already improved or too mode-specific to justify the next high-risk step.

## Guardrails

- Do not duplicate pending-edit or baseline semantics across modes.
- Do not split decrypt queue ownership between modes yet.
- Do not move pile-only presentation helpers back into a shared core.
- Keep helper-level tests plus module-level regressions whenever a shared semantic is moved.
- Prefer one semantic move at a time over a broad “architecture cleanup” patch.

## Practical Read Order

If you are resuming this area, read in this order:

1. `SurveyTool.tsx`
2. `SurveyQuestions.tsx`
3. `SurveyPileViewMode.tsx`
4. `surveyPileResponseController.ts`
5. `surveyPileQuestionFlow.ts`
6. `surveyPileLoadController.ts`
7. `surveyPileBaselineSync.ts`
8. `surveyToolHydrationController.ts`
9. `surveyToolResponseResetController.ts`

That sequence gives the fastest accurate picture of what is still shared, what pile owns now, and where the next shared-core decision should come from.
