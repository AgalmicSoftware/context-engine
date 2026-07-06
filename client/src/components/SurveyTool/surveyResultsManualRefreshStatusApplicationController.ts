import {
  buildSurveyResultsRefreshStatusSequencePlan,
} from './surveyResultsHelpers.js';

type SurveyResultsStatePatch = Record<string, unknown>;

export type SurveyResultsManualRefreshStatusApplicationPorts = {
  applyRefreshState: (
    statePatch: SurveyResultsStatePatch,
    afterApply: () => Promise<void>
  ) => Promise<unknown> | unknown;
  dispatchManualRefresh: () => Promise<unknown> | unknown;
  pollLocalStorageForUpdates: () => unknown;
  queueResultsRefresh: (reason: string) => unknown;
  readLatestBlock: () => Promise<unknown> | unknown;
  resetLocalStoragePollingBackoff: (reason: string) => unknown;
};

export type SurveyResultsManualRefreshStatusApplicationArgs = {
  isMounted?: unknown;
  ports: SurveyResultsManualRefreshStatusApplicationPorts;
};

export type SurveyResultsManualRefreshStatusApplicationResult =
  | {
      latestBlock: unknown;
      orderedEffects: string[];
      statePatch: SurveyResultsStatePatch;
      status: 'applied';
    }
  | {
      blockedReason: string;
      latestBlock: unknown;
      orderedEffects: string[];
      status: 'skipped';
    };

const MANUAL_REFRESH_FOLLOW_UP_EFFECTS = [
  'manualRefreshDispatch',
  'resetLocalStoragePollingBackoff:manual-refresh',
  'pollLocalStorageForUpdates',
  'queueResultsRefresh:manual-refresh',
] as const;

const runManualRefreshFollowUps = async (
  ports: SurveyResultsManualRefreshStatusApplicationPorts
): Promise<void> => {
  await ports.dispatchManualRefresh();
  ports.resetLocalStoragePollingBackoff('manual-refresh');
  ports.pollLocalStorageForUpdates();
  ports.queueResultsRefresh('manual-refresh');
};

export const runSurveyResultsManualRefreshStatusApplicationController = async ({
  isMounted = true,
  ports,
}: SurveyResultsManualRefreshStatusApplicationArgs): Promise<SurveyResultsManualRefreshStatusApplicationResult> => {
  const latestBlock = await ports.readLatestBlock();
  const refreshStatusSequencePlan = buildSurveyResultsRefreshStatusSequencePlan({
    isMounted,
    latestBlock,
    followUpEffects: MANUAL_REFRESH_FOLLOW_UP_EFFECTS,
  });
  const orderedEffects = refreshStatusSequencePlan.orderedEffects.map((effect) => (
    effect.kind === 'state-patch' ? 'state-patch' : effect.effect
  ));

  if (!refreshStatusSequencePlan.shouldWrite || !refreshStatusSequencePlan.statePatch) {
    return {
      blockedReason: refreshStatusSequencePlan.blockedReason,
      latestBlock,
      orderedEffects,
      status: 'skipped',
    };
  }

  const statePatch = refreshStatusSequencePlan.statePatch as SurveyResultsStatePatch;
  await ports.applyRefreshState(statePatch, () => runManualRefreshFollowUps(ports));

  return {
    latestBlock,
    orderedEffects,
    statePatch,
    status: 'applied',
  };
};
