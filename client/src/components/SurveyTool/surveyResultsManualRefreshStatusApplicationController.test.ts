import {
  runSurveyResultsManualRefreshStatusApplicationController,
} from './surveyResultsManualRefreshStatusApplicationController';

describe('surveyResultsManualRefreshStatusApplicationController', () => {
  it('applies manual refresh target blocks before dispatching follow-up effects', async () => {
    const calls: string[] = [];
    const result = await runSurveyResultsManualRefreshStatusApplicationController({
      ports: {
        applyRefreshState: async (statePatch, afterApply) => {
          calls.push(`apply:${Object.keys(statePatch).join('|')}`);
          await afterApply();
        },
        dispatchManualRefresh: async () => {
          calls.push('dispatch');
        },
        pollLocalStorageForUpdates: () => {
          calls.push('poll');
        },
        queueResultsRefresh: (reason) => {
          calls.push(`queue:${reason}`);
        },
        readLatestBlock: async () => 321,
        resetLocalStoragePollingBackoff: (reason) => {
          calls.push(`reset:${reason}`);
        },
      },
    });

    expect(result).toEqual({
      latestBlock: 321,
      orderedEffects: [
        'state-patch',
        'manualRefreshDispatch',
        'resetLocalStoragePollingBackoff:manual-refresh',
        'pollLocalStorageForUpdates',
        'queueResultsRefresh:manual-refresh',
      ],
      statePatch: {
        refreshTargetQuestionBlock: 321,
        refreshTargetResponseBlock: 321,
        refreshTargetSurveyBlock: 321,
      },
      status: 'applied',
    });
    expect(calls).toEqual([
      'apply:refreshTargetQuestionBlock|refreshTargetResponseBlock|refreshTargetSurveyBlock',
      'dispatch',
      'reset:manual-refresh',
      'poll',
      'queue:manual-refresh',
    ]);
  });

  it('skips state application and follow-ups when the sequence is blocked', async () => {
    const applyRefreshState = jest.fn();
    const dispatchManualRefresh = jest.fn();

    await expect(runSurveyResultsManualRefreshStatusApplicationController({
      isMounted: false,
      ports: {
        applyRefreshState,
        dispatchManualRefresh,
        pollLocalStorageForUpdates: jest.fn(),
        queueResultsRefresh: jest.fn(),
        readLatestBlock: () => 654,
        resetLocalStoragePollingBackoff: jest.fn(),
      },
    })).resolves.toEqual({
      blockedReason: 'unmounted',
      latestBlock: 654,
      orderedEffects: [],
      status: 'skipped',
    });
    expect(applyRefreshState).not.toHaveBeenCalled();
    expect(dispatchManualRefresh).not.toHaveBeenCalled();
  });

  it('propagates latest-block failures without running state or follow-up ports', async () => {
    const error = new Error('latest block failed');
    const applyRefreshState = jest.fn();
    const dispatchManualRefresh = jest.fn();

    await expect(runSurveyResultsManualRefreshStatusApplicationController({
      ports: {
        applyRefreshState,
        dispatchManualRefresh,
        pollLocalStorageForUpdates: jest.fn(),
        queueResultsRefresh: jest.fn(),
        readLatestBlock: async () => {
          throw error;
        },
        resetLocalStoragePollingBackoff: jest.fn(),
      },
    })).rejects.toThrow(error);
    expect(applyRefreshState).not.toHaveBeenCalled();
    expect(dispatchManualRefresh).not.toHaveBeenCalled();
  });
});
