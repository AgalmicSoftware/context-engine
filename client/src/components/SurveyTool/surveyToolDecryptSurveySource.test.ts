import { buildSurveyDecryptAttemptSourceInputs, buildSurveyDecryptSourceState } from './surveyToolDecryptSurveySource';

describe('surveyToolDecryptSurveySource', () => {
  it('normalizes latest responses into a typed source slice and rating envelope map', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      importance: { q1: null },
      conviction: {},
      additionalComments: {},
    }));

    expect(
      buildSurveyDecryptSourceState(
        {
          responses: [
            { questionID: 'Q1', importanceEncrypted: 'imp-1' },
            { questionId: 'q2', convictionEncrypted: 'conv-2' },
          ],
        },
        null,
        {
          importance: { q1: 7 },
          conviction: { q1: 9 },
        },
        buildSliceFromUserAnswers,
      ),
    ).toEqual({
      sourceSlice: {
        answers: { q1: { value: '*' } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
        additionalComments: {},
      },
      ratingEnvelopesByQid: {
        q1: { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
        q2: { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
      },
    });
    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith({
      responses: [
        { questionID: 'Q1', importanceEncrypted: 'imp-1' },
        { questionId: 'q2', convictionEncrypted: 'conv-2' },
      ],
    });
  });

  it('keeps survey attempt source fallbacks parent-owned', () => {
    const fallbackSlice = {
      answers: { q3: { value: '*' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const state = {
      userAnswers: { answers: { q1: { value: 'cached' } } },
      surveysResponseState: [null, fallbackSlice],
    };

    expect(
      buildSurveyDecryptAttemptSourceInputs({
        decryptContext: { sessionSlug: '', surveyIndex: 1 },
        state,
        getEffectiveDraftSlug: () => 'draft-slug',
      }),
    ).toEqual({
      surveyIndex: 1,
      slug: 'draft-slug',
      fallbackUserAnswers: state.userAnswers,
      fallbackSourceSlice: fallbackSlice,
      previousStateSlice: fallbackSlice,
    });
  });
});
