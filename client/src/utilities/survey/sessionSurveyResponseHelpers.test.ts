import {
  mergeSurveyResponseCacheSnapshot,
  normalizeSurveyResponseBatchResult,
  resolveSurveyResponseWatermark,
  type SurveyResponseItem,
} from './sessionSurveyResponseHelpers.js';

const mergeTestResponseDelta = ({
  preFetchResponses,
  freshResponses,
  fetchedResponses,
  freshWatermark,
  safeResponseWatermark,
}: {
  preFetchResponses: Record<string, unknown>;
  freshResponses: Record<string, unknown>;
  fetchedResponses: SurveyResponseItem[];
  freshWatermark: number;
  safeResponseWatermark: number;
}) => {
  const networkId = '11155420';
  const surveyId = 'survey';
  const next = mergeSurveyResponseCacheSnapshot({
    currentCache: {
      [networkId]: {
        surveysLatestBlock: 0,
        surveys: {},
        pendingSurveyMetadata: {},
        surveyResponses: { [surveyId]: freshResponses },
        surveyResponsesLatestBlock: { [surveyId]: freshWatermark },
      },
    },
    networkId,
    surveyId,
    initialWatermark: 0,
    preFetchResponses,
    fetchedResponses,
    safeResponseWatermark,
  });
  return {
    responses: next[networkId].surveyResponses[surveyId],
    watermark: next[networkId].surveyResponsesLatestBlock[surveyId],
  };
};

describe('sessionSurveyResponseHelpers', () => {
  it('normalizes legacy array response batches without partial failure metadata', () => {
    const responses = [{ responder: '0xabc', response: { choice: 'A' } }];

    expect(normalizeSurveyResponseBatchResult(responses)).toEqual({
      responses,
      hadPartialFailure: false,
      lowestFailedBlock: null,
    });
  });

  it('normalizes object response batches and ignores malformed response arrays', () => {
    expect(
      normalizeSurveyResponseBatchResult({
        responses: [{ responder: '0xabc', response: { choice: 'A' } }],
        hadPartialFailure: true,
        lowestFailedBlock: '14',
      }),
    ).toEqual({
      responses: [{ responder: '0xabc', response: { choice: 'A' } }],
      hadPartialFailure: true,
      lowestFailedBlock: 14,
    });

    expect(
      normalizeSurveyResponseBatchResult({
        responses: { responder: '0xabc' },
        lowestFailedBlock: 'not-a-block',
      }),
    ).toEqual({
      responses: [],
      hadPartialFailure: false,
      lowestFailedBlock: null,
    });
  });

  it('keeps the latest block on full success', () => {
    expect(
      resolveSurveyResponseWatermark({
        startBlock: 8,
        latestBlock: 12,
        hadPartialFailure: false,
        lowestFailedBlock: 9,
      }),
    ).toBe(12);
  });

  it('backs the watermark up to the safe block before the first failed response block', () => {
    expect(
      resolveSurveyResponseWatermark({
        startBlock: 8,
        latestBlock: 20,
        hadPartialFailure: true,
        lowestFailedBlock: 11,
      }),
    ).toBe(10);

    expect(
      resolveSurveyResponseWatermark({
        startBlock: 8,
        latestBlock: 20,
        hadPartialFailure: true,
        lowestFailedBlock: 2,
      }),
    ).toBe(7);

    expect(
      resolveSurveyResponseWatermark({
        startBlock: 8,
        latestBlock: 20,
        hadPartialFailure: true,
        lowestFailedBlock: null,
      }),
    ).toBe(7);
  });

  it('uses same-block transaction and log ordering to apply a newer conflicting response', () => {
    const result = mergeTestResponseDelta({
      preFetchResponses: {
        '0xsame': { choice: 'initial' },
      },
      freshResponses: {
        '0xsame': { choice: 'older', blockNumber: 10, transactionIndex: 1, logIndex: 2, timestamp: 100 },
      },
      fetchedResponses: [
        {
          responder: '0xSAME',
          response: { choice: 'newer' },
          blockNumber: 10,
          transactionIndex: 2,
          logIndex: 3,
          timestamp: 110,
        },
      ],
      freshWatermark: 6,
      safeResponseWatermark: 10,
    });

    expect(result).toEqual({
      responses: {
        '0xsame': {
          choice: 'newer',
          blockNumber: 10,
          transactionIndex: 2,
          logIndex: 3,
          timestamp: 110,
        },
      },
      watermark: 10,
    });
  });

  it('preserves an unorderable concurrent conflict and keeps its previous frontier retryable', () => {
    expect(
      mergeTestResponseDelta({
        preFetchResponses: { '0xsame': { choice: 'initial' } },
        freshResponses: { '0xsame': { choice: 'concurrent' } },
        fetchedResponses: [{ responder: '0xSAME', response: { choice: 'fetched' } }],
        freshWatermark: 6,
        safeResponseWatermark: 10,
      }),
    ).toEqual({
      responses: { '0xsame': { choice: 'concurrent' } },
      watermark: 6,
    });
  });

  it('advances after preserving a trusted response that matches an untrusted legacy payload', () => {
    const trusted = {
      choice: 'same',
      blockNumber: 12,
      transactionIndex: 1,
      logIndex: 2,
      timestamp: 120,
    };

    expect(
      mergeTestResponseDelta({
        preFetchResponses: { '0xsame': trusted },
        freshResponses: { '0xsame': trusted },
        fetchedResponses: [{ responder: '0xSAME', response: { choice: 'same' } }],
        freshWatermark: 6,
        safeResponseWatermark: 10,
      }),
    ).toEqual({
      responses: { '0xsame': trusted },
      watermark: 10,
    });
  });

  it('keeps legitimate response fields when comparing stamped and legacy payloads', () => {
    const trusted = {
      choice: 'same',
      hash: 'existing-answer-hash',
      blockNumber: 12,
      transactionIndex: 1,
      logIndex: 2,
      timestamp: 120,
    };

    expect(
      mergeTestResponseDelta({
        preFetchResponses: { '0xsame': trusted },
        freshResponses: { '0xsame': trusted },
        fetchedResponses: [{ responder: '0xSAME', response: { choice: 'same', hash: 'incoming-answer-hash' } }],
        freshWatermark: 6,
        safeResponseWatermark: 10,
      }),
    ).toEqual({
      responses: { '0xsame': trusted },
      watermark: 6,
    });
  });

  it('stamps object responses with trusted recency while preserving scalar payloads', () => {
    const objectResult = mergeTestResponseDelta({
      preFetchResponses: {},
      freshResponses: {},
      fetchedResponses: [
        {
          responder: '0xOBJECT',
          response: { choice: 'object' },
          blockNumber: 12,
          transactionIndex: 1,
          logIndex: 4,
          timestamp: 120,
        },
      ],
      freshWatermark: 6,
      safeResponseWatermark: 12,
    });
    const scalarResult = mergeTestResponseDelta({
      preFetchResponses: {},
      freshResponses: {},
      fetchedResponses: [
        {
          responder: '0xSCALAR',
          response: 'encrypted-payload',
          blockNumber: 12,
          transactionIndex: 1,
          logIndex: 4,
          timestamp: 120,
        },
      ],
      freshWatermark: 6,
      safeResponseWatermark: 12,
    });

    expect(objectResult.responses['0xobject']).toMatchObject({
      choice: 'object',
      blockNumber: 12,
      transactionIndex: 1,
      logIndex: 4,
      timestamp: 120,
    });
    expect(scalarResult.responses['0xscalar']).toBe('encrypted-payload');
  });
});
