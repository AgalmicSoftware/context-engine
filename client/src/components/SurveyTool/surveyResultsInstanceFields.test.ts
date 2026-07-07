import { createSurveyResultsInstanceFields } from './surveyResultsInstanceFields';
import { EMPTY_SCOPED_QUESTION_NETWORK_DATA } from './surveyResultsQuestionNetworkReadController';

describe('surveyResultsInstanceFields', () => {
  it('creates a fresh instance bag with the expected memo defaults', () => {
    const first = createSurveyResultsInstanceFields();
    const second = createSurveyResultsInstanceFields();

    expect(first).not.toBe(second);
    expect(first._responseParseMemo).toBeInstanceOf(Map);
    expect(second._responseParseMemo).toBeInstanceOf(Map);
    expect(first._responseParseMemo).not.toBe(second._responseParseMemo);
    expect(first).toEqual(
      expect.objectContaining({
        _isMounted: false,
        _lastLocalStoragePollCoarseSignature: '',
        _lastLocalStoragePollDetailedSignature: '',
        _nonceTickInFlight: false,
        _pollLatestBlockFetchInFlight: false,
        _surveysCacheChangeNonce: 0,
        csvFileName: '',
      }),
    );
    expect(first._questionFilterQuestionsMemo).toEqual({
      networkQuestionsRef: null,
      questionResponsesNonceKey: null,
      questionResponsesRef: null,
      questionsCacheNonceKey: null,
      result: [],
    });
    expect(first._lockedResponsesModelMemo).toEqual(
      expect.objectContaining({
        aggregatorRef: null,
        overridesRef: null,
        questionLookupRef: null,
        responsesRef: null,
        result: {
          gateDetails: [],
          hasGenericGateMessage: false,
          lockedCount: 0,
          lockedRows: [],
        },
        slug: '',
      }),
    );
    expect((first._scopedQuestionNetworkDataSyncMemo as Record<string, unknown>).result).toBe(
      EMPTY_SCOPED_QUESTION_NETWORK_DATA,
    );
  });
});
