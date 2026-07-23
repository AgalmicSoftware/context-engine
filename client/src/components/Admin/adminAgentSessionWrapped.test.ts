import {
  applyAdminAgentSessionWrappedChange,
  buildAdminAgentSessionWrappedConfigPatch,
  ensureAdminAgentSessionWrappedWorkerAttached,
  resolveAdminAgentSessionWrappedAvailability,
  resolveAdminAgentSessionWrappedWorkerOrigin,
  verifyAdminAgentSessionWrappedHealth,
} from './adminAgentSessionWrapped';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const capability = {
  version: 1 as const,
  enabled: true,
  origin: 'https://wrapped-alpha.example.workers.dev',
  protocolVersion: 'agent-session-wrapped-v1',
  revision: 'wrapped-0123456789abcdef',
  verifiedAt: '2026-07-20T18:00:00.000Z',
};

const registryModeProfile = (agentHttp = false) => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  profile.surfaces.agentHttp = agentHttp;
  if (agentHttp) profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  return profile;
};

const registrySession = (overrides: Record<string, unknown> = {}) => ({
  slug: 'alpha',
  sessionId: '0x01',
  networkChainId: 11155420,
  corsWorkerUrl: 'https://session-worker.example.workers.dev',
  sessionModeProfile: registryModeProfile(),
  __registry: {
    registryChainId: 11155420,
    adminAddress: '0x1111111111111111111111111111111111111111',
  },
  ...overrides,
});

