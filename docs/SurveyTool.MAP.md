# SurveyTool Runtime Map

## Quick Reference
- Entry wrapper: `client/src/components/SurveyTool/SurveyTool.tsx`
- Shared runtime: `client/src/components/SurveyTool/SurveyQuestions.tsx`
- Pile-mode controller: `client/src/components/SurveyTool/SurveyPileViewMode.tsx`
- Pile helper cluster: `client/src/components/SurveyTool/surveyPile*.ts(x)`
- Current lengths:
  - `SurveyTool.tsx`: **1,225 lines**
  - `SurveyQuestions.tsx`: **9,395 lines**
  - `SurveyQuestionsUserResponseNotice.tsx`: **86 lines**
  - `SurveyPileViewMode.tsx`: **2,587 lines**
  - `surveyQuestionsJsonDerivation.ts`: **119 lines**
- Summary: the runtime is no longer one monolithic file, but `SurveyQuestions.tsx` is still the dominant shared state machine. `PileViewMode` now owns much more of the pile-specific orchestration, while still intentionally reusing shared hydration, draft, decrypt, and submit semantics from `SurveyQuestions`.

## Current Runtime Hierarchy

```text
SurveyTool.tsx  [top-level wrapper]
  -> SurveySelector.tsx  [survey/questions selector + filter + results]
     -> QuestionsDashboard.tsx  [question list in "questions" mode]
     -> SurveyQuestions.tsx  [shared full response runtime]
        -> SurveyQuestionsUserResponseNotice.tsx  [existing-response notice actions]
        -> SurveyPileViewMode.tsx  [pile/card UX variant, extends SurveyQuestions]
```

## Responsibility Map

| File | Primary role | Notes |
|---|---|---|
| `SurveyTool.tsx` | Route/mode shell | Functional component with hooks; chooses full vs pile mode, wires shared props/nonces downward, and uses a dual-mode export pattern (hooks runtime for production, legacy shim for tests) |
| `SurveySelector.tsx` | Survey selection + URL/filter routing | Handles selector state, result toggles, and switching between question/survey views |
| `QuestionsDashboard.tsx` | Standalone question list entry | Narrow orchestration layer for "questions" mode |
| `SurveyQuestions.tsx` | Shared survey/question runtime | Owns draft persistence, response hydration, pending-edit semantics, encryption/decrypt, and submission pipeline |
| `SurveyQuestionsUserResponseNotice.tsx` | Existing-response notice view | Renders the Start Fresh / Decrypt Edit / submitted-link / Exit Editing action cluster from explicit props while leaving response state and handlers in `SurveyQuestions` |
| `SurveyPileViewMode.tsx` | Pile-mode controller | Owns pile load/filter/window coordination and pile-specific render/action UX while delegating shared semantics to `SurveyQuestions` |

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

- Shared decrypt/source restore wrappers adjacent to viewed-response handling
- Broader inheritance-to-composition boundary assessment
- Further reduction of the `fetchSingleQuestionData` DI-bag assembly (diminishing returns)

These are stronger architectural moves than another tiny helper peel because:

- they are already used by both full mode and pile mode
- they still hold meaningful orchestration weight
- response-gate derivation has already been extracted, so they are the remaining places where `SurveyQuestions.tsx` is still acting as a giant hybrid runtime

## Boundary Options

### Option A: Keep Inheritance, Just Document Seams
Pros:
- Lowest risk
- Minimal code churn
- Easy to continue incrementally

Cons:
- `SurveyQuestions.tsx` remains too implicit
- The shared boundary stays “whatever the subclass inherits”
- Future refactors remain harder to reason about

### Option B: Explicit Shared Core + Two Mode Controllers
Pros:
- Best payoff/risk balance
- Preserves necessary sharing without pretending the modes should diverge completely
- Makes future ownership decisions much clearer

Cons:
- Requires moderate plumbing
- Some tests will need to follow extracted shared helpers
- The inheritance relationship may remain for a while during the transition

### Option C: Hard Split Between Full and Pile
Pros:
- Cleanest eventual separation on paper
- Very explicit mode ownership

Cons:
- Highest regression risk
- Encourages duplicate response/hydration semantics
- Most likely to reintroduce subtle baseline, draft, and decrypt drift

## Recommendation

Choose **Option B**.

That means:

1. Keep the current inheritance temporarily.
2. Treat `SurveyQuestions.tsx` as the source of truth for shared response semantics.
3. Extract a small shared hydration/response core from `SurveyQuestions.tsx`.
4. Let both full mode and pile mode call that shared core rather than duplicating or reinterpreting the rules.

## Suggested Next Refactor Step

The next natural code move after the current controller extractions is:

1. Decide whether to keep going with mode-agnostic runtime extraction, or pause for a broader boundary redesign.
2. If continuing incrementally, target the shared decrypt/source wrappers or a small DI-bag assembly reduction next rather than revisiting response-gate logic.
3. Keep React lifecycle ownership where it is until that seam is better isolated.

Recommended next seam:

- shared decrypt/source restore wrappers, then reassess before a broader inheritance seam move

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
