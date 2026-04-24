import { RATING_MIN } from '../../utilities/survey/ratingValue.js';
import {
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
    expect(Array.from(buildRatingEnvelopeQidSetFromUserAnswers({
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
    }))).toEqual(['q1', 'q2']);

    expect(Array.from(buildRatingEnvelopeQidSetFromUserAnswers({
      questionID: 'Q4',
      importanceEncrypted: 'imp-env',
    }))).toEqual(['q4']);
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
