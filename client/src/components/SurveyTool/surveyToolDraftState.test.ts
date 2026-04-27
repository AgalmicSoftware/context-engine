import {
  buildPersistedDraftQuestionEntry,
  buildSurveyDraftSemanticSignature,
  computeSubmitLabel,
  getPendingStatsSnapshotFromState,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowSingleQuestionResponseLookupSpinner,
  updateSubmittedSinceLastEdit,
} from './surveyToolDraftState.js';

describe('surveyToolDraftState', () => {
  it('recognizes meaningful field values across scalar and structured payloads', () => {
    expect(hasMeaningfulFieldValue({ value: '' })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: '   ' })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: [] })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: {} })).toBe(false);
    expect(hasMeaningfulFieldValue({ value: '*' })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: false })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: 0 })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: ['x'] })).toBe(true);
    expect(hasMeaningfulFieldValue({ value: { nested: true } })).toBe(true);
  });

  it('snapshots pending edit stats from component state', () => {
    expect(getPendingStatsSnapshotFromState({
      modifiedCount: '3',
      encryptedModifiedCount: '2',
    })).toEqual({
      total: 3,
      encrypted: 2,
    });
  });

  it('builds submit labels from provided stats, callback stats, and state fallbacks', () => {
    expect(computeSubmitLabel({}, {
      suffix: 'Responses',
      pendingStats: { total: 2, encrypted: 1 },
    })).toBe('Submit Responses (2)');

    expect(computeSubmitLabel({
      getPendingEditStats: () => ({ total: 1, encrypted: 0 }),
    }, {
      suffix: 'Response',
    })).toBe('Submit Response (1)');

    expect(computeSubmitLabel({
      state: { modifiedCount: 0, encryptedModifiedCount: 0 },
    })).toBe('Submit');
  });

  it('does not auto-encrypt empty additional comments when answer audience changes', () => {
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '   ', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: 'context', encrypted: false })).toBe(true);
  });

  it('builds persisted draft entries only when answer/additional/slider content is meaningful', () => {
    const resolvers = {
      resolveFieldEncryptionAudience: jest.fn((field, qid, fieldKey) => (
        fieldKey === 'additional' ? `${qid}:additional` : `${qid}:answer`
      )),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) => (
        fieldKey === 'additional' ? `${qid}:gate:add` : `${qid}:gate:answer`
      )),
      normalizeFieldAudienceMode: jest.fn((mode, fieldKey) => (
        mode || (fieldKey === 'additional' ? 'inherit' : 'explicit')
      )),
    };

    expect(buildPersistedDraftQuestionEntry({
      questionId: 'q1',
      answer: { value: '' },
      additional: { value: '' },
      importance: null,
      conviction: null,
      resolvers,
    })).toBeNull();

    expect(buildPersistedDraftQuestionEntry({
      questionId: 'Q1',
      answer: { value: 'hello', encrypted: true, encryptedPortion: 'ans-env', audienceMode: 'explicit' },
      additional: { value: 'notes', encrypted: true, encryptedPortion: 'add-env', audienceMode: 'inherit' },
      importance: 4,
      conviction: 7,
      resolvers,
    })).toEqual({
      value: 'hello',
      answerEncrypted: true,
      answerEncryptionAudience: 'q1:answer',
      answerEncryptionGateId: 'q1:gate:answer',
      answerAudienceMode: 'explicit',
      answerEncryptedPortion: 'ans-env',
      additional: 'notes',
      additionalEncrypted: true,
      additionalEncryptionAudience: 'q1:additional',
      additionalEncryptionGateId: 'q1:gate:add',
      additionalAudienceMode: 'inherit',
      additionalEncryptedPortion: 'add-env',
      importance: 4,
      conviction: 7,
    });
  });

  it('does not include empty additional comments in submit-time encryption work', () => {
    expect(shouldEncryptResponseFieldForSubmit({ value: '', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: '   ', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: '*', encrypted: true })).toBe(false);
    expect(shouldEncryptResponseFieldForSubmit({ value: 'notes', encrypted: true })).toBe(true);
  });

  it('allows draft force-overwrite unless the submitted latch is active without edits', () => {
    expect(shouldForceOverwriteDraftValues({
      forceOverwrite: true,
      isDirty: false,
      pendingTotal: 0,
      submittedStateActive: false,
    })).toBe(true);
    expect(shouldForceOverwriteDraftValues({
      forceOverwrite: true,
      isDirty: false,
      pendingTotal: 0,
      submittedStateActive: true,
    })).toBe(false);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: true, isDirty: true, pendingTotal: 0 })).toBe(true);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: true, isDirty: false, pendingTotal: 1 })).toBe(true);
    expect(shouldForceOverwriteDraftValues({ forceOverwrite: false, isDirty: true, pendingTotal: 2 })).toBe(false);
  });

  it('updates submitted latch across submit/edit/reset transitions', () => {
    expect(updateSubmittedSinceLastEdit(false, 'submit_success')).toBe(true);
    expect(updateSubmittedSinceLastEdit(true, 'user_edit')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'reset')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'submit_error')).toBe(false);
    expect(updateSubmittedSinceLastEdit(true, 'unknown')).toBe(true);
  });

  it('detects conviction/importance active state from response-map presence', () => {
    expect(hasConvictionOrImportanceValueForQuestion({
      conviction: { q1: 0 },
      importance: {},
    }, 'q1')).toBe(true);
    expect(hasConvictionOrImportanceValueForQuestion({
      conviction: {},
      importance: { q1: 5 },
    }, 'q1')).toBe(true);
    expect(hasConvictionOrImportanceValueForQuestion({
      conviction: { q1: null },
      importance: {},
    }, 'q1')).toBe(false);
    expect(hasConvictionOrImportanceValueForQuestion({
      conviction: {},
      importance: {},
    }, 'q1')).toBe(false);
  });

  it('shows single-question response lookup spinner only while response probing is active', () => {
    expect(shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: true,
      isLoadingResponse: true,
      account: '0xabc',
    })).toBe(true);

    expect(shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: true,
      isLoadingResponse: true,
      responderAddress: '0xdef',
    })).toBe(true);

    expect(shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: true,
      isLoadingResponse: false,
      account: '0xabc',
    })).toBe(false);

    expect(shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: false,
      isLoadingResponse: true,
      account: '0xabc',
    })).toBe(false);
  });

  it('hides inline submit until at least one answer change is pending', () => {
    expect(shouldRenderInlineSubmitButton({
      useHeaderSubmit: false,
      canEditQuestions: true,
      hasPendingEdits: false,
      submittedStateActive: false,
      isLoadingResponse: false,
    })).toBe(false);

    expect(shouldRenderInlineSubmitButton({
      useHeaderSubmit: false,
      canEditQuestions: true,
      hasPendingEdits: true,
      submittedStateActive: false,
      isLoadingResponse: false,
    })).toBe(true);
  });

  it('does not render submitted indicator while response loading is in progress', () => {
    expect(shouldRenderSubmittedIndicator({
      submittedStateActive: true,
      isLoadingResponse: true,
    })).toBe(false);

    expect(shouldRenderSubmittedIndicator({
      submittedStateActive: true,
      isLoadingResponse: false,
    })).toBe(true);
  });

  it('keeps draft semantic signature stable when only meta timestamp changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: 'hello',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };
    const next = {
      ...base,
      meta: { ...base.meta, ts: 999999 },
    };

    expect(buildSurveyDraftSemanticSignature(next)).toBe(buildSurveyDraftSemanticSignature(base));
  });

  it('treats encrypted-portion changes as semantic draft changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: '',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptionAudience: 'gate',
          importance: null,
          conviction: null,
        },
      },
    };
    const next = {
      ...base,
      answers: {
        q1: {
          ...base.answers.q1,
          answerEncryptedPortion: 'ans-env-1',
          additionalEncryptedPortion: 'add-env-1',
        },
      },
    };

    expect(buildSurveyDraftSemanticSignature(next)).not.toBe(buildSurveyDraftSemanticSignature(base));
  });

  it('treats baseline changes as semantic draft changes', () => {
    const base = {
      meta: { networkId: 84532, surveyId: 'questions', ts: 100 },
      answers: {
        q1: {
          value: 'hello',
          answerEncrypted: false,
          answerEncryptionAudience: 'self',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };
    const next = {
      ...base,
      baseline: {
        q1: {
          value: 'hello',
          answerEncrypted: true,
          answerEncryptionAudience: 'gate',
          answerEncryptedPortion: 'ans-base-1',
          additional: '',
          additionalEncrypted: false,
          additionalEncryptionAudience: 'self',
          importance: null,
          conviction: null,
        },
      },
    };

    expect(buildSurveyDraftSemanticSignature(next)).not.toBe(buildSurveyDraftSemanticSignature(base));
  });
});
