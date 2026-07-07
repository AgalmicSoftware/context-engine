import { normalizeSurveyResponseBatchResult, resolveSurveyResponseWatermark } from './sessionSurveyResponseHelpers.js';

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
});
