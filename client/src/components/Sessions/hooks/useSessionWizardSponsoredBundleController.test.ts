import { act, renderHook } from '@testing-library/react';
import useSponsoredBundleLifecycle from './useSponsoredBundleLifecycle';
import useSessionWizardSponsoredBundleController from './useSessionWizardSponsoredBundleController';
import type { WorkerSecretsLike } from '../../shellTypes';

jest.mock('./useSponsoredBundleLifecycle', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sponsoredBundleStatus: null,
    sponsoredBundleRetryNonce: 0,
    setSponsoredBundleRetryNonce: jest.fn(),
    sponsoredBundleAppliedBundleRef: { current: null },
    hasSponsoredBundleLink: false,
  })),
}));

type DraftState = {
  corsWorkerUrl?: string;
  slug?: string;
};

type DeployFormState = {
  workerName?: string;
};

type ProvisionedSponsoredContextState = {
  sessionSlug: string;
  workerUrl: string;
  fields: Record<string, unknown>;
};

const createInputRef = (value = '') => {
  const input = document.createElement('input');
  input.value = value;
  return { current: input };
};

const createControllerHarness = (overrides: Record<string, unknown> = {}) => {
  const buildProvisionedSponsoredContextState = jest.fn((value: unknown): ProvisionedSponsoredContextState => {
    const context = value && typeof value === 'object' ? (value as Partial<ProvisionedSponsoredContextState>) : {};
    return {
      sessionSlug: context.sessionSlug || '',
      workerUrl: context.workerUrl || '',
      fields: context.fields || {},
    };
  });
  const refs = {
    draftRef: { current: { slug: 'demo' } },
    deployFormRef: { current: { workerName: 'demo-worker' } },
    deployCompleteRef: { current: false },
    deployWorkerUrlRef: { current: '' },
    provisionedSponsoredContextRef: {
      current: {
        sessionSlug: '',
        workerUrl: '',
        fields: {},
      },
    },
    workerSecretsEnabledRef: { current: true },
    persistWorkerSecretsRef: { current: false },
    workerSecretsRef: {
      current: {
        openaiKey: 'old-openai',
        arweaveJwk: 'old-jwk',
      } as WorkerSecretsLike,
    },
    advancedBundleFileInputRef: createInputRef('advanced.bundle.js'),
    normalModeRetryBundleFileInputRef: createInputRef('retry.bundle.js'),
    sponsoredPublishBundleFileInputRef: createInputRef('sponsored.bundle.js'),
  };
  const setters = {
    setWorkerSecrets: jest.fn(),
    setDraft: jest.fn(),
    setDeployForm: jest.fn(),
    setDeployStatus: jest.fn(),
    setDeployInFlight: jest.fn(),
    setDeployComplete: jest.fn(),
    setWorkerMode: jest.fn(),
    setDeployWorkerUrl: jest.fn(),
    setProvisionedSponsoredContext: jest.fn(),
    setForceManualBundleFile: jest.fn(),
    setNormalModeBundleUrlOverride: jest.fn(),
    setWorkerUrlAutoFilled: jest.fn(),
    setWorkerSecretsEnabled: jest.fn(),
    setPersistWorkerSecrets: jest.fn(),
    setBundleFile: jest.fn(),
  };

  const hook = renderHook(() =>
    useSessionWizardSponsoredBundleController<DraftState, DeployFormState, ProvisionedSponsoredContextState>({
      initialSponsoredBundleId: 'bundle-id',
      initialSponsoredBundleKey: 'bundle-key',
      draftSlug: 'demo',
      refs,
      workerSecretsEnabled: true,
      ...setters,
      buildProvisionedSponsoredContextState,
      ...overrides,
    }),
  );

  return {
    ...hook,
    buildProvisionedSponsoredContextState,
    refs,
    setters,
  };
};

