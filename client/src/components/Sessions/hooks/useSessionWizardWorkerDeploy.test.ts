import { act, renderHook } from '@testing-library/react';
import { cryptoUtils } from '../../../utilities/crypto/cryptography.js';
import { INVALID_SESSION_SLUG_FORMAT_ERROR } from '../sessionWizardSlugValidation';
import useSessionWizardWorkerDeploy, { type SessionWizardWorkerDeployRuntime } from './useSessionWizardWorkerDeploy';

jest.mock('../../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => null),
  },
}));

const buildHookOptions = () => ({
  refs: {
    runtimeRef: {
      current: {
        draft: {},
        deployForm: {},
      } as SessionWizardWorkerDeployRuntime,
    },
    resolvedWalletAccountRef: {
      current: '',
    },
    sponsoredBundleAppliedBundleRef: {
      current: null,
    },
  },
  getCurrentWorkerSecrets: jest.fn(() => ({})),
  getMissingWorkerSecretsForDeploy: jest.fn(() => []),
  resolveWorkerRpcUrl: jest.fn(() => ''),
  resolveWorkerRpcUrlMap: jest.fn(() => ({})),
  resolveWorkerFaucetConfig: jest.fn(() => ({})),
  parseAllowOriginsInput: jest.fn(() => []),
  signTypedAdminAction: jest.fn(async () => ({})),
  setDeployForm: jest.fn(),
  updateDraftValue: jest.fn(),
  updateDeploymentState: jest.fn(),
  clearSelectedBundleFile: jest.fn(),
  clearCachedWorkerSecretsAfterDeploy: jest.fn(),
});

const buildDeployHookOptions = () => {
  const options = buildHookOptions();
  options.refs.runtimeRef.current = {
    ...options.refs.runtimeRef.current,
    account: '0x00000000000000000000000000000000000000aa',
    draft: {
      slug: 'deploy-storage-session',
      networkChainId: 11155420,
      rpc: {
        providers: {
          path: { rpcUrl: 'https://rpc.example.test' },
        },
      },
    },
    deployForm: {
      apiToken: 'cf-token',
      accountId: 'cf-account',
      workerName: 'deploy-storage-worker',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
    },
    deployHelperUrl: 'https://deploy-helper.example.test',
    loginComplete: true,
    registryAddress: '0x00000000000000000000000000000000000000bb',
    registryChainId: 11155420,
    wizardMode: 'advanced',
    bundleMode: 'url',
    workerSecretsEnabled: false,
    embeddedDeployHelperEnabled: true,
    network: { id: 11155420 },
  } as SessionWizardWorkerDeployRuntime;
  options.resolveWorkerRpcUrl.mockReturnValue('https://rpc.example.test');
  options.resolveWorkerRpcUrlMap.mockReturnValue({ '11155420': ['https://rpc.example.test'] });
  options.resolveWorkerFaucetConfig.mockReturnValue({ rpcUrl: 'https://rpc.example.test' });
  options.signTypedAdminAction.mockResolvedValue({ address: '0x00000000000000000000000000000000000000aa' });
  return options;
};

const mockSuccessfulWorkerDeployFetch = () => {
  const fetchMock = jest.fn(async (url: RequestInfo | URL) => {
    const normalizedUrl = String(url);
    if (normalizedUrl.endsWith('/deploy')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          workerUrl: 'https://deployed.example.test',
          writesSessionConfig: true,
          writesSessionSecrets: false,
        }),
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response;
  });
  global.fetch = fetchMock;
  return fetchMock;
};

