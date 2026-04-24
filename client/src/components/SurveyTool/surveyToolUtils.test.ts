import {
  areEnvelopesEquivalent,
  buildQuestionScanProgressDisplay,
  buildSurveyDraftSemanticSignature,
  doesQuestionProgressMatchSlug,
  normalizeSurveyToolFilterState,
  shouldShowPileFullLoadingState,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  updateSubmittedSinceLastEdit,
  hasConvictionOrImportanceValueForQuestion,
  shouldShowSingleQuestionResponseLookupSpinner,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
} from './surveyToolUtils.js';
import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';

const buildQuestionScanProgressDisplayAny: any = buildQuestionScanProgressDisplay;

describe('surveyToolUtils helper coverage', () => {
  it('matches pile progress slugs across general alias and empty scope', () => {
    expect(doesQuestionProgressMatchSlug('general', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('GENERAL', '')).toBe(true);
    expect(doesQuestionProgressMatchSlug('', 'general')).toBe(true);
    expect(doesQuestionProgressMatchSlug('edge', '')).toBe(false);
  });

  it('keeps full pile loading visible when progress is active and cards are empty', () => {
    expect(shouldShowPileFullLoadingState({
      loading: false,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
    })).toBe(true);
    expect(shouldShowPileFullLoadingState({
      loading: false,
      hasVisibleQuestions: true,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
    })).toBe(false);
  });

  it('allows settled empty piles to exit full-loading even when cache-ready stays false', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: false,
      recentRateLimit: false,
      hasScanOrHydrationWork: false,
      allowUnreadyEmptySettlement: true,
    })).toBe(false);
  });

  it('allows filtered empty piles to exit full-loading while background refresh continues', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      hasScanOrHydrationWork: true,
      allowFilteredEmptySettlement: true,
    })).toBe(false);
  });

  it('exits full-loading when a terminal scan error is present', () => {
    expect(shouldShowPileFullLoadingState({
      loading: true,
      hasVisibleQuestions: false,
      firstBoot: false,
      isQuestionCacheReady: false,
      recentRateLimit: false,
      hasScanOrHydrationWork: false,
      hasTerminalScanError: true,
    })).toBe(false);
  });

  it('normalizes legacy empty filter payloads to an inactive empty state', () => {
    const normalized = normalizeSurveyToolFilterState({
      includedSBTs: [],
      excludedSBTs: [],
      onlyVerifiedHumans: false,
      tags: [],
      types: [],
    });

    expect(normalized).toEqual({});
    expect(serializeFilterState(normalized)).toBe('');
  });

  it('preserves aiTopN/aiCombine only when aiFilter is active', () => {
    const active = normalizeSurveyToolFilterState({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });
    expect(active).toMatchObject({
      aiFilter: 'climate',
      aiTopN: 6,
      aiCombine: true,
    });

    const inactive = normalizeSurveyToolFilterState({
      aiFilter: null,
      aiTopN: 6,
      aiCombine: true,
    });
    expect(inactive).toEqual({});
  });

  it('does not auto-encrypt empty additional comments when answer audience changes', () => {
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: '   ', encrypted: false })).toBe(false);
    expect(shouldAutoEncryptAdditionalOnAudienceChange({ value: 'context', encrypted: false })).toBe(true);
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

  it('treats empty envelopes as equivalent only when both sides are encrypted', () => {
    expect(areEnvelopesEquivalent('env-a', 'env-a', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('env-a', 'env-b', true, true)).toBe(false);
    expect(areEnvelopesEquivalent('', '', true, true)).toBe(true);
    expect(areEnvelopesEquivalent('', '', true, false)).toBe(false);
    expect(areEnvelopesEquivalent('env-a', '', true, true)).toBe(false);
  });

  it('formats capped question scan progress against the requested total range', () => {
    const display = buildQuestionScanProgressDisplayAny({
      totalBlocks: 50000,
      requestedTotalBlocks: 234000,
      wasCapped: true,
      scannedBlocks: 50000,
      remainingBlocks: 184000,
    });

    expect(display.metaLeftText).toBe('184,000 blocks left');
    expect(display.metaRightText).toBe('50,000 / 234,000');
    expect(display.percentComplete).toBe(21);
  });
});
