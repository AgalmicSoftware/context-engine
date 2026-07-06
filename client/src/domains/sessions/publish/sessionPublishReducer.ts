export type SessionPublishStatus =
  | 'idle'
  | 'editing'
  | 'checkingRequirements'
  | 'deployingWorker'
  | 'uploadingMetadata'
  | 'deployingPendingSbts'
  | 'registeringOnChain'
  | 'published'
  | 'failedRecoverable'
  | 'failedTerminal';

export type SessionPublishEffect =
  | 'checkRequirements'
  | 'deployWorker'
  | 'deployPendingSbts'
  | 'uploadMetadata'
  | 'registerSession'
  | 'refreshRegistryCache';

export type SessionPublishPlan = {
  autoDeployWorker?: boolean;
  deployPendingSbts?: boolean;
  uploadMetadata?: boolean;
  refreshRegistryCache?: boolean;
};

export type SessionPublishCompletedEffects = Partial<Record<SessionPublishEffect, boolean>>;

export type SessionPublishFailure = {
  effect: SessionPublishEffect;
  message: string;
  recoverable: boolean;
};

export type SessionPublishState = {
  status: SessionPublishStatus;
  plan: SessionPublishPlan;
  currentEffect: SessionPublishEffect | null;
  completed: SessionPublishCompletedEffects;
  attempt: number;
  workerUrl: string;
  metadataUri: string;
  deployedPendingSbtCount: number;
  error: SessionPublishFailure | null;
  cancelled: boolean;
};

export type SessionPublishBeginAction = {
  type: 'beginPublish';
  plan?: SessionPublishPlan;
};

export type SessionPublishRetryAction = {
  type: 'retry';
  plan?: SessionPublishPlan;
};

export type SessionPublishCancelAction = {
  type: 'cancel';
};

export type SessionPublishEditAction = {
  type: 'edit';
};

export type SessionPublishEffectSucceededAction = {
  type: 'effectSucceeded';
  effect: SessionPublishEffect;
  result?: {
    workerUrl?: string;
    metadataUri?: string;
    deployedPendingSbtCount?: number;
  };
};

export type SessionPublishEffectFailedAction = {
  type: 'effectFailed';
  effect: SessionPublishEffect;
  message: string;
  recoverable?: boolean;
  retryPlan?: SessionPublishPlan;
};

export type SessionPublishAction =
  | SessionPublishBeginAction
  | SessionPublishRetryAction
  | SessionPublishCancelAction
  | SessionPublishEditAction
  | SessionPublishEffectSucceededAction
  | SessionPublishEffectFailedAction;

const EFFECT_STATUSES: Record<SessionPublishEffect, SessionPublishStatus> = {
  checkRequirements: 'checkingRequirements',
  deployWorker: 'deployingWorker',
  deployPendingSbts: 'deployingPendingSbts',
  uploadMetadata: 'uploadingMetadata',
  registerSession: 'registeringOnChain',
  refreshRegistryCache: 'registeringOnChain',
};

export const createInitialSessionPublishState = (
  overrides: Partial<SessionPublishState> = {}
): SessionPublishState => ({
  status: 'idle',
  plan: {},
  currentEffect: null,
  completed: {},
  attempt: 0,
  workerUrl: '',
  metadataUri: '',
  deployedPendingSbtCount: 0,
  error: null,
  cancelled: false,
  ...overrides,
});

export const buildSessionPublishEffectQueue = (
  plan: SessionPublishPlan = {}
): SessionPublishEffect[] => {
  const queue: SessionPublishEffect[] = ['checkRequirements'];
  if (plan.autoDeployWorker) queue.push('deployWorker');
  if (plan.deployPendingSbts) queue.push('deployPendingSbts');
  if (plan.uploadMetadata) queue.push('uploadMetadata');
  queue.push('registerSession');
  if (plan.refreshRegistryCache) queue.push('refreshRegistryCache');
  return queue;
};

export const getNextSessionPublishEffect = (
  plan: SessionPublishPlan,
  completed: SessionPublishCompletedEffects = {}
): SessionPublishEffect | null => (
  buildSessionPublishEffectQueue(plan).find((effect) => !completed[effect]) || null
);

const moveToNextEffect = (
  state: SessionPublishState,
  completed: SessionPublishCompletedEffects = state.completed
): SessionPublishState => {
  const nextEffect = getNextSessionPublishEffect(state.plan, completed);
  if (!nextEffect) {
    return {
      ...state,
      status: 'published',
      currentEffect: null,
      completed,
      error: null,
    };
  }
  return {
    ...state,
    status: EFFECT_STATUSES[nextEffect],
    currentEffect: nextEffect,
    completed,
    error: null,
  };
};

const beginAttempt = (
  state: SessionPublishState,
  plan: SessionPublishPlan,
  completed: SessionPublishCompletedEffects,
  attempt: number
): SessionPublishState => moveToNextEffect({
  ...state,
  plan,
  completed,
  attempt,
  currentEffect: null,
  error: null,
  cancelled: false,
});

const resetRetryRequirementCheck = (
  completed: SessionPublishCompletedEffects
): SessionPublishCompletedEffects => {
  const next = { ...completed };
  delete next.checkRequirements;
  return next;
};

export const sessionPublishReducer = (
  state: SessionPublishState,
  action: SessionPublishAction
): SessionPublishState => {
  if (action.type === 'edit') {
    return createInitialSessionPublishState({ status: 'editing' });
  }

  if (action.type === 'cancel') {
    return {
      ...state,
      status: 'editing',
      currentEffect: null,
      error: null,
      cancelled: true,
    };
  }

  if (action.type === 'beginPublish') {
    return beginAttempt(
      createInitialSessionPublishState({ status: 'editing' }),
      action.plan || {},
      {},
      1
    );
  }

  if (action.type === 'retry') {
    return beginAttempt(
      state,
      action.plan || state.plan,
      resetRetryRequirementCheck(state.completed),
      state.attempt + 1
    );
  }

  if (action.type === 'effectFailed') {
    return {
      ...state,
      plan: action.retryPlan || state.plan,
      status: action.recoverable === false ? 'failedTerminal' : 'failedRecoverable',
      currentEffect: null,
      error: {
        effect: action.effect,
        message: action.message,
        recoverable: action.recoverable !== false,
      },
    };
  }

  if (action.type === 'effectSucceeded') {
    if (!state.currentEffect || action.effect !== state.currentEffect || state.cancelled) {
      return state;
    }
    const completed = {
      ...state.completed,
      [action.effect]: true,
    };
    return moveToNextEffect({
      ...state,
      workerUrl: action.result?.workerUrl || state.workerUrl,
      metadataUri: action.result?.metadataUri || state.metadataUri,
      deployedPendingSbtCount: Number.isFinite(action.result?.deployedPendingSbtCount)
        ? Number(action.result?.deployedPendingSbtCount)
        : state.deployedPendingSbtCount,
    }, completed);
  }

  return state;
};
