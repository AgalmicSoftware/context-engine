import { resolveAdminAgentSessionWrappedAvailability } from '../Admin/adminAgentSessionWrapped';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { verifyNativeSessionWorker } from './sessionWizardNativeWorkerVerification';
import { resolveSessionWizardWorkerPublishEvidence } from './sessionWizardWorkerPublishEvidence';
import type { SessionWizardWorkerDeployRuntime } from './hooks/useSessionWizardWorkerDeploy';

type VerifyNativeSessionWorkerInput = Parameters<typeof verifyNativeSessionWorker>[0];
type SignTypedAdminAction = VerifyNativeSessionWorkerInput['signTypedAdminAction'];

describe('verifyNativeSessionWorker', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses authority-neutral admin guidance for decentralized Worker attachment', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const toggleLoginModal = jest.fn();
    const resolveConnectedAdminAddress = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef: {
          current: {
            draft: {
              slug: 'registry-session',
              sessionModeProfile: profile,
            },
            loginComplete: false,
            toggleLoginModal,
            workerSecretsEnabled: true,
          } as SessionWizardWorkerDeployRuntime,
        },
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://registry-session.example.test',
        getCurrentWorkerSecrets: jest.fn(),
        getMissingWorkerSecretsForDeploy: jest.fn(),
        parseAllowOriginsInput: jest.fn(),
        resolveConnectedAdminAddress,
        resolveWorkerFaucetConfig: jest.fn(),
        signTypedAdminAction: jest.fn(),
        updateDeploymentState: jest.fn(),
        updateDraftValue: jest.fn(),
      }),
    ).rejects.toThrow('Connect or sign in as the session admin before verifying the Worker.');

    expect(toggleLoginModal).toHaveBeenCalledWith(true);
    expect(resolveConnectedAdminAddress).not.toHaveBeenCalled();
  });

  it('rejects a candidate that differs from a nonblank draft Worker URL before effects', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const toggleLoginModal = jest.fn();
    const resolveConnectedAdminAddress = jest.fn();
    const updateDeploymentState = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef: {
          current: {
            draft: {
              slug: 'registry-session',
              corsWorkerUrl: 'https://draft-worker.example.test',
              sessionModeProfile: profile,
            },
            loginComplete: false,
            toggleLoginModal,
            workerSecretsEnabled: true,
          } as SessionWizardWorkerDeployRuntime,
        },
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://other-worker.example.test',
        getCurrentWorkerSecrets: jest.fn(),
        getMissingWorkerSecretsForDeploy: jest.fn(),
        parseAllowOriginsInput: jest.fn(),
        resolveConnectedAdminAddress,
        resolveWorkerFaucetConfig: jest.fn(),
        signTypedAdminAction: jest.fn(),
        updateDeploymentState,
        updateDraftValue: jest.fn(),
      }),
    ).rejects.toThrow(/must match the current draft Worker URL/i);

    expect(toggleLoginModal).not.toHaveBeenCalled();
    expect(resolveConnectedAdminAddress).not.toHaveBeenCalled();
    expect(updateDeploymentState).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'attaches a decentralized Worker through signed config and secret acceptance (agent HTTP %s)',
    async (agentHttp) => {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
      profile.surfaces.agentHttp = agentHttp;
      if (agentHttp) profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async (input) => {
        const url = String(input);
        if (url.includes('/capabilities?slug=registry-session'))
          return new Response(
            JSON.stringify({
              features: ['agent_http_v1'],
              agentHttp: { enabled: true, configured: true, ready: true },
              agentSessionWrapped: {
                version: 1,
                origin: 'https://registry-session.example.test',
                enabled: true,
                protocolVersion: 'agent-session-wrapped-v1',
                revision: 'wrapped-fixture',
                verifiedAt: new Date().toISOString(),
              },
            }),
          );
        if (url.endsWith('/admin/set-config') || url.endsWith('/admin/set-secrets')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        throw new Error(`Unexpected decentralized Worker verification request: ${url}`);
      });
      global.fetch = fetchMock as typeof fetch;
      const updateDeploymentState = jest.fn();
      const updateDraftValue = jest.fn();
      const signTypedAdminAction = jest.fn<ReturnType<SignTypedAdminAction>, Parameters<SignTypedAdminAction>>(
        async () => ({
          address: '0x00000000000000000000000000000000000000aa',
          signature: '0xsigned',
        }),
      );

      await expect(
        verifyNativeSessionWorker({
          runtimeRef: {
            current: {
              draft: {
                slug: 'registry-session',
                sessionModeProfile: profile,
                networkChainId: 11155420,
                rpc: {
                  providers: {
                    path: { rpcUrl: 'https://public-rpc.registry.example.test' },
                  },
                },
                ai: {
                  models: {
                    fast: { provider: 'openai', model: 'gpt-5' },
                    thinking: { provider: 'openai', model: 'gpt-5' },
                    transcription: { provider: 'openai', model: 'whisper-1' },
                  },
                },
              },
              loginComplete: true,
              workerSecretsEnabled: true,
              registryChainId: 11155420,
              sessionIdHex: '0x00000000000000000000000000000001',
            } as SessionWizardWorkerDeployRuntime,
          },
          sessionSlug: 'registry-session',
          workerQueryValue: 'https://registry-session.example.test',
          getCurrentWorkerSecrets: () => ({
            openaiKey: 'test-ai-key',
            arweaveJwk: '{"kty":"RSA","n":"test"}',
            customRpcUrl: 'https://secret-rpc.registry.example.test',
          }),
          getMissingWorkerSecretsForDeploy: () => [],
          parseAllowOriginsInput: () => ['http://localhost'],
          resolveConnectedAdminAddress: async () => '0x00000000000000000000000000000000000000aa',
          resolveWorkerFaucetConfig: () => ({ rpcUrl: 'https://secret-rpc.registry.example.test' }),
          signTypedAdminAction,
          updateDeploymentState,
          updateDraftValue,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          configRevision: '',
          sessionId: '0x00000000000000000000000000000001',
          sessionSlug: 'registry-session',
          workerOrigin: 'https://registry-session.example.test',
        }),
      );

      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/session-config'))).toBe(false);
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/capabilities?slug='))).toBe(agentHttp);
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/deploy'))).toBe(false);
      const configSignInput = signTypedAdminAction.mock.calls.find(([input]) => input?.action === 'set-config')?.[0];
      expect(configSignInput?.body?.config?.rpcUrl).toBe('https://public-rpc.registry.example.test');
      expect(configSignInput?.body?.config?.rpcUrlsByChainId?.['11155420']).toEqual(
        expect.arrayContaining(['https://public-rpc.registry.example.test']),
      );
      expect(configSignInput?.body?.config?.faucet?.rpcUrl).toBe('https://public-rpc.registry.example.test');
      expect(JSON.stringify(configSignInput?.body?.config)).not.toContain('secret-rpc.registry.example.test');
      const secretsRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/admin/set-secrets'));
      expect(JSON.parse(String(secretsRequest?.[1]?.body || '{}')).secrets).toEqual(
        expect.objectContaining({ customRpcUrl: 'https://secret-rpc.registry.example.test' }),
      );
      expect(signTypedAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'set-config',
          targetSlug: 'registry-session',
        }),
      );
      expect(signTypedAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'set-secrets',
          targetSlug: 'registry-session',
        }),
      );
      expect(updateDraftValue).toHaveBeenCalledWith(['corsWorkerUrl'], 'https://registry-session.example.test');
      if (agentHttp) {
        const saved = updateDraftValue.mock.calls.find(([path]) => path.join('.') === 'agentSessionWrapped')?.[1];
        expect(saved).toEqual(
          expect.objectContaining({ enabled: true, origin: 'https://registry-session.example.test' }),
        );
        expect(
          resolveAdminAgentSessionWrappedAvailability({
            canAdminWorker: true,
            sessionWorkerUrl: 'https://registry-session.example.test',
            sessionConfig: { sessionModeProfile: profile, agentSessionWrapped: saved },
          }).message,
        ).toBe('Wrapped access is enabled.');
      }

      expect(updateDeploymentState).toHaveBeenCalledWith(
        expect.objectContaining({
          deployComplete: true,
          deployStatus: 'Session Worker verified.',
          workerRequirementProof: expect.objectContaining({ version: 1 }),
        }),
      );
    },
  );

  it.each([
    ['deployed from the template', true, false],
    ['attached as an existing Worker', false, true],
  ])(
    'records the deploy-helper flag of a Worker %s and keeps publication on that config',
    async (_label, deployedFromTemplate, expectedHelperFlag) => {
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
      const workerSecrets = { openaiKey: 'test-ai-key', arweaveJwk: '{"kty":"RSA"}' };
      const runtimeRef = {
        current: {
          account: '0x00000000000000000000000000000000000000aa',
          draft: {
            slug: 'registry-session',
            sessionModeProfile: profile,
            embeddedDeployHelperEnabled: true,
            ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
          },
          embeddedDeployHelperEnabled: true,
          loginComplete: true,
          workerAllowOrigins: 'http://localhost',
          workerMode: 'custom',
          workerSecretsEnabled: true,
          registryChainId: 11155420,
          sessionIdHex: '0x00000000000000000000000000000001',
        } as SessionWizardWorkerDeployRuntime,
      };
      global.fetch = jest.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ) as unknown as typeof fetch;
      const updateDraftValue = jest.fn();
      const signTypedAdminAction = jest.fn<ReturnType<SignTypedAdminAction>, Parameters<SignTypedAdminAction>>(
        async () => ({ address: '0x00000000000000000000000000000000000000aa', signature: '0xsigned' }),
      );

      await verifyNativeSessionWorker({
        runtimeRef,
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://registry-session.example.test',
        deployedFromTemplate,
        getCurrentWorkerSecrets: () => workerSecrets,
        getMissingWorkerSecretsForDeploy: () => [],
        parseAllowOriginsInput: () => ['http://localhost'],
        resolveConnectedAdminAddress: async () => '0x00000000000000000000000000000000000000aa',
        resolveWorkerFaucetConfig: () => ({}),
        signTypedAdminAction,
        updateDeploymentState: jest.fn(),
        updateDraftValue,
      });

      const configSignInput = signTypedAdminAction.mock.calls.find(([input]) => input?.action === 'set-config')?.[0];
      expect(configSignInput?.body?.config?.embeddedDeployHelperEnabled).toBe(expectedHelperFlag);
      // An attached Worker may run the helper, so its draft value stays as it was.
      expect(
        updateDraftValue.mock.calls.some(([path]) => (path as string[]).join('.') === 'embeddedDeployHelperEnabled'),
      ).toBe(deployedFromTemplate);
      expect(runtimeRef.current.embeddedDeployHelperEnabled).toBe(expectedHelperFlag);
      expect(resolveSessionWizardWorkerPublishEvidence({ runtime: runtimeRef.current, workerSecrets })).toEqual(
        expect.objectContaining({ verified: true }),
      );
    },
  );

  it('does not record decentralized readiness when secret acceptance is unconfirmed', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/admin/set-config')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/admin/set-secrets')) {
        return new Response(JSON.stringify({ ok: false }), { status: 200 });
      }
      throw new Error(`Unexpected decentralized Worker verification request: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;
    const updateDeploymentState = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef: {
          current: {
            draft: {
              slug: 'registry-session',
              sessionModeProfile: profile,
              ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
            },
            loginComplete: true,
            workerSecretsEnabled: true,
            registryChainId: 11155420,
            sessionIdHex: '0x00000000000000000000000000000001',
          } as SessionWizardWorkerDeployRuntime,
        },
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://registry-session.example.test',
        getCurrentWorkerSecrets: () => ({ openaiKey: 'test-ai-key', arweaveJwk: '{"kty":"RSA"}' }),
        getMissingWorkerSecretsForDeploy: () => [],
        parseAllowOriginsInput: () => ['http://localhost'],
        resolveConnectedAdminAddress: async () => '0x00000000000000000000000000000000000000aa',
        resolveWorkerFaucetConfig: () => ({}),
        signTypedAdminAction: async () => ({
          address: '0x00000000000000000000000000000000000000aa',
          signature: '0xsigned',
        }),
        updateDeploymentState,
        updateDraftValue: jest.fn(),
      }),
    ).rejects.toThrow(/secret write did not confirm acceptance/i);

    expect(updateDeploymentState).not.toHaveBeenCalledWith(expect.objectContaining({ deployComplete: true }));
  });

  it('rejects a verification result when authorization inputs change in flight', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const runtimeRef = {
      current: {
        account: '0x00000000000000000000000000000000000000aa',
        draft: {
          slug: 'registry-session',
          groupCreationPolicy: 'participants',
          sessionModeProfile: profile,
          ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
        },
        loginComplete: true,
        workerAllowOrigins: 'http://localhost',
        workerSecretsEnabled: true,
        registryChainId: 11155420,
        sessionIdHex: '0x00000000000000000000000000000001',
      } as SessionWizardWorkerDeployRuntime,
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/admin/set-config')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/admin/set-secrets')) {
        runtimeRef.current = {
          ...runtimeRef.current,
          draft: { ...runtimeRef.current.draft, groupCreationPolicy: 'admin_only' },
        };
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected Worker verification request: ${url}`);
    }) as typeof fetch;
    const updateDeploymentState = jest.fn();
    const updateDraftValue = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef,
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://registry-session.example.test',
        getCurrentWorkerSecrets: () => ({ openaiKey: 'test-ai-key', arweaveJwk: '{"kty":"RSA"}' }),
        getMissingWorkerSecretsForDeploy: () => [],
        parseAllowOriginsInput: () => ['http://localhost'],
        resolveConnectedAdminAddress: async () => runtimeRef.current.account || '',
        resolveWorkerFaucetConfig: () => ({}),
        signTypedAdminAction: async () => ({
          address: runtimeRef.current.account,
          signature: '0xsigned',
        }),
        updateDeploymentState,
        updateDraftValue,
      }),
    ).rejects.toThrow(/settings changed while Worker verification was in progress/i);

    expect(updateDraftValue).not.toHaveBeenCalled();
    expect(updateDeploymentState).not.toHaveBeenCalledWith(expect.objectContaining({ deployComplete: true }));
  });

  it('does not restore a stale Worker URL when the draft changes in flight', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const verifiedWorkerUrl = 'https://registry-session.example.test';
    const replacementWorkerUrl = 'https://replacement-worker.example.test';
    const runtimeRef = {
      current: {
        account: '0x00000000000000000000000000000000000000aa',
        draft: {
          slug: 'registry-session',
          corsWorkerUrl: verifiedWorkerUrl,
          sessionModeProfile: profile,
          ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
        },
        loginComplete: true,
        workerAllowOrigins: 'http://localhost',
        workerSecretsEnabled: true,
        registryChainId: 11155420,
        sessionIdHex: '0x00000000000000000000000000000001',
      } as SessionWizardWorkerDeployRuntime,
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/admin/set-config')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/admin/set-secrets')) {
        runtimeRef.current = {
          ...runtimeRef.current,
          draft: { ...runtimeRef.current.draft, corsWorkerUrl: replacementWorkerUrl },
        };
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected Worker verification request: ${url}`);
    }) as typeof fetch;
    const updateDeploymentState = jest.fn();
    const updateDraftValue = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef,
        sessionSlug: 'registry-session',
        workerQueryValue: verifiedWorkerUrl,
        getCurrentWorkerSecrets: () => ({ openaiKey: 'test-ai-key', arweaveJwk: '{"kty":"RSA"}' }),
        getMissingWorkerSecretsForDeploy: () => [],
        parseAllowOriginsInput: () => ['http://localhost'],
        resolveConnectedAdminAddress: async () => runtimeRef.current.account || '',
        resolveWorkerFaucetConfig: () => ({}),
        signTypedAdminAction: async () => ({
          address: runtimeRef.current.account,
          signature: '0xsigned',
        }),
        updateDeploymentState,
        updateDraftValue,
      }),
    ).rejects.toThrow(/settings changed while Worker verification was in progress/i);

    expect(runtimeRef.current.draft?.corsWorkerUrl).toBe(replacementWorkerUrl);
    expect(updateDraftValue).not.toHaveBeenCalled();
    expect(updateDeploymentState).not.toHaveBeenCalledWith(expect.objectContaining({ deployComplete: true }));
  });

  it('rejects a verification result when the session admin disconnects in flight', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const runtimeRef = {
      current: {
        account: '0x00000000000000000000000000000000000000aa',
        draft: {
          slug: 'registry-session',
          sessionModeProfile: profile,
          ai: { models: { fast: { provider: 'openai', model: 'gpt-5' } } },
        },
        loginComplete: true,
        workerAllowOrigins: 'http://localhost',
        workerSecretsEnabled: true,
        registryChainId: 11155420,
        sessionIdHex: '0x00000000000000000000000000000001',
      } as SessionWizardWorkerDeployRuntime,
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/admin/set-config')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/admin/set-secrets')) {
        runtimeRef.current = {
          ...runtimeRef.current,
          account: '',
          loginComplete: false,
        };
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected Worker verification request: ${url}`);
    }) as typeof fetch;
    const updateDeploymentState = jest.fn();

    await expect(
      verifyNativeSessionWorker({
        runtimeRef,
        sessionSlug: 'registry-session',
        workerQueryValue: 'https://registry-session.example.test',
        getCurrentWorkerSecrets: () => ({ openaiKey: 'test-ai-key', arweaveJwk: '{"kty":"RSA"}' }),
        getMissingWorkerSecretsForDeploy: () => [],
        parseAllowOriginsInput: () => ['http://localhost'],
        resolveConnectedAdminAddress: async () => '0x00000000000000000000000000000000000000aa',
        resolveWorkerFaucetConfig: () => ({}),
        signTypedAdminAction: async () => ({
          address: '0x00000000000000000000000000000000000000aa',
          signature: '0xsigned',
        }),
        updateDeploymentState,
        updateDraftValue: jest.fn(),
      }),
    ).rejects.toThrow(/settings changed while Worker verification was in progress/i);

    expect(updateDeploymentState).not.toHaveBeenCalledWith(expect.objectContaining({ deployComplete: true }));
  });
});