describe('adminAgentSessionWrapped', () => {
  it.each([
    ['worker canonical', { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) }],
    ['registry canonical', {}],
  ])('allows %s sessions with one paired Worker', (_label, overrides) => {
    expect(
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker: true,
        sessionConfig: registrySession(overrides),
        sessionWorkerUrl: 'https://session-worker.example.workers.dev',
      }),
    ).toEqual(expect.objectContaining({ code: 'ready', compatible: true, manageable: true }));
  });

  it('distinguishes attachable and permanently locked workerless registry sessions', () => {
    expect(
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker: true,
        sessionConfig: registrySession({ corsWorkerUrl: '' }),
        sessionWorkerUrl: '',
      }).code,
    ).toBe('worker_required');
    expect(
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker: false,
        sessionConfig: registrySession({
          corsWorkerUrl: '',
          __registry: {
            registryChainId: 11155420,
            adminAddress: '0x0000000000000000000000000000000000000000',
          },
        }),
        sessionWorkerUrl: '',
      }).code,
    ).toBe('locked_workerless');
  });

  it('blocks encrypted registry Worker-pointer replacement before deployment', () => {
    expect(
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker: true,
        sessionConfig: registrySession({ corsWorkerUrl: { ciphertext: 'encrypted-worker-pointer' } }),
        sessionWorkerUrl: 'https://edited-worker.example.workers.dev',
      }),
    ).toEqual(
      expect.objectContaining({
        code: 'encrypted_worker_pointer',
        compatible: true,
        manageable: false,
      }),
    );
  });

  it('rejects an incompatible authority instead of inventing Bridge chain verification', () => {
    const availability = resolveAdminAgentSessionWrappedAvailability({
      canAdminWorker: true,
      sessionConfig: registrySession({ sessionModeProfile: { authority: { mode: 'local_only' } } }),
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
    });
    expect(availability).toEqual(expect.objectContaining({ code: 'incompatible', compatible: false }));
  });

  it('fails closed for a raw compatible authority in an invalid profile', () => {
    const availability = resolveAdminAgentSessionWrappedAvailability({
      canAdminWorker: true,
      sessionConfig: registrySession({
        sessionModeProfile: {
          profileVersion: 999,
          authority: { mode: 'worker_canonical' },
        },
      }),
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
    });

    expect(availability).toEqual(
      expect.objectContaining({ code: 'incompatible', compatible: false, manageable: false }),
    );
  });

  it('never treats the shared fallback as the dedicated paired Worker origin', () => {
    const generalWorkerSession = {
      slug: '',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    expect(
      resolveAdminAgentSessionWrappedWorkerOrigin({
        editedWorkerUrl: 'https://shared-fallback.example.workers.dev',
        sessionConfig: generalWorkerSession,
        sessionSlug: '',
        workerUrlEditable: false,
      }),
    ).toBe('');
    expect(
      resolveAdminAgentSessionWrappedWorkerOrigin({
        editedWorkerUrl: 'https://paired-worker.example.workers.dev',
        sessionConfig: generalWorkerSession,
        sessionSlug: '',
        workerUrlEditable: true,
      }),
    ).toBe('https://paired-worker.example.workers.dev');
  });

  it('builds one config patch whose agentHttp bit drives the mirrored capability state', () => {
    expect(buildAdminAgentSessionWrappedConfigPatch({ sessionConfig: registrySession(), capability })).toEqual(
      expect.objectContaining({
        agentSessionWrapped: capability,
        sessionModeProfile: expect.objectContaining({
          preset: 'custom',
          surfaces: expect.objectContaining({ agentHttp: true }),
          authority: { mode: 'evm_registry_canonical' },
        }),
      }),
    );
    expect(
      buildAdminAgentSessionWrappedConfigPatch({
        sessionConfig: registrySession(),
        capability: { ...capability, enabled: false },
      }),
    ).toEqual(
      expect.objectContaining({
        sessionModeProfile: expect.objectContaining({
          surfaces: expect.objectContaining({ agentHttp: false }),
        }),
      }),
    );
  });

  it('does not synthesize an invalid partial profile for a legacy registry session', () => {
    const legacySession = registrySession();
    delete (legacySession as { sessionModeProfile?: unknown }).sessionModeProfile;

    expect(buildAdminAgentSessionWrappedConfigPatch({ sessionConfig: legacySession, capability })).toEqual({
      agentSessionWrapped: capability,
    });
  });

  it('awaits verified deployment before signed config publication and returns no token', async () => {
    const calls: string[] = [];
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push('deploy');
      const body = JSON.parse(String(init?.body || '{}'));
      expect(body).toEqual(
        expect.objectContaining({
          apiToken: 'cf-request-only-token',
          deploymentKind: 'agent_session_wrapped',
          deploymentRequestId: 'wrapped-admin-request-1',
          agentHttpEnabled: true,
          sessionSlug: 'alpha',
          sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
          authorityMode: 'evm_registry_canonical',
        }),
      );
      expect(JSON.stringify(body)).not.toContain('TELEGRAM_');
      return new Response(
        JSON.stringify({
          ok: true,
          sessionSlug: 'alpha',
          sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
          workerUrl: capability.origin,
          agentSessionWrapped: capability,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const postSignedRequest = jest.fn(async (args) => {
      calls.push('publish');
      expect(args).toEqual(
        expect.objectContaining({
          action: 'set-config',
          path: '/admin/set-config',
          workerUrl: 'https://session-worker.example.workers.dev',
        }),
      );
      expect(args.body.config).toEqual(expect.objectContaining({ agentSessionWrapped: capability }));
      return { data: { ok: true } };
    });
    const ensureSessionWorkerAttached = jest.fn(async () => {
      calls.push('attach');
    });

    const result = await applyAdminAgentSessionWrappedChange({
      accessEnabled: true,
      apiToken: 'cf-request-only-token',
      deployHelperUrl: 'https://deploy-helper.example.workers.dev',
      deploymentRequestId: 'wrapped-admin-request-1',
      sessionConfig: registrySession(),
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
      fetchImpl,
      ensureSessionWorkerAttached,
      postSignedRequest,
    });

    expect(calls).toEqual(['deploy', 'attach', 'publish']);
    expect(result).toEqual(expect.objectContaining({ capability }));
    expect(JSON.stringify(result)).not.toContain('cf-request-only-token');
  });

  it('attaches a missing registry Worker but never rewrites encrypted pointers', async () => {
    const setSessionFieldsOnChain = jest.fn(async (_input: Record<string, unknown>) => ({ ok: true }));
    const buildRegistrySessionFields = jest.fn(({ onChainFields }) => onChainFields);
    await expect(
      ensureAdminAgentSessionWrappedWorkerAttached({
        buildRegistrySessionFields,
        providerLike: 'wallet-provider',
        sessionConfig: registrySession({ corsWorkerUrl: '' }),
        sessionSlug: 'alpha',
        sessionWorkerUrl: 'https://session-worker.example.workers.dev',
        setSessionFieldsOnChain,
      }),
    ).resolves.toEqual({ attached: true });
    expect(setSessionFieldsOnChain).toHaveBeenCalledWith({
      providerLike: 'wallet-provider',
      chainId: 11155420,
      slug: 'alpha',
      fields: { corsWorkerUrl: 'https://session-worker.example.workers.dev' },
    });

    await expect(
      ensureAdminAgentSessionWrappedWorkerAttached({
        buildRegistrySessionFields,
        sessionConfig: registrySession({ corsWorkerUrl: { ciphertext: 'encrypted-worker-pointer' } }),
        sessionSlug: 'alpha',
        sessionWorkerUrl: 'https://session-worker.example.workers.dev',
        setSessionFieldsOnChain,
      }),
    ).rejects.toThrow('encrypted Worker pointer');
  });

  it('does not request an on-chain attachment for worker-canonical or already paired sessions', async () => {
    const setSessionFieldsOnChain = jest.fn(async () => ({ ok: true }));
    await ensureAdminAgentSessionWrappedWorkerAttached({
      sessionConfig: registrySession(),
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
      setSessionFieldsOnChain,
    });
    await ensureAdminAgentSessionWrappedWorkerAttached({
      sessionConfig: registrySession({
        corsWorkerUrl: '',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      }),
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
      setSessionFieldsOnChain,
    });
    expect(setSessionFieldsOnChain).not.toHaveBeenCalled();
  });

  it('does not report success when durable signed config publication fails', async () => {
    await expect(
      applyAdminAgentSessionWrappedChange({
        accessEnabled: true,
        apiToken: 'cf-request-only-token',
        deployHelperUrl: 'https://deploy-helper.example.workers.dev',
        deploymentRequestId: 'wrapped-admin-request-2',
        sessionConfig: registrySession(),
        sessionSlug: 'alpha',
        sessionWorkerUrl: 'https://session-worker.example.workers.dev',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              ok: true,
              sessionSlug: 'alpha',
              sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
              workerUrl: capability.origin,
              agentSessionWrapped: capability,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        postSignedRequest: async () => {
          throw new Error('signed config write failed');
        },
      }),
    ).rejects.toThrow('signed config write failed');
  });

  it('health-checks the published origin against the exact paired Worker and access state', async () => {
    const result = await verifyAdminAgentSessionWrappedHealth({
      capability,
      sessionSlug: 'alpha',
      sessionWorkerUrl: 'https://session-worker.example.workers.dev',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            worker: 'agentBridgeWorker',
            protocolVersion: 'agent-session-wrapped-v1',
            agentSessionWrappedConfigured: true,
            agentSessionWrappedReady: true,
            dedicatedSession: {
              accessEnabled: true,
              sessionSlug: 'alpha',
              sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, accessEnabled: true }));

    await expect(
      verifyAdminAgentSessionWrappedHealth({
        capability,
        sessionSlug: 'alpha',
        sessionWorkerUrl: 'https://different-worker.example.workers.dev',
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              ok: true,
              worker: 'agentBridgeWorker',
              protocolVersion: 'agent-session-wrapped-v1',
              agentSessionWrappedConfigured: true,
              agentSessionWrappedReady: true,
              dedicatedSession: {
                accessEnabled: true,
                sessionSlug: 'alpha',
                sessionWorkerOrigin: 'https://session-worker.example.workers.dev',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      }),
    ).rejects.toThrow('pinned authority');
  });
});
