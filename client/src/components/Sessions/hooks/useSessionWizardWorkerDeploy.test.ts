import { act, renderHook, waitFor } from '@testing-library/react';
import { cryptoUtils } from '../../../utilities/crypto/cryptography.js';
import { INVALID_SESSION_SLUG_FORMAT_ERROR } from '../sessionWizardSlugValidation';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import useSessionWizardWorkerDeploy, { type SessionWizardWorkerDeployRuntime } from './useSessionWizardWorkerDeploy';
import type { WorkerSecretsLike } from '../../shellTypes';

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
  applyWorkerSecretsUpdate: jest.fn(),
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
  verifyPublicWorkerDeployment: jest.fn(async ({ workerUrl }: { workerUrl: unknown }) => ({
    workerOrigin: String(workerUrl),
    configRevision: 'test-verification',
    publicConfig: {},
  })),
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
    sessionId: '00000000-0000-0000-0000-000000000001',
    sessionIdHex: '0x00000000000000000000000000000001',
  } as SessionWizardWorkerDeployRuntime;
  options.resolveWorkerRpcUrl.mockReturnValue('https://rpc.example.test');
  options.resolveWorkerRpcUrlMap.mockReturnValue({ '11155420': ['https://rpc.example.test'] });
  options.resolveWorkerFaucetConfig.mockReturnValue({ rpcUrl: 'https://rpc.example.test' });
  options.signTypedAdminAction.mockResolvedValue({ address: '0x00000000000000000000000000000000000000aa' });
  return options;
};

const buildWorkerCanonicalLitProfile = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.encryption = { mode: 'lit' };
  profile.evm.registryChainId = 11155420;
  profile.storage.payloadAccessControl = {
    ...profile.storage.payloadAccessControl!,
    encryption: 'lit',
  };
  return profile;
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
          configVerified: true,
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
    localStorage.clear();
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

  it('initializes and verifies a native worker before marking it publish-ready', async () => {
    const options = buildDeployHookOptions();
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      account: '0x00000000000000000000000000000000000000aa',
      loginComplete: true,
      workerMode: 'custom',
      workerSecretsEnabled: true,
      sessionId: '00000000-0000-0000-0000-000000000001',
      sessionIdHex: '0x00000000000000000000000000000001',
      draft: {
        slug: 'native-session',
        sessionName: 'Native Session',
        sessionModeProfile,
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-5' },
            thinking: { provider: 'openai', model: 'gpt-5' },
            transcription: { provider: 'openai', model: 'whisper-1' },
          },
        },
      },
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({ openaiKey: 'native-ai-secret' });
    (options.parseAllowOriginsInput as jest.Mock).mockReturnValue(['https://contextengine.sh']);
    options.signTypedAdminAction.mockResolvedValue({
      address: '0x00000000000000000000000000000000000000aa',
      signature: '0xsigned',
    });
    let persistedConfig: Record<string, unknown> | null = null;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/admin/set-config')) {
        const body = JSON.parse(String(init?.body || '{}'));
        persistedConfig = body.config;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/admin/set-secrets')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/session-config')) {
        return new Response(
          JSON.stringify({
            ok: true,
            sessionSlug: 'native-session',
            config: persistedConfig,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      throw new Error(`Unexpected native verification request: ${url}`);
    });
    global.fetch = fetchMock;
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let bootstrap;

    await act(async () => {
      bootstrap = await result.current.verifyNativeWorker({
        sessionSlug: 'native-session',
        workerQueryValue: 'https://native-session.example.test',
      });
    });

    expect(bootstrap).toEqual(
      expect.objectContaining({
        sessionSlug: 'native-session',
        sessionId: '0x00000000000000000000000000000001',
        workerOrigin: 'https://native-session.example.test',
      }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/deploy'))).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/session-config'))).toHaveLength(2);
    const secretsCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
    expect(JSON.parse(String(secretsCall?.[1]?.body || '{}')).secrets).toEqual({
      openaiKey: 'native-ai-secret',
    });
    expect(options.updateDeploymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        deployComplete: true,
        deployWorkerUrl: 'https://native-session.example.test',
        workerRequirementProof: expect.objectContaining({ version: 1 }),
      }),
    );
    expect(options.updateDraftValue).toHaveBeenCalledWith(['corsWorkerUrl'], 'https://native-session.example.test');
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('cf-token');
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

  it('deploys the default worker-canonical profile without registry, RPC, faucet, or Arweave secrets', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      registryAddress: '',
      registryChainId: 0,
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      draft: {
        slug: 'two-key-session',
        sessionName: 'Two Key Session',
        sessionInfo: 'Worker-canonical session.',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      arweaveJwk: 'must-not-send',
      faucetPrivateKey: 'must-not-send',
      litUsageApiKey: 'must-not-send',
    });
    options.resolveWorkerRpcUrl.mockReturnValue('');
    options.resolveWorkerRpcUrlMap.mockReturnValue({});
    options.resolveWorkerFaucetConfig.mockReturnValue({});
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload).toEqual(
      expect.objectContaining({
        sessionSlug: 'two-key-session',
        sessionId: '0x123e4567e89b12d3a456426614174000',
        sessionName: 'Two Key Session',
        sessionInfo: 'Worker-canonical session.',
        sessionModeProfile: expect.objectContaining({ authority: { mode: 'worker_canonical' } }),
        workerAuthority: expect.objectContaining({ version: 1 }),
        configRevision: expect.any(String),
        adminAddress: '0x00000000000000000000000000000000000000aa',
        secrets: { openaiKey: 'sk-ai' },
      }),
    );
    expect(deployPayload.registryAddress).toBeUndefined();
    expect(deployPayload.registryChainId).toBeUndefined();
    expect(deployPayload.rpcUrl).toBeUndefined();
    expect(deployPayload.rpcUrlsByChainId).toBeUndefined();
    expect(deployPayload.faucet).toBeUndefined();
    expect(deployPayload.blockLimits).toBeUndefined();
    expect(JSON.stringify(deployPayload)).not.toMatch(/must-not-send/);
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
