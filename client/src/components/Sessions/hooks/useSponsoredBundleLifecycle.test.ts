import { act, renderHook, waitFor } from '@testing-library/react';
import useSponsoredBundleLifecycle from './useSponsoredBundleLifecycle.js';
import {
  isSponsoredBundleExpired,
  normalizeSparseSponsoredBundlePayload,
  readSponsoredBundleFromArweave,
} from '../../../utilities/arweave/sponsoredBundles.js';
import {
  clearSponsoredBootstrapFundingContext,
  normalizeSponsoredBootstrapFundingContext,
} from '../../../utilities/session/sponsoredBootstrapFunding.js';
import { normalizeBaseUrl } from '../../../utilities/urlUtils.js';
import { buildEmptyProvisionedSponsoredContext } from '../sessionWizardGateUtils';
import { readSessionWizardSponsoredBundleCache } from '../sessionWizardSponsoredBundleCache';
import { buildSponsoredBundleAppliedStatusMessage } from '../sessionWizardSponsoredBundleSupport';
import {
  mergeSponsoredBundleDeployForm,
  mergeSponsoredBundleWorkerSecrets,
  normalizeWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
} from '../sessionWizardWorkerSecretSupport';

jest.mock('../../../utilities/arweave/sponsoredBundles.js', () => ({
  isSponsoredBundleExpired: jest.fn(() => false),
  normalizeSparseSponsoredBundlePayload: jest.fn((value) => value),
  readSponsoredBundleFromArweave: jest.fn(),
  SPONSORED_BUNDLE_SUPPORTED_FIELDS: [],
}));

jest.mock('../../../utilities/session/sponsoredBootstrapFunding.js', () => ({
  clearSponsoredBootstrapFundingContext: jest.fn(),
  normalizeSponsoredBootstrapFundingContext: jest.fn((value) => value),
  writeSponsoredBootstrapFundingContext: jest.fn(),
}));

jest.mock('../../../utilities/urlUtils.js', () => ({
  normalizeBaseUrl: jest.fn((value) => (value ? `normalized:${value}` : '')),
}));

jest.mock('../sessionWizardRouteState', () => ({
  scrubSponsoredBundleHashSecret: jest.fn(),
}));

jest.mock('../sessionWizardGateUtils', () => ({
  buildEmptyProvisionedSponsoredContext: jest.fn(() => ({
    sessionSlug: '',
    workerUrl: '',
    fields: {},
  })),
}));

jest.mock('../sessionWizardSponsoredBundleCache', () => ({
  readSessionWizardSponsoredBundleCache: jest.fn(),
  writeSessionWizardSponsoredBundleCache: jest.fn(),
}));

jest.mock('../sessionWizardSponsoredBundleSupport', () => ({
  buildSponsoredBundleAppliedStatusMessage: jest.fn(() => 'Applied sponsored bundle.'),
}));

jest.mock('../sessionWizardWorkerSecretSupport', () => ({
  mergeSponsoredBundleDeployForm: jest.fn((currentValue, bundle) => ({
    ...currentValue,
    sponsoredBundleApplied: bundle?.id || '',
  })),
  mergeSponsoredBundleWorkerSecrets: jest.fn((currentValue, bundle) => ({
    ...currentValue,
    sponsoredBundleApplied: bundle?.id || '',
  })),
  normalizeWorkerSecrets: jest.fn((value = {}) => ({ ...value })),
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode: jest.fn((value = {}) => value || {}),
}));

const mockIsSponsoredBundleExpired = isSponsoredBundleExpired as jest.Mock;
const mockNormalizeSparseSponsoredBundlePayload = normalizeSparseSponsoredBundlePayload as jest.Mock;
const mockReadSponsoredBundleFromArweave = readSponsoredBundleFromArweave as jest.Mock;
const mockClearSponsoredBootstrapFundingContext = clearSponsoredBootstrapFundingContext as jest.Mock;
const mockNormalizeSponsoredBootstrapFundingContext = normalizeSponsoredBootstrapFundingContext as jest.Mock;
const mockNormalizeBaseUrl = normalizeBaseUrl as jest.Mock;
const mockBuildEmptyProvisionedSponsoredContext = buildEmptyProvisionedSponsoredContext as jest.Mock;
const mockReadSessionWizardSponsoredBundleCache = readSessionWizardSponsoredBundleCache as jest.Mock;
const mockBuildSponsoredBundleAppliedStatusMessage = buildSponsoredBundleAppliedStatusMessage as jest.Mock;
const mockMergeSponsoredBundleDeployForm = mergeSponsoredBundleDeployForm as jest.Mock;
const mockMergeSponsoredBundleWorkerSecrets = mergeSponsoredBundleWorkerSecrets as jest.Mock;
const mockNormalizeWorkerSecrets = normalizeWorkerSecrets as jest.Mock;
const mockSanitizeSessionWizardSponsoredFieldSnapshotForLitMode =
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode as jest.Mock;

