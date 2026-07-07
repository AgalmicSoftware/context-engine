import { RATING_MIN } from '../../utilities/survey/ratingValue.js';
import {
  buildQuestionCacheHydrationPatch,
  buildQuestionResponseHydrationPatch,
  buildRatingEnvelopeQidSetFromUserAnswers,
  clampSliderValue,
  getConvictionFromResponse,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  getImportanceFromResponse,
  getImportanceFromSlice,
  getNormalizedUiRatingValue,
  isSingleSelectMultichoice,
  normalizeMultichoiceValue,
  toNumberOrNull,
} from './surveyToolResponseState.js';

describe('surveyToolResponseState', () => {
  it('normalizes numbers and UI rating fallbacks safely', () => {
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull('4')).toBe(4);
    expect(toNumberOrNull('NaN')).toBeNull();
    expect(getNormalizedUiRatingValue(null)).toBe(RATING_MIN);
    expect(getNormalizedUiRatingValue('7')).toBe(7);
    expect(clampSliderValue('11', 1, 10)).toBe(10);
    expect(clampSliderValue('bad', 1, 10)).toBe(1);
  });

  it('derives conviction and importance from response payloads with existing fallback rules', () => {
    expect(getConvictionFromResponse({ conviction: '3', importance: '5' })).toBe(3);
    expect(getConvictionFromResponse({ importance: '5' })).toBe(5);
    expect(getConvictionFromResponse({})).toBeNull();

    expect(getImportanceFromResponse({ importance: '4' })).toBe(4);
    expect(getImportanceFromResponse({ conviction: '2' })).toBeNull();
  });

  it('builds rating envelope question sets from single payloads and response arrays', () => {
    expect(
      Array.from(
        buildRatingEnvelopeQidSetFromUserAnswers({
          responses: [
            {
              questionID: 'Q1',
              importanceEncrypted: 'imp-env',
            },
            {
              questionId: 'q2',
              convictionEncrypted: 'conv-env',
            },
            {
              questionIDHash: 'q3',
            },
          ],
        }),
      ),
    ).toEqual(['q1', 'q2']);

    expect(
      Array.from(
        buildRatingEnvelopeQidSetFromUserAnswers({
          questionID: 'Q4',
          importanceEncrypted: 'imp-env',
        }),
      ),
    ).toEqual(['q4']);
  });

  it('builds response hydration patches with overwrite and inherited-additional handling', () => {
    const deps = {
      parseValue: jest.fn((value) => value),
      areEnvelopesEquivalent: jest.fn(() => false),
      normalizeResponseEncryptionAudience: jest.fn((audience) => audience || 'self'),
      getDefaultResponseEncryptionAudienceForQid: jest.fn(() => 'gate'),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) => `${qid}:${fieldKey}`),
      normalizeFieldAudienceMode: jest.fn((mode) => mode || 'explicit'),
      buildInheritedAdditionalFieldState: jest.fn((additionalState, answerState) => ({
        ...additionalState,
        inheritedFromAnswer: answerState?.value || null,
      })),
      buildEmptyResponseFieldState: jest.fn(() => ({ value: '', encrypted: false })),
    };

    expect(
      buildQuestionResponseHydrationPatch({
        questionId: 'Q1',
        response: {
          answer: {
            value: 'hydrated answer',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: 'hydrated notes',
            encrypted: true,
            encryptionAudience: 'gate',
            audienceMode: 'inherit',
            encryptedPortion: 'add-env',
          },
          importance: 4,
          conviction: 7,
        },
        currentAnswer: { value: '' },
        currentAdditional: { value: '' },
        hasCurrentImportance: false,
        hasCurrentConviction: false,
        allowOverwrite: false,
        deps,
      }),
    ).toEqual({
      changed: true,
      answerState: {
        value: 'hydrated answer',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'q1:answer',
        audienceMode: 'explicit',
        hash: '',
        encryptedPortion: 'ans-env',
      },
      additionalState: {
        value: 'hydrated notes',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'q1:additional',
        audienceMode: 'inherit',
        hash: '',
        encryptedPortion: 'add-env',
        inheritedFromAnswer: 'hydrated answer',
      },
      importanceChanged: true,
      importanceValue: 4,
      convictionChanged: true,
      convictionValue: 7,
    });

    expect(
      buildQuestionResponseHydrationPatch({
        questionId: 'q1',
        response: {
          answer: { value: 'ignored answer' },
          additional: { value: 'ignored notes' },
          importance: 3,
          conviction: 5,
        },
        currentAnswer: { value: 'keep answer' },
        currentAdditional: { value: 'keep notes' },
        hasCurrentImportance: true,
        hasCurrentConviction: true,
        allowOverwrite: false,
        deps,
      }),
    ).toEqual({
      changed: false,
      answerState: undefined,
      additionalState: undefined,
      importanceChanged: false,
      importanceValue: undefined,
      convictionChanged: false,
      convictionValue: undefined,
    });
  });

  it('builds cache hydration patches that preserve masked encrypted fields and inherited additional state', () => {
    const deps = {
      parseValue: jest.fn((value) => value),
      normalizeResponseEncryptionAudience: jest.fn((audience) => audience || 'self'),
      getDefaultResponseEncryptionAudienceForQid: jest.fn(() => 'gate'),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) => `${qid}:${fieldKey}`),
      normalizeFieldAudienceMode: jest.fn((mode) => mode || 'explicit'),
      buildInheritedAdditionalFieldState: jest.fn((additionalState, answerState) => ({
        ...additionalState,
        encryptionGateId: answerState?.encryptionGateId || null,
        inheritedFromAnswer: answerState?.encryptedPortion || null,
      })),
      buildEmptyResponseFieldState: jest.fn(() => ({ value: '', encrypted: false })),
    };

    expect(
      buildQuestionCacheHydrationPatch({
        questionId: 'Q1',
        response: {
          answer: {
            value: 'plaintext answer should be masked',
            encrypted: true,
            encryptionAudience: 'gate',
            encryptedPortion: 'ans-env',
          },
          additional: {
            value: 'plaintext additional should be masked',
            encrypted: true,
            encryptionAudience: 'gate',
            audienceMode: 'inherit',
            encryptedPortion: 'add-env',
          },
          importance: 4,
          conviction: 7,
        },
        deps,
      }),
    ).toEqual({
      changed: true,
      answerState: {
        value: '*',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'q1:answer',
        audienceMode: 'explicit',
        hash: '',
        encryptedPortion: 'ans-env',
      },
      additionalState: {
        value: '*',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'q1:answer',
        audienceMode: 'inherit',
        hash: '',
        encryptedPortion: 'add-env',
        inheritedFromAnswer: 'ans-env',
      },
      importanceChanged: true,
      importanceValue: 4,
      convictionChanged: true,
      convictionValue: 7,
    });
  });

  it('builds cache hydration patches from answer-only encrypted responses', () => {
    const deps = {
      parseValue: jest.fn((value) => value),
      normalizeResponseEncryptionAudience: jest.fn((audience) => audience || 'self'),
      getDefaultResponseEncryptionAudienceForQid: jest.fn(() => 'gate'),
      resolveFieldEncryptionGateId: jest.fn((_field, qid, fieldKey) => `${qid}:${fieldKey}`),
      normalizeFieldAudienceMode: jest.fn((mode) => mode || 'explicit'),
    };

    expect(
      buildQuestionCacheHydrationPatch({
        questionId: 'Q1',
        response: {
          answer: {
            value: 'encrypted plaintext should be masked',
            encrypted: true,
            encryptedPortion: 'ans-env',
          },
          importance: 4,
        },
        deps,
      }),
    ).toEqual({
      changed: true,
      answerState: {
        value: '*',
        encrypted: true,
        encryptionAudience: 'gate',
        encryptionGateId: 'q1:answer',
        audienceMode: 'explicit',
        hash: '',
        encryptedPortion: 'ans-env',
      },
      additionalState: undefined,
      importanceChanged: true,
      importanceValue: 4,
      convictionChanged: true,
      convictionValue: 4,
    });
  });

  it('reads conviction and importance from response slices with strict and fallback variants', () => {
    const slice = {
      conviction: { q1: '2' },
      importance: { q2: '5', q3: '7' },
    };

    expect(getConvictionFromSlice(slice, 'q1')).toBe(2);
    expect(getConvictionFromSlice(slice, 'q2')).toBe(5);
    expect(getConvictionFromSliceStrict(slice, 'q2')).toBeNull();
    expect(getConvictionFromSliceStrict(slice, 'q1')).toBe(2);
    expect(getImportanceFromSlice(slice, 'q3')).toBe(7);
    expect(getImportanceFromSlice(slice, 'q1')).toBeNull();
  });

  it('normalizes multichoice answers and detects single-select multichoice questions', () => {
    expect(normalizeMultichoiceValue(undefined)).toEqual([]);
    expect(normalizeMultichoiceValue('option-a')).toEqual(['option-a']);
    expect(normalizeMultichoiceValue(['option-a', 'option-b'])).toEqual(['option-a', 'option-b']);

    expect(isSingleSelectMultichoice({ type: 'multichoice', singleSelect: true })).toBe(true);
    expect(isSingleSelectMultichoice({ type: 'multichoice', singleChoice: true })).toBe(true);
    expect(isSingleSelectMultichoice({ type: 'text', singleSelect: true })).toBe(false);
  });
});
