import {
  beginSessionPublishReducerAttempt,
  buildSessionPublishReducerPlan,
  markSessionPublishEffectFailed,
  markSessionPublishEffectSucceeded,
  runSessionPublishEffect,
  type SessionPublishDispatch,
} from './sessionPublishDispatch';
import type { SessionPublishAction } from './sessionPublishReducer';

describe('sessionPublishDispatch', () => {
  const collectActions = () => {
    const actions: SessionPublishAction[] = [];
    const dispatch: SessionPublishDispatch = (action) => {
      actions.push(action);
    };
    return { actions, dispatch };
  };

  it('builds the reducer plan from the controller execution plan', () => {
    expect(buildSessionPublishReducerPlan({
      shouldAutoDeployWorker: true,
      shouldDeployPendingSbts: true,
      shouldUploadMetadata: false,
    })).toEqual({
      autoDeployWorker: true,
      deployPendingSbts: true,
      uploadMetadata: false,
      refreshRegistryCache: true,
    });
  });

  it('dispatches begin and requirements success for a publish attempt', () => {
    const { actions, dispatch } = collectActions();

    beginSessionPublishReducerAttempt(dispatch, { shouldUploadMetadata: true });

    expect(actions).toEqual([
      {
        type: 'beginPublish',
        plan: {
          autoDeployWorker: false,
          deployPendingSbts: false,
          uploadMetadata: true,
          refreshRegistryCache: true,
        },
      },
      {
        type: 'effectSucceeded',
        effect: 'checkRequirements',
      },
    ]);
  });

  it('wraps successful effects with derived reducer results', async () => {
    const { actions, dispatch } = collectActions();

    const value = await runSessionPublishEffect({
      dispatch,
      effect: 'uploadMetadata',
      getErrorMessage: (err) => String(err),
      run: async () => ({ metadataUri: 'ar://metadata' }),
      result: (result) => ({ metadataUri: result.metadataUri }),
    });

    expect(value).toEqual({ metadataUri: 'ar://metadata' });
    expect(actions).toEqual([
      {
        type: 'effectSucceeded',
        effect: 'uploadMetadata',
        result: { metadataUri: 'ar://metadata' },
      },
    ]);
  });

  it('wraps failed effects and rethrows the original error', async () => {
    const { actions, dispatch } = collectActions();
    const error = new Error('boom');

    await expect(runSessionPublishEffect({
      dispatch,
      effect: 'deployWorker',
      getErrorMessage: (err) => err instanceof Error ? err.message : String(err),
      run: async () => {
        throw error;
      },
    })).rejects.toBe(error);

    expect(actions).toEqual([
      {
        type: 'effectFailed',
        effect: 'deployWorker',
        message: 'boom',
        recoverable: true,
      },
    ]);
  });

  it('can mark an effect success without a result payload', () => {
    const { actions, dispatch } = collectActions();

    markSessionPublishEffectSucceeded(dispatch, 'refreshRegistryCache');

    expect(actions).toEqual([
      {
        type: 'effectSucceeded',
        effect: 'refreshRegistryCache',
      },
    ]);
  });

  it('can mark an effect failure without running an effect wrapper', () => {
    const { actions, dispatch } = collectActions();

    markSessionPublishEffectFailed(dispatch, 'registerSession', 'Registration failed.');

    expect(actions).toEqual([
      {
        type: 'effectFailed',
        effect: 'registerSession',
        message: 'Registration failed.',
        recoverable: true,
      },
    ]);
  });
});