describe('useSessionWizardSponsoredBundleController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps sponsored lifecycle wired to stable secret and deployment ports', () => {
    const { result, refs } = createControllerHarness();

    expect(useSponsoredBundleLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSponsoredBundleId: 'bundle-id',
        initialSponsoredBundleKey: 'bundle-key',
        draftSlug: 'demo',
        refs: expect.objectContaining({
          draftRef: refs.draftRef,
          deployFormRef: refs.deployFormRef,
          workerSecretsEnabledRef: refs.workerSecretsEnabledRef,
        }),
        getCurrentWorkerSecrets: result.current.getCurrentWorkerSecrets,
        applyWorkerSecretsUpdate: result.current.applyWorkerSecretsUpdate,
        updateDeploymentState: result.current.updateSponsoredBundleDeploymentState,
      }),
    );
  });

  it('updates the live worker-secret ref and setter from updater functions', () => {
    const { result, refs, setters } = createControllerHarness();

    act(() => {
      result.current.applyWorkerSecretsUpdate((current: WorkerSecretsLike) => ({
        ...current,
        openaiKey: ' next-openai ',
        litAccountApiKey: ' account-key ',
        litApiBase: ' https://lit.example ',
      }));
    });

    expect(refs.workerSecretsRef.current.openaiKey).toBe('next-openai');
    expect(refs.workerSecretsRef.current.litAccountApiKey).toBe('account-key');
    expect(refs.workerSecretsRef.current.litApiBase).toBe('');
    expect(setters.setWorkerSecrets).toHaveBeenCalledWith(refs.workerSecretsRef.current);
  });

  it('returns blank enabled secrets when worker secrets are disabled', () => {
    const { result } = createControllerHarness({
      workerSecretsEnabled: false,
    });

    expect(result.current.getCurrentEnabledWorkerSecrets()).toEqual(
      expect.objectContaining({
        openaiKey: '',
        arweaveJwk: '',
        customRpcUrl: '',
      }),
    );
  });

  it('applies sponsored deployment state patches to the existing setters', () => {
    const { result, buildProvisionedSponsoredContextState, setters } = createControllerHarness();
    const deployForm = { workerName: 'patched-worker' };

    act(() => {
      result.current.updateSponsoredBundleDeploymentState({
        deployForm,
        deployStatus: 'Ready',
        deployInFlight: true,
        deployComplete: false,
        workerMode: 'custom',
        deployWorkerUrl: 'https://worker.example',
        provisionedSponsoredContext: {
          sessionSlug: 'demo',
          workerUrl: 'https://worker.example',
          fields: { openaiKey: 'available' },
        },
        forceManualBundleFile: true,
        normalModeBundleUrlOverride: 'https://bundle.example/worker.js',
        workerUrlAutoFilled: true,
      });
    });

    expect(setters.setDeployForm).toHaveBeenCalledWith(deployForm);
    expect(setters.setDeployStatus).toHaveBeenCalledWith('Ready');
    expect(setters.setDeployInFlight).toHaveBeenCalledWith(true);
    expect(setters.setDeployComplete).toHaveBeenCalledWith(false);
    expect(setters.setWorkerMode).toHaveBeenCalledWith('custom');
    expect(setters.setDeployWorkerUrl).toHaveBeenCalledWith('https://worker.example');
    expect(buildProvisionedSponsoredContextState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo',
      }),
    );
    expect(setters.setProvisionedSponsoredContext).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo',
      }),
    );
    expect(setters.setForceManualBundleFile).toHaveBeenCalledWith(true);
    expect(setters.setNormalModeBundleUrlOverride).toHaveBeenCalledWith('https://bundle.example/worker.js');
    expect(setters.setWorkerUrlAutoFilled).toHaveBeenCalledWith(true);
  });

  it('patches draft CORS worker URL only when the value changes', () => {
    const { result, setters } = createControllerHarness();

    act(() => {
      result.current.updateSponsoredBundleDraftCorsWorkerUrl(' https://worker.example ');
    });

    const updater = setters.setDraft.mock.calls[0][0];
    expect(updater({ corsWorkerUrl: 'https://old.example', slug: 'demo' })).toEqual({
      corsWorkerUrl: 'https://worker.example',
      slug: 'demo',
    });
    expect(updater({ corsWorkerUrl: 'https://worker.example', slug: 'demo' })).toEqual({
      corsWorkerUrl: 'https://worker.example',
      slug: 'demo',
    });
  });

  it('clears selected bundle files across all upload inputs', () => {
    const { result, refs, setters } = createControllerHarness();

    act(() => {
      result.current.clearSelectedBundleFile();
    });

    expect(setters.setBundleFile).toHaveBeenCalledWith(null);
    expect(refs.advancedBundleFileInputRef.current.value).toBe('');
    expect(refs.normalModeRetryBundleFileInputRef.current.value).toBe('');
    expect(refs.sponsoredPublishBundleFileInputRef.current.value).toBe('');
  });
});