const buildEmptyContext = () => ({
  sessionSlug: '',
  workerUrl: '',
  fields: {},
});

const createRefs = () => ({
  draftRef: {
    current: {
      slug: 'target-session',
      corsWorkerUrl: 'https://cors.before/',
    },
  },
  deployFormRef: {
    current: {
      apiToken: 'baseline-token',
      existingSetting: true,
    },
  },
  deployCompleteRef: {
    current: true,
  },
  deployWorkerUrlRef: {
    current: 'https://worker.before/',
  },
  provisionedSponsoredContextRef: {
    current: {
      sessionSlug: 'baseline-session',
      workerUrl: 'https://provisioned.before/',
      fields: {
        sponsorField: 'baseline',
      },
    },
  },
  workerSecretsEnabledRef: {
    current: false,
  },
  persistWorkerSecretsRef: {
    current: true,
  },
});

const buildSponsoredBundle = () => ({
  id: 'bundle-123',
  bootstrapWorkerUrl: 'https://bootstrap.example/',
  faucetGrantToken: 'grant-token',
  meta: {
    sourceSessionSlug: 'source-session',
    sourceWorkerUrl: 'https://source-worker.example/',
  },
});

const renderAppliedBundleLifecycle = async () => {
  const refs = createRefs();
  const sponsoredBundle = buildSponsoredBundle();
  let currentWorkerSecrets = {
    customValue: 'baseline-worker-secret',
  };
  const applyWorkerSecretsUpdate = jest.fn((nextValueOrUpdater) => {
    currentWorkerSecrets =
      typeof nextValueOrUpdater === 'function' ? nextValueOrUpdater(currentWorkerSecrets) : nextValueOrUpdater;
  });
  const getCurrentWorkerSecrets = jest.fn(() => currentWorkerSecrets);
  const onUpdateDeploymentState = jest.fn((nextState = {}) => {
    if (Object.prototype.hasOwnProperty.call(nextState, 'deployForm')) {
      refs.deployFormRef.current = nextState.deployForm;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'deployComplete')) {
      refs.deployCompleteRef.current = !!nextState.deployComplete;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'deployWorkerUrl')) {
      refs.deployWorkerUrlRef.current = nextState.deployWorkerUrl || '';
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'provisionedSponsoredContext')) {
      refs.provisionedSponsoredContextRef.current = nextState.provisionedSponsoredContext;
    }
  });
  const updateDraftCorsWorkerUrl = jest.fn((nextCorsWorkerUrl) => {
    refs.draftRef.current = {
      ...refs.draftRef.current,
      corsWorkerUrl: nextCorsWorkerUrl,
    };
  });
  const updateWorkerSecretState = jest.fn((nextState = {}) => {
    if (Object.prototype.hasOwnProperty.call(nextState, 'workerSecretsEnabled')) {
      refs.workerSecretsEnabledRef.current = !!nextState.workerSecretsEnabled;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, 'persistWorkerSecrets')) {
      refs.persistWorkerSecretsRef.current = !!nextState.persistWorkerSecrets;
    }
  });

  mockReadSessionWizardSponsoredBundleCache.mockResolvedValue(sponsoredBundle);

  const hook = renderHook(() =>
    useSponsoredBundleLifecycle({
      initialSponsoredBundleId: sponsoredBundle.id,
      draftSlug: refs.draftRef.current.slug,
      refs,
      getCurrentWorkerSecrets,
      applyWorkerSecretsUpdate,
      updateDraftCorsWorkerUrl,
      updateDeploymentState: onUpdateDeploymentState,
      updateWorkerSecretState,
    }),
  );

  await waitFor(() => {
    expect(hook.result.current.sponsoredBundleAppliedBundleRef.current).toEqual(sponsoredBundle);
  });

  return {
    ...hook,
    refs,
    sponsoredBundle,
    applyWorkerSecretsUpdate,
    getCurrentWorkerSecrets,
    onUpdateDeploymentState,
    updateDraftCorsWorkerUrl,
    updateWorkerSecretState,
  };
};

