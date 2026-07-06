import type {
  SessionPublishAction,
  SessionPublishEffect,
  SessionPublishEffectSucceededAction,
  SessionPublishPlan,
} from './sessionPublishReducer';

export type SessionPublishExecutionPlanInput = {
  shouldAutoDeployWorker?: boolean;
  shouldDeployPendingSbts?: boolean;
  shouldUploadMetadata?: boolean;
};

export type SessionPublishDispatch = (action: SessionPublishAction) => void;

export type SessionPublishErrorMessageReader = (error: unknown) => string;

export type SessionPublishEffectRunnerArgs<Result> = {
  dispatch: SessionPublishDispatch;
  effect: SessionPublishEffect;
  getErrorMessage: SessionPublishErrorMessageReader;
  run: () => Promise<Result>;
  result?: (value: Result) => SessionPublishEffectSucceededAction['result'];
  recoverable?: boolean;
};

export const buildSessionPublishReducerPlan = (
  publishExecutionPlan: SessionPublishExecutionPlanInput
): SessionPublishPlan => ({
  autoDeployWorker: !!publishExecutionPlan.shouldAutoDeployWorker,
  deployPendingSbts: !!publishExecutionPlan.shouldDeployPendingSbts,
  uploadMetadata: !!publishExecutionPlan.shouldUploadMetadata,
  refreshRegistryCache: true,
});

export const markSessionPublishEffectSucceeded = (
  dispatch: SessionPublishDispatch,
  effect: SessionPublishEffect,
  result?: SessionPublishEffectSucceededAction['result']
): void => {
  dispatch({
    type: 'effectSucceeded',
    effect,
    ...(result ? { result } : {}),
  });
};

export const markSessionPublishEffectFailed = (
  dispatch: SessionPublishDispatch,
  effect: SessionPublishEffect,
  message: string,
  recoverable = true
): void => {
  dispatch({
    type: 'effectFailed',
    effect,
    message,
    recoverable,
  });
};

export const beginSessionPublishReducerAttempt = (
  dispatch: SessionPublishDispatch,
  publishExecutionPlan: SessionPublishExecutionPlanInput
): void => {
  dispatch({
    type: 'beginPublish',
    plan: buildSessionPublishReducerPlan(publishExecutionPlan),
  });
  markSessionPublishEffectSucceeded(dispatch, 'checkRequirements');
};

export const runSessionPublishEffect = async <Result>({
  dispatch,
  effect,
  getErrorMessage,
  recoverable = true,
  result,
  run,
}: SessionPublishEffectRunnerArgs<Result>): Promise<Result> => {
  try {
    const value = await run();
    markSessionPublishEffectSucceeded(dispatch, effect, result?.(value));
    return value;
  } catch (err) {
    dispatch({
      type: 'effectFailed',
      effect,
      message: getErrorMessage(err),
      recoverable,
    });
    throw err;
  }
};
