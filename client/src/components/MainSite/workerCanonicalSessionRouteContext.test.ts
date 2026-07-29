import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveExplicitWorkerSessionConfig,
  resolveExplicitWorkerSessionNetwork,
} from './workerCanonicalSessionRouteContext';

const buildLitWorkerConfig = () => {
  const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  sessionModeProfile.encryption = { mode: 'lit' };
  sessionModeProfile.storage.payloadAccessControl!.encryption = 'lit';
  sessionModeProfile.evm.registryChainId = 11155420;
  return {
    slug: 'worker-lit-session',
    networkChainId: 84532,
    sessionModeProfile,
  };
};

const buildPureWorkerConfig = () => ({
  slug: 'demo-sh',
  networkChainId: 11155420,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
});

describe('workerCanonicalSessionRouteContext', () => {
  it('aligns explicit worker Lit session config to the validated profile chain without mutating its source', () => {
    const sessionConfig = buildLitWorkerConfig();

    const resolved = resolveExplicitWorkerSessionConfig({
      workerOrigin: 'https://worker.example.test',
      sessionConfig,
    });

    expect(resolved).toEqual(expect.objectContaining({ networkChainId: 11155420 }));
    expect(resolved).not.toBe(sessionConfig);
    expect(sessionConfig.networkChainId).toBe(84532);
  });

  it('preserves the source config when no explicit worker origin is active', () => {
    const sessionConfig = buildLitWorkerConfig();

    expect(resolveExplicitWorkerSessionConfig({ workerOrigin: '', sessionConfig })).toBe(sessionConfig);
  });

  it('uses the effective worker chain and falls back only outside explicit worker routing', () => {
    const sessionConfig = { ...buildLitWorkerConfig(), networkChainId: 11155420 };
    const fallbackNetwork = { id: 84532, chainId: 84532 };

    expect(
      resolveExplicitWorkerSessionNetwork({
        workerOrigin: '',
        sessionConfig,
        fallbackNetwork,
      }),
    ).toBe(fallbackNetwork);
    expect(
      resolveExplicitWorkerSessionNetwork({
        workerOrigin: 'https://worker.example.test',
        sessionConfig,
        fallbackNetwork,
      }),
    ).toEqual(expect.objectContaining({ id: 11155420 }));
    expect(
      resolveExplicitWorkerSessionNetwork({
        workerOrigin: 'https://worker.example.test',
        sessionConfig: buildPureWorkerConfig(),
        fallbackNetwork,
      }),
    ).toBeNull();
  });

  it('removes a legacy top-level chain from explicit pure Worker route context', () => {
    const sessionConfig = buildPureWorkerConfig();

    expect(
      resolveExplicitWorkerSessionConfig({
        workerOrigin: 'https://worker.example.test',
        sessionConfig,
      }),
    ).toEqual(expect.objectContaining({ networkChainId: null }));
    expect(
      resolveExplicitWorkerSessionNetwork({
        workerOrigin: 'https://worker.example.test',
        sessionConfig,
        fallbackNetwork: { id: 84532 },
      }),
    ).toBeNull();
    expect(sessionConfig.networkChainId).toBe(11155420);
  });
});