describe('useSponsoredBundleLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSponsoredBundleExpired.mockReturnValue(false);
    mockNormalizeSparseSponsoredBundlePayload.mockImplementation((value) => value);
    mockNormalizeSponsoredBootstrapFundingContext.mockImplementation((value) => value);
    mockNormalizeBaseUrl.mockImplementation((value) => (value ? `normalized:${value}` : ''));
    mockBuildEmptyProvisionedSponsoredContext.mockImplementation(buildEmptyContext);
    mockReadSessionWizardSponsoredBundleCache.mockResolvedValue(null);
    mockBuildSponsoredBundleAppliedStatusMessage.mockReturnValue('Applied sponsored bundle.');
    mockMergeSponsoredBundleDeployForm.mockImplementation((currentValue, bundle) => ({
      ...currentValue,
      sponsoredBundleApplied: bundle?.id || '',
    }));
    mockMergeSponsoredBundleWorkerSecrets.mockImplementation((currentValue, bundle) => ({
      ...currentValue,
      sponsoredBundleApplied: bundle?.id || '',
    }));
    mockNormalizeWorkerSecrets.mockImplementation((value = {}) => ({ ...value }));
    mockSanitizeSessionWizardSponsoredFieldSnapshotForLitMode.mockImplementation((value = {}) => value || {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with null status when no bundle link is provided', () => {
    const { result } = renderHook(() => useSponsoredBundleLifecycle());

    expect(result.current.sponsoredBundleStatus).toBeNull();
    expect(mockReadSessionWizardSponsoredBundleCache).not.toHaveBeenCalled();
  });

  it('hasSponsoredBundleLink is false when no IDs are provided', () => {
    const { result } = renderHook(() => useSponsoredBundleLifecycle());

    expect(result.current.hasSponsoredBundleLink).toBe(false);
  });

  it('hasSponsoredBundleLink is true when initialSponsoredBundleId is provided', () => {
    mockReadSessionWizardSponsoredBundleCache.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useSponsoredBundleLifecycle({
        initialSponsoredBundleId: 'bundle-123',
      }),
    );

    expect(result.current.hasSponsoredBundleLink).toBe(true);
  });

  it('clearSponsoredBundleTracking resets internal refs', async () => {
    const { result, onUpdateDeploymentState } = await renderAppliedBundleLifecycle();

    onUpdateDeploymentState.mockClear();

    act(() => {
      result.current.clearSponsoredBundleTracking();
    });

    expect(result.current.sponsoredBundleAppliedBundleRef.current).toBeNull();
    expect(mockClearSponsoredBootstrapFundingContext).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.restoreSponsoredBundleOverrides();
    });

    expect(onUpdateDeploymentState).not.toHaveBeenCalled();
  });

  it('restoreSponsoredBundleOverrides calls onUpdateDeploymentState', async () => {
    const { result, onUpdateDeploymentState } = await renderAppliedBundleLifecycle();

    onUpdateDeploymentState.mockClear();

    act(() => {
      result.current.restoreSponsoredBundleOverrides();
    });

    expect(onUpdateDeploymentState).toHaveBeenCalledTimes(1);
    expect(onUpdateDeploymentState).toHaveBeenCalledWith({
      deployForm: {
        apiToken: 'baseline-token',
        existingSetting: true,
        sponsoredBundleApplied: 'bundle-123',
      },
      deployComplete: true,
      deployWorkerUrl: 'normalized:https://worker.before/',
      provisionedSponsoredContext: {
        sessionSlug: 'baseline-session',
        workerUrl: 'https://provisioned.before/',
        fields: {
          sponsorField: 'baseline',
        },
      },
    });
    expect(mockNormalizeBaseUrl).toHaveBeenCalledWith('https://worker.before/');
  });

  it('setSponsoredBundleRetryNonce is returned and callable', () => {
    const { result } = renderHook(() => useSponsoredBundleLifecycle());

    expect(typeof result.current.setSponsoredBundleRetryNonce).toBe('function');

    act(() => {
      result.current.setSponsoredBundleRetryNonce((currentValue) => currentValue + 1);
    });

    expect(result.current.sponsoredBundleRetryNonce).toBe(1);
  });

  it('handles non-object sponsored bundle load failures without crashing and keeps the status retryable', async () => {
    mockReadSponsoredBundleFromArweave.mockRejectedValueOnce('bundle gateway timeout');

    const { result } = renderHook(() =>
      useSponsoredBundleLifecycle({
        initialSponsoredBundleId: 'bundle-123',
        initialSponsoredBundleKey: 'bundle-secret',
      }),
    );

    await waitFor(() => {
      expect(result.current.sponsoredBundleStatus).toEqual({
        tone: 'error',
        message: 'Failed to load sponsored bundle.',
        retryable: true,
      });
    });
  });
});
