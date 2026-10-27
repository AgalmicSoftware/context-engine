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
  origin: 'https://session-worker.example.workers.dev',
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

  it.each([false, true])('keeps retired adapter fields off when publishing HTTP access %s', (enabled) => {
    const sessionConfig = registrySession();
    sessionConfig.sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionConfig.sessionModeProfile.surfaces.telegram = true;
    sessionConfig.sessionModeProfile.surfaces.miniApp = true;
    const patch = buildAdminAgentSessionWrappedConfigPatch({ sessionConfig, capability: { ...capability, enabled } });
    expect(patch.sessionModeProfile?.surfaces).toMatchObject({ agentHttp: enabled, telegram: false, miniApp: false });
    expect(sessionConfig.sessionModeProfile.surfaces).toMatchObject({ telegram: true, miniApp: true });
  });

  it('does not synthesize an invalid partial profile for a legacy registry session', () => {
    const legacySession = registrySession();
    delete (legacySession as { sessionModeProfile?: unknown }).sessionModeProfile;

    expect(() => buildAdminAgentSessionWrappedConfigPatch({ sessionConfig: legacySession, capability })).toThrow(
      /complete session mode profile/i,
    );
    expect(
      resolveAdminAgentSessionWrappedAvailability({
        canAdminWorker: true,
        sessionConfig: legacySession,
        sessionWorkerUrl: capability.origin,
      }),
    ).toMatchObject({ code: 'profile_required', manageable: false });
  });

  it('verifies one origin, saves signed config and verifies the resulting capability', async () => {
    const calls: string[] = [];
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
      calls.push('verify');
      expect(String(url)).toBe(`${capability.origin}/capabilities?slug=alpha`);
      return new Response(
        JSON.stringify({
          features: ['agent_http_v1'],
          agentHttp: { configured: true, enabled: true, ready: true },
          agentSessionWrapped: capability,
        }),
      );
    });
    const postSignedRequest = jest.fn(async (args) => {
      calls.push('publish');
      expect(args).toMatchObject({ action: 'set-config', path: '/admin/set-config', workerUrl: capability.origin });
    });
    const result = await applyAdminAgentSessionWrappedChange({
      accessEnabled: true,
      sessionConfig: registrySession(),
      sessionSlug: 'alpha',
      sessionWorkerUrl: capability.origin,
      fetchImpl,
      postSignedRequest,
    });
    expect(calls).toEqual(['verify', 'publish', 'verify']);
    expect(result.capability).toEqual(capability);
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('/deploy');
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

  it('does not report success when signed config publication fails', async () => {
    await expect(
      applyAdminAgentSessionWrappedChange({
        accessEnabled: true,
        sessionConfig: registrySession(),
        sessionSlug: 'alpha',
        sessionWorkerUrl: capability.origin,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              features: ['agent_http_v1'],
              agentHttp: { configured: true },
              agentSessionWrapped: capability,
            }),
          ),
        postSignedRequest: async () => {
          throw new Error('signed config write failed');
        },
      }),
    ).rejects.toThrow('signed config write failed');
  });

  it('verifies current capabilities and rejects a separate origin before fetching', async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            features: ['agent_http_v1'],
            agentHttp: { enabled: true, ready: true },
            agentSessionWrapped: capability,
          }),
        ),
    );
    await expect(
      verifyAdminAgentSessionWrappedHealth({
        capability,
        sessionSlug: 'alpha',
        sessionWorkerUrl: capability.origin,
        fetchImpl,
      }),
    ).resolves.toMatchObject({ ok: true, accessEnabled: true });
    fetchImpl.mockClear();
    await expect(
      verifyAdminAgentSessionWrappedHealth({
        capability,
        sessionSlug: 'alpha',
        sessionWorkerUrl: 'https://foreign.example',
        fetchImpl,
      }),
    ).rejects.toThrow('origin');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

it('clears retired surfaces when Admin updates Wrapped access', () => {
  const profile = registryModeProfile(true);
  profile.surfaces.telegram = true;
  profile.surfaces.miniApp = true;
  const patch = buildAdminAgentSessionWrappedConfigPatch({
    sessionConfig: registrySession({ sessionModeProfile: profile }),
    capability,
  });
  expect(patch.sessionModeProfile?.surfaces).toMatchObject({
    agentHttp: true,
    telegram: false,
    miniApp: false,
  });
  expect(profile.surfaces.telegram).toBe(true);
  expect(profile.surfaces.miniApp).toBe(true);
});
