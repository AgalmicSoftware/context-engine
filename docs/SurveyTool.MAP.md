# SurveyTool Runtime Map

## Quick Reference
- Entry wrapper: `client/src/components/SurveyTool/SurveyTool.jsx`
- Shared runtime: `client/src/components/SurveyTool/SurveyQuestions.tsx`
- Pile-mode controller: `client/src/components/SurveyTool/SurveyPileViewMode.tsx`
- Pile helper cluster: `client/src/components/SurveyTool/surveyPile*.ts(x)`
- Current lengths:
  - `SurveyTool.jsx`: **1,094 lines**
  - `SurveyQuestions.tsx`: **11,277 lines**
  - `SurveyPileViewMode.tsx`: **2,587 lines**
- Summary: the runtime is no longer one monolithic file, but `SurveyQuestions.tsx` is still the dominant shared state machine. `PileViewMode` now owns much more of the pile-specific orchestration, while still intentionally reusing shared hydration, draft, decrypt, and submit semantics from `SurveyQuestions`.

## Current Runtime Hierarchy

```text
SurveyTool.jsx  [top-level wrapper]
  -> SurveySelector.tsx  [survey/questions selector + filter + results]
     -> QuestionsDashboard.tsx  [question list in "questions" mode]
     -> SurveyQuestions.tsx  [shared full response runtime]
        -> SurveyPileViewMode.tsx  [pile/card UX variant, extends SurveyQuestions]
```

## Responsibility Map

| File | Primary role | Notes |
|---|---|---|
| `SurveyTool.jsx` | Route/mode shell | Chooses full vs pile mode and wires shared props/nonces downward |
| `SurveySelector.tsx` | Survey selection + URL/filter routing | Handles selector state, result toggles, and switching between question/survey views |
| `QuestionsDashboard.tsx` | Standalone question list entry | Narrow orchestration layer for "questions" mode |
| `SurveyQuestions.tsx` | Shared survey/question runtime | Owns draft persistence, response hydration, pending-edit semantics, encryption/decrypt, and submission pipeline |
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

That means the next shared-core question is no longer “can we extract a controller?” It is:

1. keep extracting smaller wrappers with diminishing returns, or
2. pick the next higher-payoff seam deliberately

## Recommended Next Candidates

The next realistic candidates are:

- Single-question response bootstrap / fetch lifecycle
- Shared response-source restore helpers adjacent to decrypt/viewed-response flows
- A broader inheritance-to-composition boundary pass

These are stronger architectural moves than another tiny helper peel because:

- they are already used by both full mode and pile mode
- they still hold meaningful orchestration weight
- they are the remaining places where `SurveyQuestions.tsx` is still acting as a giant hybrid runtime

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
2. If continuing incrementally, target the single-question response bootstrap / restore seam next.
3. Keep React lifecycle ownership where it is until that seam is better isolated.

Recommended next seam:

- shared single-question response bootstrap / restore primitives

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

1. `SurveyTool.jsx`
2. `SurveyQuestions.tsx`
3. `SurveyPileViewMode.tsx`
4. `surveyPileResponseController.ts`
5. `surveyPileQuestionFlow.ts`
6. `surveyPileLoadController.ts`
7. `surveyPileBaselineSync.ts`
8. `surveyToolHydrationController.ts`
9. `surveyToolResponseResetController.ts`

That sequence gives the fastest accurate picture of what is still shared, what pile owns now, and where the next shared-core decision should come from.
