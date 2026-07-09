import {
  buildPileVisibleResponseSignature,
  type PileVisibleResponseSignatureDeps,
} from './surveyPileResponseSignature.js';

const deps: PileVisibleResponseSignatureDeps = {
  buildSliceToken: () => 'TOKEN',
  mixQuestionListHash: (seed, text) => (Number(seed) + String(text || '').length) >>> 0,
  normalizeQuestionIdKey: (value) =>
    String(value || '')
      .trim()
      .toLowerCase(),
};

describe('surveyPileResponseSignature', () => {
  it('describes empty visible response signatures for anonymous or empty scopes', () => {
    expect(
      buildPileVisibleResponseSignature({
        account: '',
        deps,
        visibleIds: ['q1', 'q2'],
      }),
    ).toBe('anon:2:0');

    expect(
      buildPileVisibleResponseSignature({
        account: '0xabc',
        deps,
        visibleIds: [],
      }),
    ).toBe('acct:0:0');
  });

  it('builds visible response signatures from normalized ids and responder payloads', () => {
    expect(
      buildPileVisibleResponseSignature({
        account: ' 0xABC ',
        deps,
        questionResponses: {
          q1: {
            '0xabc': 'yes',
          },
          q2: {
            '0xabc': { answer: { value: 'later' } },
          },
        },
        visibleIds: [' Q1 ', 'q2', '', 'q3'],
      }),
    ).toBe('3:2:2166136297');
  });
});
