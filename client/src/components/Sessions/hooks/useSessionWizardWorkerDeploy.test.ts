import { act, renderHook, waitFor } from '@testing-library/react';
import { cryptoUtils } from '../../../utilities/crypto/cryptography.js';
import { INVALID_SESSION_SLUG_FORMAT_ERROR } from '../sessionWizardSlugValidation';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import { readSessionWorkerConfigCache } from '../../../utilities/session/sessionWorkerConfigCache.js';
import { buildSessionWizardPublishExecutionPlan } from '../sessionWizardPublishFlow';
import { resolveSessionWizardPublishReadiness } from '../sessionWizardPublishReadiness';
import { resolveSessionWizardWorkerRequirementReadiness } from '../sessionWizardWorkerRequirementProof';
import { resolveSessionWizardWorkerPublishEvidence } from '../sessionWizardWorkerPublishEvidence';
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

  it('blocks deployment after terminal worker publication even when the form has rotated to a fresh session ID', async () => {
    const options = buildDeployHookOptions();
    const runtime = options.refs.runtimeRef.current as SessionWizardWorkerDeployRuntime & {
      workerCanonicalPublishCompleted?: boolean;
    };
    runtime.workerCanonicalPublishCompleted = true;
    runtime.sessionId = '00000000-0000-0000-0000-000000000002';
    runtime.sessionIdHex = '0x00000000000000000000000000000002';
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let deployResult;

    await act(async () => {
      deployResult = await result.current.handleDeployWorker({ forceSponsoredAutoDeploy: true });
    });

    expect(deployResult).toEqual({
      ok: false,
      skipped: true,
      error: expect.stringMatching(/already published/i),
    });
    expect(options.updateDeploymentState).toHaveBeenCalledWith({
      deployStatus: expect.stringMatching(/create another session/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows the initial publish controller to force sponsored auto-deploy before terminal settlement', async () => {
    const options = buildDeployHookOptions();
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let deployResult;

    await act(async () => {
      deployResult = await result.current.handleDeployWorker({ forceSponsoredAutoDeploy: true });
    });

    expect(deployResult).toEqual(
      expect.objectContaining({
        ok: true,
        workerUrl: 'https://deployed.example.test',
      }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/deploy'))).toBe(true);
  });

  it('reports infrastructure-only completion when public config readback is not verified', async () => {
    const options = buildDeployHookOptions();
    mockSuccessfulWorkerDeployFetch();
    options.verifyPublicWorkerDeployment.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));
    let deployResult;

    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringMatching(/public config readback.*browser-origin verification.*pending/i),
      }),
    );
    expect(options.updateDeploymentState).not.toHaveBeenCalledWith(
      expect.objectContaining({
        deployComplete: true,
      }),
    );
  });

  it('requests and adopts the dedicated Wrapped capability when surfaces.agentHttp is enabled', async () => {
    const capability = {
      version: 1,
      enabled: true,
      origin: 'https://ce-wrapped-deploy-storage-session.example.workers.dev',
      protocolVersion: 'agent-session-wrapped-v1',
      revision: 'wrapped-0123456789abcdef',
      verifiedAt: '2026-07-20T18:00:00.000Z',
    };
    const deployBodies: Record<string, unknown>[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            configVerified: true,
            writesSessionConfig: true,
            writesSessionSecrets: false,
            agentSessionWrapped: capability,
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const options = buildDeployHookOptions();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = 'custom';
    profile.surfaces.agentHttp = true;
    options.refs.runtimeRef.current.draft = {
      ...options.refs.runtimeRef.current.draft,
      sessionModeProfile: profile,
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual(expect.objectContaining({ ok: true, agentSessionWrapped: capability }));
    expect(deployBodies).toHaveLength(1);
    expect(deployBodies[0]).toEqual(
      expect.objectContaining({
        agentBridgeBundleUrl: expect.stringContaining('agentBridgeWorker.bundle.js'),
        agentSessionWrappedDeploymentIdentity: expect.stringContaining('deploy-storage-session'),
      }),
    );
    expect(options.updateDraftValue).toHaveBeenCalledWith(['agentSessionWrapped'], capability);
    expect(JSON.stringify(deployBodies[0])).not.toContain('TELEGRAM_');
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

  it('never sends a stale cached account id with a newly supplied token', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current.deployForm = {
      ...options.refs.runtimeRef.current.deployForm,
      apiToken: 'fresh-token',
      accountId: 'stale-account-id',
    };
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload.apiToken).toBe('fresh-token');
    expect(deployPayload.accountId).toBeUndefined();
  });

  it('reuses one deployment request id and config revision after a lost deploy response', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) throw new TypeError('Failed to fetch');
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
    const options = buildDeployHookOptions();
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let firstResult: Record<string, unknown> = {};
    let retryResult: Record<string, unknown> = {};
    await act(async () => {
      firstResult = await result.current.handleDeployWorker();
    });
    await act(async () => {
      retryResult = await result.current.handleDeployWorker();
    });

    expect(firstResult.ok).toBe(false);
    expect(retryResult.ok).toBe(true);
    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[0].deploymentRequestId).toEqual(expect.any(String));
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
    const attemptKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).find((key) =>
      key?.startsWith('ce:sessionWizardDeployAttempt:v1:'),
    );
    expect(JSON.parse(localStorage.getItem(attemptKey || '') || '{}')).toEqual(
      expect.objectContaining({ generation: 0, status: 'completed' }),
    );
  });

  it('reuses the pending deployment identity when missing remote handlers fall back to corrected bundle bytes', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) {
          return {
            ok: false,
            status: 502,
            json: async () => ({
              error: 'The uploaded script has no registered event handlers.',
              deploymentRequestPending: true,
              bundleDiagnostics: {
                source: 'remote-url',
                length: 216,
                hasAnyExport: true,
                hasExportDefault: false,
                hasNamedDefaultExport: false,
                hasFetchHandler: false,
                hasServiceWorkerFetch: false,
              },
            }),
          } as Response;
        }
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
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      wizardMode: 'normal',
      bundleMode: 'url',
      forceManualBundleFile: false,
      bundleFile: null,
    } as SessionWizardWorkerDeployRuntime;
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });
    expect(options.updateDeploymentState).toHaveBeenCalledWith({ forceManualBundleFile: true });

    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      forceManualBundleFile: true,
      bundleFile: {
        text: async () => 'export default { fetch() { return new Response("ok"); } };',
      } as File,
    } as SessionWizardWorkerDeployRuntime;
    let retryResult: Record<string, unknown> = {};
    await act(async () => {
      retryResult = await result.current.handleDeployWorker();
    });

    expect(retryResult.ok).toBe(true);
    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[0].bundleUrl).toEqual(expect.any(String));
    expect(deployBodies[0].bundleText).toBeUndefined();
    expect(deployBodies[1].bundleUrl).toBeUndefined();
    expect(deployBodies[1].bundleText).toContain('export default');
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
  });

  it('keeps a newer deploy generation when an older tab succeeds after a terminal conflict', async () => {
    let resolveFirstDeploy!: (response: Response) => void;
    const firstDeployResponse = new Promise<Response>((resolve) => {
      resolveFirstDeploy = resolve;
    });
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    const successfulDeployResponse = () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          workerUrl: 'https://deployed.example.test',
          writesSessionConfig: true,
          writesSessionSecrets: false,
        }),
      }) as Response;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) return firstDeployResponse;
        if (deployCalls === 2) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              error: 'This deployment request is already bound to a different Cloudflare account.',
              deploymentRequestConflict: true,
              deploymentRequestTerminal: true,
            }),
          } as Response;
        }
        return successfulDeployResponse();
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const firstTab = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
    const secondTab = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
    let firstAttemptPromise!: ReturnType<typeof firstTab.result.current.handleDeployWorker>;

    act(() => {
      firstAttemptPromise = firstTab.result.current.handleDeployWorker();
    });
    await waitFor(() => expect(deployBodies).toHaveLength(1));
    await act(async () => {
      expect((await secondTab.result.current.handleDeployWorker()).ok).toBe(false);
    });

    const attemptKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).find((key) =>
      key?.startsWith('ce:sessionWizardDeployAttempt:v1:'),
    );
    expect(JSON.parse(localStorage.getItem(attemptKey || '') || '{}')).toEqual(
      expect.objectContaining({ generation: 1, status: 'active' }),
    );

    resolveFirstDeploy(successfulDeployResponse());
    await act(async () => {
      expect((await firstAttemptPromise).ok).toBe(true);
    });
    expect(JSON.parse(localStorage.getItem(attemptKey || '') || '{}')).toEqual(
      expect.objectContaining({ generation: 1, status: 'active' }),
    );

    await act(async () => {
      expect((await secondTab.result.current.handleDeployWorker()).ok).toBe(true);
    });
    expect(deployBodies).toHaveLength(3);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[2].deploymentRequestId).not.toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[2].configRevision).not.toBe(deployBodies[0].configRevision);
    expect(JSON.parse(localStorage.getItem(attemptKey || '') || '{}')).toEqual(
      expect.objectContaining({ generation: 1, status: 'completed' }),
    );
  });

  it('treats explicit writesSessionSecrets false as authoritative on a resumed helper response', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
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
            sessionSecretsKey: 'session:deploy-storage-session:secrets',
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as Response;
    });
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current.workerSecretsEnabled = true;
    options.getCurrentWorkerSecrets.mockReturnValue({ openaiKey: 'sk-current-retry-secret' });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    const secretsSyncCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).endsWith('/admin/set-secrets'),
    );
    expect(secretsSyncCall).toBeDefined();
    expect(JSON.parse(String(secretsSyncCall?.[1]?.body || '{}')).secrets).toEqual({
      openaiKey: 'sk-current-retry-secret',
    });
  });

  it('syncs current config and secrets after a terminal mutable-drift recovery response', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            partial: true,
            writesSessionConfig: false,
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
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current.draft = {
      ...options.refs.runtimeRef.current.draft,
      sessionName: 'Current mutable recovery config',
    };
    options.refs.runtimeRef.current.workerSecretsEnabled = true;
    options.getCurrentWorkerSecrets.mockReturnValue({ openaiKey: 'sk-current-mutable-recovery' });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult.ok).toBe(true);
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const configSyncCalls = fetchCalls.filter(([url]) => String(url).endsWith('/admin/set-config'));
    const secretsSyncCalls = fetchCalls.filter(([url]) => String(url).endsWith('/admin/set-secrets'));
    expect(configSyncCalls).toHaveLength(1);
    expect(secretsSyncCalls).toHaveLength(1);
    expect(JSON.parse(String(configSyncCalls[0][1]?.body || '{}')).config).toEqual(
      expect.objectContaining({ sessionName: 'Current mutable recovery config' }),
    );
    expect(JSON.parse(String(secretsSyncCalls[0][1]?.body || '{}')).secrets).toEqual({
      openaiKey: 'sk-current-mutable-recovery',
    });
  });

  it('keeps manual deploy incomplete so publish retries required secrets on the same deployment identity', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let secretsSyncCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            partial: true,
            writesSessionConfig: false,
            writesSessionSecrets: false,
          }),
        } as Response;
      }
      if (normalizedUrl.endsWith('/admin/set-config')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        secretsSyncCalls += 1;
        if (secretsSyncCalls === 1) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: 'Required session secret sync was rejected.' }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const options = buildDeployHookOptions();
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      registryAddress: '',
      registryChainId: 0,
      draft: {
        slug: 'required-secret-recovery',
        sessionModeProfile,
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({ openaiKey: 'sk-required-recovery' });
    options.resolveWorkerRpcUrl.mockReturnValue('');
    options.resolveWorkerRpcUrlMap.mockReturnValue({});
    options.resolveWorkerFaucetConfig.mockReturnValue({});
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let firstResult: Record<string, unknown> = {};
    let retryResult: Record<string, unknown> = {};
    await act(async () => {
      firstResult = await result.current.handleDeployWorker();
    });
    const failedDeployReadiness = resolveSessionWizardPublishReadiness({
      resolvedWorkerBaseUrl: 'https://deployed.example.test',
      workerMode: 'custom',
      usesDefaultWorkerUrl: false,
      deployVerifiedInUi: firstResult.deployComplete === true,
      deployWorkerMatchesConfiguredUrl: true,
      canUseSponsoredAutoDeployNow: false,
      manualMetadataUrl: '',
      metadataUrl: '',
      sessionModeProfile,
    });
    const retryPublishPlan = buildSessionWizardPublishExecutionPlan({
      workerMode: 'custom',
      sponsoredAutoDeployReady: false,
      deployComplete: firstResult.deployComplete === true,
      sessionModeProfile,
    });
    await act(async () => {
      retryResult = await result.current.handleDeployWorker();
    });

    expect(firstResult).toEqual(
      expect.objectContaining({
        ok: true,
        deployComplete: false,
        requiredWorkerSecretsReady: false,
        requiredWorkerSecretFields: ['openaiKey'],
      }),
    );
    expect(retryResult).toEqual(
      expect.objectContaining({
        ok: true,
        deployComplete: true,
        requiredWorkerSecretsReady: true,
        requiredWorkerSecretFields: ['openaiKey'],
      }),
    );
    expect(failedDeployReadiness).toEqual(expect.objectContaining({ canPublishNow: false, readinessKind: 'blocked' }));
    expect(retryPublishPlan.shouldAutoDeployWorker).toBe(false);
    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
    expect(secretsSyncCalls).toBe(2);
    expect(options.updateDeploymentState).toHaveBeenCalledWith(expect.objectContaining({ deployComplete: false }));
    expect(options.updateDeploymentState).toHaveBeenCalledWith(expect.objectContaining({ deployComplete: true }));
  });

  it('does not cache a 200 partial deploy when signed config recovery fails', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            partial: true,
            writesSessionConfig: false,
            writesSessionSecrets: false,
          }),
        } as Response;
      }
      if (normalizedUrl.endsWith('/admin/set-config')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'Config recovery unavailable.' }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const options = buildDeployHookOptions();
    options.verifyPublicWorkerDeployment.mockRejectedValue(new Error('Config recovery unavailable.'));
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    expect(readSessionWorkerConfigCache().bySession).toEqual({});
  });

  it('reuses the deploy identity after the hook is unmounted and remounted', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        deployCalls += 1;
        if (deployCalls === 1) throw new TypeError('Failed to fetch');
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
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });

    const firstHook = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
    await act(async () => {
      await firstHook.result.current.handleDeployWorker();
    });
    firstHook.unmount();
    const remountedHook = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
    await act(async () => {
      await remountedHook.result.current.handleDeployWorker();
    });

    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
  });

  it.each([502, 504])('retains the deploy identity across an unstructured gateway %s', async (status) => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) {
          return {
            ok: false,
            status,
            json: async () => ({}),
          } as Response;
        }
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
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));

    await act(async () => {
      await result.current.handleDeployWorker();
    });
    await act(async () => {
      await result.current.handleDeployWorker();
    });

    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
  });

  it.each([
    {
      label: 'structured conflict',
      status: 409,
      responseBody: {
        error: 'deploymentRequestId was already used with a different request payload.',
        deploymentRequestIdConflict: true,
      },
    },
    {
      label: 'legacy exact conflict error',
      status: 409,
      responseBody: {
        error: 'deploymentRequestId was already used with a different request payload.',
      },
    },
    {
      label: 'structured pending response',
      status: 503,
      responseBody: {
        error: 'Deployment request is already running; retry the same request later.',
        deploymentRequestPending: true,
      },
    },
  ])(
    'never advances after a $label while another tab can still complete the owned request',
    async ({ responseBody, status }) => {
      const deployBodies: Record<string, unknown>[] = [];
      global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).endsWith('/deploy')) {
          deployBodies.push(JSON.parse(String(init?.body || '{}')));
          return {
            ok: false,
            status,
            json: async () => responseBody,
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      });
      const firstTab = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));

      await act(async () => {
        await firstTab.result.current.handleDeployWorker();
      });
      firstTab.unmount();
      const retryingTab = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
      await act(async () => {
        await retryingTab.result.current.handleDeployWorker();
      });

      expect(deployBodies).toHaveLength(2);
      expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
      expect(deployBodies[1].configRevision).toBe(deployBodies[0].configRevision);
    },
  );

  it.each([
    'This deployment request is already bound to a different Cloudflare account.',
    'deploymentRequestId was already used for a different immutable deployment identity.',
  ])('rotates only the next explicit attempt after a definitive conflict: %s', async (error) => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              error,
              deploymentRequestConflict: true,
              deploymentRequestTerminal: true,
            }),
          } as Response;
        }
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
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));

    let firstResult: Record<string, unknown> = {};
    await act(async () => {
      firstResult = await result.current.handleDeployWorker();
    });
    expect(firstResult).toEqual({
      ok: false,
      error: expect.stringContaining('click Deploy worker again to start a fresh deployment attempt'),
    });
    expect(deployBodies).toHaveLength(1);

    await act(async () => {
      await result.current.handleDeployWorker();
    });

    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).not.toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).not.toBe(deployBodies[0].configRevision);
  });

  it('rotates after a server terminal conflict even when the local attempt was already completed', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 2) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              error: 'This deployment request is already bound to a different Cloudflare account.',
              deploymentRequestConflict: true,
              deploymentRequestTerminal: true,
            }),
          } as Response;
        }
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
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));

    await act(async () => {
      expect((await result.current.handleDeployWorker()).ok).toBe(true);
    });
    await act(async () => {
      expect((await result.current.handleDeployWorker()).ok).toBe(false);
    });
    await act(async () => {
      expect((await result.current.handleDeployWorker()).ok).toBe(true);
    });

    expect(deployBodies).toHaveLength(3);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[2].deploymentRequestId).not.toBe(deployBodies[1].deploymentRequestId);
    expect(deployBodies[2].configRevision).not.toBe(deployBodies[1].configRevision);
  });

  it('rotates the deploy identity across a remount after a structured terminal orphan response', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let deployCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/deploy')) {
        deployCalls += 1;
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
        if (deployCalls === 1) {
          return {
            ok: false,
            status: 502,
            json: async () => ({
              error: 'Worker activation failed.',
              deploymentRequestTerminal: true,
              orphanResources: {
                workerName: 'failed-worker',
                kvNamespaceId: 'kv-failed',
              },
            }),
          } as Response;
        }
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
    const firstHook = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));

    await act(async () => {
      await firstHook.result.current.handleDeployWorker();
    });
    firstHook.unmount();
    const remountedHook = renderHook(() => useSessionWizardWorkerDeploy(buildDeployHookOptions()));
    await act(async () => {
      await remountedHook.result.current.handleDeployWorker();
    });

    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).not.toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].configRevision).not.toBe(deployBodies[0].configRevision);
  });

  it('surfaces incomplete Cloudflare cleanup identifiers from deploy-helper failures', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Worker script upload was not confirmed.',
        orphanResources: {
          workerName: 'ce-session-ab12',
          kvNamespaceId: 'kv-public-id',
          workerCleanupStatus: 'owned-delete-failed',
        },
      }),
    })) as jest.Mock;
    const options = buildDeployHookOptions();
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult;
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    const message =
      'Worker script upload was not confirmed. Cleanup incomplete: remove worker ce-session-ab12 and KV namespace kv-public-id in Cloudflare before retrying.';
    expect(deployResult).toEqual({ ok: false, error: message });
    expect(options.updateDeploymentState).toHaveBeenCalledWith({ deployStatus: message });
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
      anthropicKey: 'must-not-send',
      arweaveJwk: 'must-not-send',
      faucetPrivateKey: 'must-not-send',
      litUsageApiKey: 'must-not-send',
    });
    options.resolveWorkerRpcUrl.mockReturnValue('');
    options.resolveWorkerRpcUrlMap.mockReturnValue({});
    options.resolveWorkerFaucetConfig.mockReturnValue({});
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, any> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
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
    const proofInput = {
      proof: deployResult.workerRequirementProof,
      workerUrl: deployResult.workerUrl,
      sessionSlug: 'two-key-session',
      sessionId: '0x123e4567e89b12d3a456426614174000',
      sessionModeProfile: options.refs.runtimeRef.current.draft?.sessionModeProfile,
      sessionAi: options.refs.runtimeRef.current.draft?.ai,
      workerSecrets: { openaiKey: 'sk-ai' },
      workerSecretsEnabled: true,
    };
    expect(resolveSessionWizardWorkerRequirementReadiness(proofInput).verified).toBe(true);
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        ...proofInput,
        workerSecrets: { openaiKey: 'sk-ai-edited' },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'secret-values-changed' }));
    expect(
      resolveSessionWizardWorkerRequirementReadiness({
        ...proofInput,
        sessionAi: {
          models: {
            fast: { provider: 'anthropic' },
            thinking: { provider: 'anthropic' },
            transcription: { provider: 'anthropic' },
          },
        },
        workerSecrets: { anthropicKey: 'sk-ant-edited' },
      }),
    ).toEqual(expect.objectContaining({ verified: false, reason: 'requirements-changed' }));
  });

  it('blocks deployment when an explicit session mode profile is invalid', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const options = buildDeployHookOptions();
    const invalidProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    invalidProfile.storage.backend = 'arweave';
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'invalid-profile-session',
        sessionModeProfile: invalidProfile,
      },
    } as SessionWizardWorkerDeployRuntime;
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual({
      ok: false,
      error: 'Session mode configuration is invalid. Review the selected mode before deployment.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('publishes verified worker state synchronously for the same forced auto-deploy attempt', async () => {
    mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      registryAddress: '',
      registryChainId: 0,
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      sessionIdHex: '0x123e4567e89b12d3a456426614174000',
      draft: {
        slug: 'same-attempt-session',
        sessionName: 'Same Attempt Session',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-5' },
            thinking: { provider: 'openai', model: 'gpt-5' },
            transcription: { provider: 'openai', model: 'whisper-1' },
          },
        },
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({ openaiKey: 'sk-ai' });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, any> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker({ forceSponsoredAutoDeploy: true });
    });

    expect(options.refs.runtimeRef.current).toEqual(
      expect.objectContaining({
        workerMode: 'custom',
        deployComplete: true,
        deployWorkerUrl: 'https://deployed.example.test',
        workerRequirementProof: deployResult.workerRequirementProof,
        draft: expect.objectContaining({ corsWorkerUrl: 'https://deployed.example.test' }),
      }),
    );
    expect(
      resolveSessionWizardWorkerPublishEvidence({
        runtime: options.refs.runtimeRef.current,
        workerSecrets: { openaiKey: 'sk-ai' },
      }),
    ).toEqual(expect.objectContaining({ verified: true, workerUrl: 'https://deployed.example.test' }));
  });

  it('does not use stale hidden Lit credentials after switching to a selected non-Lit profile', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      registryAddress: '',
      registryChainId: 0,
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      draft: {
        slug: 'non-lit-session',
        sessionName: 'Non-Lit Session',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      litAccountApiKey: 'stale-hidden-account-key',
      litApiBase: 'https://stale-lit.example.test',
      litGroupId: 'stale-group',
      litPkpId: 'stale-pkp',
      litActionCid: 'stale-cid',
    });
    options.resolveWorkerRpcUrl.mockReturnValue('');
    options.resolveWorkerRpcUrlMap.mockReturnValue({});
    options.resolveWorkerFaucetConfig.mockReturnValue({});
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).not.toContain('https://deployed.example.test/admin/lit-chipotle-bootstrap-session');
    expect(requestedUrls).not.toContain('https://deployed.example.test/admin/lit-chipotle-provision');
    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload.secrets).toEqual({ openaiKey: 'sk-ai' });
    expect(deployResult).toEqual(
      expect.objectContaining({
        requiredWorkerSecretsReady: true,
        requiredWorkerSecretFields: ['openaiKey'],
      }),
    );
  });

  it('routes explicit-Lit RPC inputs through session secrets without duplicating them in canonical config', async () => {
    const fetchMock = mockSuccessfulWorkerDeployFetch();
    const options = buildDeployHookOptions();
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.encryption = { mode: 'lit' };
    sessionModeProfile.evm.registryChainId = 11155420;
    sessionModeProfile.storage.payloadAccessControl = {
      ...sessionModeProfile.storage.payloadAccessControl!,
      encryption: 'lit',
    };
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'worker-lit-session',
        sessionModeProfile,
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      customRpcKey: 'rpc-secret',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
      litUsageApiKey: 'lit-secret',
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
    const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
    expect(deployPayload.rpcUrl).toBeUndefined();
    expect(deployPayload.rpcUrlsByChainId).toBeUndefined();
    expect(deployPayload.secrets).toEqual({
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      customRpcKey: 'rpc-secret',
      litUsageApiKey: 'lit-secret',
    });
    const setConfigCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/admin/set-config'));
    expect(JSON.parse(String(setConfigCall?.[1]?.body || '{}')).config.litCredentials).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    });
    expect(deployResult).toEqual(
      expect.objectContaining({
        deployComplete: true,
        requiredLitRuntimeReady: true,
        requiredWorkerSecretsReady: true,
        requiredWorkerSecretFields: ['openaiKey', 'litUsageApiKey', 'customRpcUrl', 'customRpcKey'],
      }),
    );
  });

  it('does not mark a selected Lit deployment complete when bootstrap fails after worker creation', async () => {
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
      if (normalizedUrl.endsWith('/admin/lit-chipotle-bootstrap-session')) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Lit account bootstrap rejected.' }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    global.fetch = fetchMock;
    const options = buildDeployHookOptions();
    const sessionModeProfile = buildWorkerCanonicalLitProfile();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'worker-lit-bootstrap-failure',
        sessionModeProfile,
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      litAccountApiKey: 'lit-account-secret',
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual(
      expect.objectContaining({
        ok: true,
        deployComplete: false,
        requiredLitRuntimeReady: false,
        requiredWorkerSecretsReady: false,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('https://deployed.example.test/admin/set-secrets', expect.any(Object));
    expect(options.updateDeploymentState).toHaveBeenCalledWith(expect.objectContaining({ deployComplete: false }));
  });

  it('accepts Lit bootstrap only after the worker confirms both secret and config writes', async () => {
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
      if (normalizedUrl.endsWith('/admin/lit-chipotle-bootstrap-session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            apiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'group-1',
            litPkpId: 'pkp-1',
            litActionCid: 'bafy-action',
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    global.fetch = fetchMock;
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'worker-lit-bootstrap-success',
        sessionModeProfile: buildWorkerCanonicalLitProfile(),
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      litAccountApiKey: 'lit-account-secret',
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual(
      expect.objectContaining({
        ok: true,
        deployComplete: true,
        requiredLitRuntimeReady: true,
        requiredWorkerSecretsReady: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://deployed.example.test/admin/lit-chipotle-bootstrap-session',
      expect.any(Object),
    );
  });

  it('retains Lit bootstrap authority until a failed post-deploy secret sync resumes', async () => {
    const deployBodies: Record<string, unknown>[] = [];
    let secretSyncCalls = 0;
    const fetchMock = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        deployBodies.push(JSON.parse(String(init?.body || '{}')));
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
      if (normalizedUrl.endsWith('/admin/lit-chipotle-bootstrap-session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            apiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'group-1',
            litPkpId: 'pkp-1',
            litActionCid: 'bafy-action',
          }),
        } as Response;
      }
      if (normalizedUrl.endsWith('/admin/set-secrets')) {
        secretSyncCalls += 1;
        if (secretSyncCalls === 1) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: 'Required session secret sync was rejected.' }),
          } as Response;
        }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    global.fetch = fetchMock;
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'worker-lit-secret-resume',
        sessionModeProfile: buildWorkerCanonicalLitProfile(),
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    let currentSecrets: WorkerSecretsLike = {
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      litAccountApiKey: 'lit-account-secret',
    };
    options.getCurrentWorkerSecrets.mockImplementation(() => currentSecrets);
    options.applyWorkerSecretsUpdate.mockImplementation((nextValueOrUpdater: unknown) => {
      currentSecrets =
        typeof nextValueOrUpdater === 'function'
          ? (nextValueOrUpdater as (previous: WorkerSecretsLike) => WorkerSecretsLike)(currentSecrets)
          : nextValueOrUpdater && typeof nextValueOrUpdater === 'object'
            ? { ...currentSecrets, ...(nextValueOrUpdater as WorkerSecretsLike) }
            : currentSecrets;
      return currentSecrets;
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let firstResult: Record<string, unknown> = {};
    let retryResult: Record<string, unknown> = {};
    await act(async () => {
      firstResult = await result.current.handleDeployWorker();
    });
    expect(firstResult).toEqual(expect.objectContaining({ deployComplete: false }));
    expect(currentSecrets.litAccountApiKey).toBe('lit-account-secret');
    expect(currentSecrets).toEqual(
      expect.objectContaining({
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group-1',
        litPkpId: 'pkp-1',
        litActionCid: 'bafy-action',
        litRuntimeRecovered: 'bootstrap',
      }),
    );
    currentSecrets = { ...currentSecrets, openaiKey: 'sk-ai-edited-before-retry' };

    await act(async () => {
      retryResult = await result.current.handleDeployWorker();
    });

    expect(retryResult).toEqual(
      expect.objectContaining({
        deployComplete: true,
        requiredLitRuntimeReady: true,
        requiredWorkerSecretsReady: true,
      }),
    );
    expect(deployBodies).toHaveLength(2);
    expect(deployBodies[1].deploymentRequestId).toBe(deployBodies[0].deploymentRequestId);
    expect(deployBodies[1].secrets).toEqual(expect.objectContaining({ openaiKey: 'sk-ai-edited-before-retry' }));
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/admin/lit-chipotle-bootstrap-session')),
    ).toHaveLength(1);
    const retryConfigWrites = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith('/admin/set-config'))
      .map(([, init]) => JSON.parse(String(init?.body || '{}')).config);
    expect(retryConfigWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: 'group-1',
            litPkpId: 'pkp-1',
            litActionCid: 'bafy-action',
          },
        }),
      ]),
    );
    expect(currentSecrets.litAccountApiKey).toBe('');
    expect(secretSyncCalls).toBe(2);
  });

  it('does not mark a selected Lit deployment complete when action provisioning fails', async () => {
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
      if (normalizedUrl.endsWith('/admin/lit-chipotle-provision')) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Lit action provisioning rejected.' }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    global.fetch = fetchMock;
    const options = buildDeployHookOptions();
    options.refs.runtimeRef.current = {
      ...options.refs.runtimeRef.current,
      draft: {
        ...options.refs.runtimeRef.current.draft,
        slug: 'worker-lit-provision-failure',
        sessionModeProfile: buildWorkerCanonicalLitProfile(),
      },
      workerSecretsEnabled: true,
    } as SessionWizardWorkerDeployRuntime;
    options.getCurrentWorkerSecrets.mockReturnValue({
      openaiKey: 'sk-ai',
      customRpcUrl: 'https://rpc.example.test',
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group-1',
      litPkpId: 'pkp-1',
      litUsageApiKey: 'lit-usage-secret',
    });
    const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

    let deployResult: Record<string, unknown> = {};
    await act(async () => {
      deployResult = await result.current.handleDeployWorker();
    });

    expect(deployResult).toEqual(
      expect.objectContaining({
        ok: true,
        deployComplete: false,
        requiredLitRuntimeReady: false,
        requiredWorkerSecretsReady: false,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://deployed.example.test/admin/lit-chipotle-provision',
      expect.any(Object),
    );
  });

  it.each([
    ['anthropic', 'anthropicKey', 'openrouterKey'],
    ['openrouter', 'openrouterKey', 'anthropicKey'],
  ])(
    'preserves only the selected %s and transcription keys in a worker-canonical deploy',
    async (provider, key, irrelevantKey) => {
      const fetchMock = mockSuccessfulWorkerDeployFetch();
      const options = buildDeployHookOptions();
      options.refs.runtimeRef.current = {
        ...options.refs.runtimeRef.current,
        registryAddress: '',
        registryChainId: 0,
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        draft: {
          slug: 'provider-key-session',
          ai: {
            models: {
              fast: { provider },
              thinking: { provider },
            },
          },
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        },
        workerSecretsEnabled: true,
      } as SessionWizardWorkerDeployRuntime;
      options.getCurrentWorkerSecrets.mockReturnValue({
        [key]: 'provider-secret',
        [irrelevantKey]: 'must-not-send',
        openaiKey: 'transcription-secret',
        arweaveJwk: 'must-not-send',
        faucetPrivateKey: 'must-not-send',
      });
      options.resolveWorkerRpcUrl.mockReturnValue('');
      options.resolveWorkerRpcUrlMap.mockReturnValue({});
      const { result } = renderHook(() => useSessionWizardWorkerDeploy(options));

      let deployResult: Record<string, unknown> = {};
      await act(async () => {
        deployResult = await result.current.handleDeployWorker();
      });

      const deployCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(String(deployCall?.[1]?.body || '{}'));
      expect(deployPayload.secrets).toEqual({ [key]: 'provider-secret', openaiKey: 'transcription-secret' });
      expect(JSON.stringify(deployPayload)).not.toMatch(/must-not-send/);
      expect(deployResult).toEqual(
        expect.objectContaining({
          requiredWorkerSecretsReady: true,
          requiredWorkerSecretFields: [key, 'openaiKey'],
        }),
      );
    },
  );

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
