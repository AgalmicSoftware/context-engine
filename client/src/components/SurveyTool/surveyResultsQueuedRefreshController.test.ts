import { runSurveyResultsQueuedRefreshController } from './surveyResultsQueuedRefreshController';

describe('surveyResultsQueuedRefreshController', () => {
  it('dispatches combined refresh reasons through the injected parent port in insertion order', () => {
    const queueResultsRefresh = jest.fn();

    expect(
      runSurveyResultsQueuedRefreshController({
        ports: { queueResultsRefresh },
        reasons: new Set(['modal-open', 'cache-ready', 'responses-cache-ready']),
      }),
    ).toEqual({
      dispatched: true,
      reason: 'modal-open|cache-ready|responses-cache-ready',
      reasons: ['modal-open', 'cache-ready', 'responses-cache-ready'],
    });
    expect(queueResultsRefresh).toHaveBeenCalledWith('modal-open|cache-ready|responses-cache-ready');
  });

  it('stays inert without reasons or without a dispatch port', () => {
    const queueResultsRefresh = jest.fn();

    expect(
      runSurveyResultsQueuedRefreshController({
        ports: { queueResultsRefresh },
        reasons: [],
      }),
    ).toEqual({
      dispatched: false,
      reason: '',
      reasons: [],
    });
    expect(queueResultsRefresh).not.toHaveBeenCalled();

    expect(
      runSurveyResultsQueuedRefreshController({
        reasons: ['cache-ready'],
      }),
    ).toEqual({
      dispatched: false,
      reason: 'cache-ready',
      reasons: ['cache-ready'],
    });
  });

  it('propagates dispatch port failures', () => {
    const error = new Error('queue failed');

    expect(() =>
      runSurveyResultsQueuedRefreshController({
        ports: {
          queueResultsRefresh: () => {
            throw error;
          },
        },
        reasons: ['cache-ready'],
      }),
    ).toThrow(error);
  });
});