describe('useSessionWizardWorkerDeploy', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('returns handleDeployWorker function', () => {
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(buildHookOptions()));

    expect(typeof result.current.handleDeployWorker).toBe('function');
  });

  it('returns resolveConnectedAdminAddress function', () => {
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(buildHookOptions()));

    expect(typeof result.current.resolveConnectedAdminAddress).toBe('function');
  });

  it('returns a cached account without querying the provider', async () => {
    const options = buildHookOptions();
    options.refs.runtimeRef.current.account = '0x00000000000000000000000000000000000000aa';
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let resolvedAddress = '';

    await act(async () => {
      resolvedAddress = await result.current.resolveConnectedAdminAddress();
    });

    expect(resolvedAddress).toBe('0x00000000000000000000000000000000000000aa');
    expect(cryptoUtils._getProvider).not.toHaveBeenCalled();
    expect(options.setDeployForm).not.toHaveBeenCalled();
  });

  it('uses setDeployForm to write a resolved admin address without clobbering concurrent edits', async () => {
    const resolvedAddress = '0x00000000000000000000000000000000000000bb';
    const providerRequest = jest.fn(async () => [resolvedAddress]);
    (cryptoUtils._getProvider as jest.Mock).mockReturnValue({
      request: providerRequest,
    });
    const options = buildHookOptions();
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let nextAddress = '';

    await act(async () => {
      nextAddress = await result.current.resolveConnectedAdminAddress();
    });

    expect(nextAddress).toBe(resolvedAddress);
    expect(providerRequest).toHaveBeenCalledWith({ method: 'eth_accounts' });
    expect(options.refs.resolvedWalletAccountRef.current).toBe(resolvedAddress);
    expect(options.setDeployForm).toHaveBeenCalledTimes(1);
    const updater = options.setDeployForm.mock.calls[0][0];
    expect(typeof updater).toBe('function');
    expect(
      updater({
        workerName: 'custom-worker',
        adminAddress: '',
      }),
    ).toEqual({
      workerName: 'custom-worker',
      adminAddress: resolvedAddress,
    });
    const existingState = {
      workerName: 'custom-worker',
      adminAddress: '0x00000000000000000000000000000000000000cc',
    };
    expect(updater(existingState)).toBe(existingState);
  });

  it('validates the slug before starting worker deployment', async () => {
    const options = buildHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        slug: 'Bad Slug!',
      },
      loginComplete: true,
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let deployResult;

    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual({
      ok: false,
      error: INVALID_SESSION_SLUG_FORMAT_ERROR,
    });
    expect(options.updateDeploymentState).toHaveBeenCalledWith({
      deployStatus: INVALID_SESSION_SLUG_FORMAT_ERROR,
    });
    expect(options.updateDeploymentState).not.toHaveBeenCalledWith(
      expect.objectContaining({
        deployStatus: 'Deploying worker…',
      }),
    );
    expect(options.signTypedAdminAction).not.toHaveBeenCalled();
    expect(cryptoUtils._getProvider).not.toHaveBeenCalled();
  });

  it('skips a concurrent worker deploy while the first deploy is still resolving', async () => {
    let resolveAccounts: ((accounts: string[]) => void) | undefined;
    const providerRequest = jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          resolveAccounts = resolve;
        }),
    );
    (cryptoUtils._getProvider as jest.Mock).mockReturnValue({
      request: providerRequest,
    });
    const options = buildHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        slug: 'launch-week',
      },
      deployForm: {},
      loginComplete: true,
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let firstDeploy: Promise<unknown> | undefined;
    let secondDeployResult;

    await act(async () => {
      firstDeploy = result.current.handleDeployWorker();
      await Promise.resolve();
    });
    await act(async () => {
      secondDeployResult = await result.current.handleDeployWorker();
    });

    expect(secondDeployResult).toEqual({
      ok: false,
      skipped: true,
      error: 'Worker deploy already in progress.',
    });
    expect(providerRequest).toHaveBeenCalledTimes(1);
    expect(options.updateDeploymentState).toHaveBeenCalledWith({
      deployStatus: 'Worker deploy already in progress.',
    });

    await act(async () => {
      resolveAccounts?.([]);
      await firstDeploy;
    });

    expect(options.updateDeploymentState).toHaveBeenCalledWith({
      deployInFlight: false,
    });
  });

  it('includes the normalized Cloudflare storage profile in deploy-helper payloads', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current.draft = {
      ...options.refs.runtimeRef.current.draft,
      storageProfile: {
        backend: 'cloudflare',
        resources: { questions: 'active', responses: 'active' },
        payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope' },
        cloudflare: {
          useR2: true,
          r2BucketName: 'ce-session-payloads',
        },
      },
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    expect(deployCall).toBeTruthy();
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload.storageProfile).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        sessionOwned: true,
        telegramOwned: false,
        payloadAccessControl: expect.objectContaining({
          gate: 'sbt_gate',
          encryption: 'worker_envelope',
          mode: 'worker_sbt_gate',
        }),
        cloudflare: expect.objectContaining({
          payloadAccessMode: 'worker_sbt_gate',
          r2BucketName: 'ce-session-payloads',
        }),
      }),
    );
    expect(deployPayload.storageProfile.resources.questions).toBe('active');
    expect(deployPayload.storageProfile.resources.responses).toBe('active');
  });

  it('keeps non-Cloudflare deploy-helper payloads on the legacy shape', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current.draft = {
      ...options.refs.runtimeRef.current.draft,
      storageProfile: {
        backend: 'arweave',
      },
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    expect(deployCall).toBeTruthy();
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload.storageProfile).toBeUndefined();
  });
});
