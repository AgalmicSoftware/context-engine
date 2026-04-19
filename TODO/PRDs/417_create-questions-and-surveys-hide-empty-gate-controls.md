# PRD 417 — CreateQuestionsAndSurveys: hide empty gate controls and align naming

**Priority:** LOW | **Effort:** LOW | **Category:** UX Polish / Naming

---

## Request

> don't show "inherit" and lock icon if there's no gates for questions in the session / no gates to select in a session
>
> for createSurvey
>
> also change that component name to createQuestionsAndSurveys if name change not already done

---

## Problem

The authoring surface still renders question/survey gate affordances even when the active session exposes no selectable response gates. In that state:

- the per-question `inherit` checkbox is meaningless
- the lock icon suggests an encryption choice exists when it does not
- the old `CreateSurvey` name understates that the component handles both standalone question creation and survey creation

This creates avoidable confusion in open sessions and in sessions where no applicable question/survey response gates are configured.

## Requirements

### 1. Hide empty gate affordances

In the authoring UI, if `resolveGateOptions(...)` returns no selectable gate options for the active session:

- do not render the survey-title gate lock
- do not render the survey-title gate tooltip
- do not render the per-question `inherit` toggle
- do not render the per-question gate lock

If selectable gate options do exist, keep the current behavior unchanged.

### 2. Rename the live component surface

Rename the active component/file/export/imports from `CreateSurvey` to `CreateQuestionsAndSurveys`.

This rename should apply to:

- the live React component export
- direct import sites in the authoring flow
- active docs that point at the component path

Historical PRDs can keep older references as historical context.

### 3. Preserve test stability

- Keep the existing `ce-create-*` TestID API stable
- Add focused regression coverage proving the gate controls disappear when no gate options exist
- Add focused regression coverage proving the controls still render when gate options are available

## Acceptance Criteria

- [ ] No `inherit` toggle appears in CreateQuestionsAndSurveys when the session has no selectable gates
- [ ] No question/survey lock icon appears in CreateQuestionsAndSurveys when the session has no selectable gates
- [ ] Existing gate-selection behavior still works when gate options are available
- [ ] The live component is named `CreateQuestionsAndSurveys`
- [ ] Active docs point at `CreateQuestionsAndSurveys.jsx`
- [ ] Targeted tests cover both the hidden-controls and visible-controls cases

## Files

- `client/src/components/SurveyTool/CreateQuestionsAndSurveys.jsx`
- `client/src/components/SurveyTool/CreateQuestionsAndSurveys.cache.test.js`
- `client/src/components/SurveyTool/CreateQuestionsAndSurveys.module.scss`
- `client/src/components/SurveyTool/CreateQuestionsAndSurveys.module.test.js`
- `client/src/components/SurveyTool/SurveyTool.jsx`
- `client/src/components/SurveyTool/SurveySelector.jsx`
- `client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.jsx`
- `client/src/components/SurveyTool/SurveyGenerator/AudioSurveyGenerator.test.jsx`
- `docs/e2e-testid-api.md`
- `docs/arweave-payloads.md`
- `docs/session-registry.md`
- `ARCHITECTURE.md`
