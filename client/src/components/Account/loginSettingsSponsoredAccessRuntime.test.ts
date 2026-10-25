import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { refreshSessionRegistryFieldsCache } from '../../utilities/web3/sessionRegistry.js';
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';
import { resolveLoginSettingsSessionConfig } from './loginSettingsSessionConfig';
import { loadLoginSettingsSponsoredAccess } from './loginSettingsSponsoredAccessRuntime';

jest.mock('./loginSettingsSessionConfig', () => ({
  resolveLoginSettingsSessionConfig: jest.fn(async (_slug, config) => config),
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(async ({ resourceKey }) => ({ resourceKey, status: 'ok' })),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  refreshSessionRegistryFieldsCache: jest.fn(async ({ slug }) => ({ slug })),
}));

jest.mock('../../utilities/worker/workerResourcePresence', () => ({
  readWorkerResourcePresence: jest.fn(async () => ({ ai: true })),
}));

const mockedCheckSponsoredAccess = jest.mocked(checkSponsoredAccess);
const mockedRefreshSessionRegistryFieldsCache = jest.mocked(refreshSessionRegistryFieldsCache);
const mockedReadWorkerResourcePresence = jest.mocked(readWorkerResourcePresence);

describe('loadLoginSettingsSponsoredAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks only projected Worker resources and never refreshes the registry from a legacy chain field', async () => {
    const sessionConfig = {
      slug: 'demo-sh',
      networkChainId: 11155420,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };

    const result = await loadLoginSettingsSponsoredAccess({
      slug: 'demo-sh',
      sessionConfig,
      account: '0x00000000000000000000000000000000000000aa',
      fallbackChainId: 84532,
    });

    expect(mockedRefreshSessionRegistryFieldsCache).not.toHaveBeenCalled();
    expect(mockedCheckSponsoredAccess).not.toHaveBeenCalled();
    expect(result.accessMap).toEqual({
      ai: { resourceKey: 'ai', status: 'worker-managed' },
      arweave: null,
      rpc: null,
      txGas: null,
    });
    expect(mockedReadWorkerResourcePresence).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'demo-sh',
        context: expect.objectContaining({ chainId: null }),
      }),
    );
  });

  it('loads the complete Worker config before choosing resource and gate checks', async () => {
    const complete = {
      slug: 'session-a',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    jest.mocked(resolveLoginSettingsSessionConfig).mockResolvedValueOnce(complete);
    const result = await loadLoginSettingsSponsoredAccess({
      slug: 'session-a',
      account: '',
      sessionConfig: { slug: 'session-a', workerCanonicalCleanRoute: true },
    });
    expect(result.sessionConfig).toEqual(complete);
    expect(result.workerResourcePresence?.ai).toBe(true);
    expect(result.accessMap.ai).toEqual({ resourceKey: 'ai', status: 'worker-managed' });
    expect(mockedReadWorkerResourcePresence).toHaveBeenCalledWith(expect.objectContaining({ sessionConfig: complete }));
    expect(mockedCheckSponsoredAccess).not.toHaveBeenCalled();
  });

  it('includes hosted Tx gas after loading confirmed faucet presence', async () => {
    mockedReadWorkerResourcePresence.mockResolvedValueOnce({ ai: false, arweave: false, rpc: false, txGas: true });
    const result = await loadLoginSettingsSponsoredAccess({
      slug: 'hosted-sbt',
      sessionConfig: {
        slug: 'hosted-sbt',
        networkChainId: 11155420,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        workerAuthority: { participantScopes: ['faucet'] },
      },
      account: '0x00000000000000000000000000000000000000aa',
    });
    expect(result.accessMap.txGas).toEqual({ resourceKey: 'txGas', status: 'worker-managed' });
    expect(mockedCheckSponsoredAccess).not.toHaveBeenCalled();
  });

  it('refreshes registry-backed sessions and checks every projected registry resource', async () => {
    const sessionConfig = {
      slug: 'registry-session',
      networkChainId: 84532,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      __registry: {
        registryChainId: 84532,
        sessionIdHex: '0x01',
        adminAddress: '0x00000000000000000000000000000000000000aa',
      },
    };
    mockedRefreshSessionRegistryFieldsCache.mockResolvedValueOnce(sessionConfig);

    await loadLoginSettingsSponsoredAccess({
      slug: 'registry-session',
      sessionConfig,
      account: '0x00000000000000000000000000000000000000aa',
    });

    expect(mockedRefreshSessionRegistryFieldsCache).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 11155420, slug: 'registry-session' }),
    );
    expect(mockedCheckSponsoredAccess.mock.calls.map(([args]) => args?.resourceKey)).toEqual([
      'ai',
      'arweave',
      'rpc',
      'txGas',
    ]);
  });

  it('does not probe Worker resources for a missing profile with stale chain and Worker fields', async () => {
    const result = await loadLoginSettingsSponsoredAccess({
      slug: 'stale-session',
      sessionConfig: {
        slug: 'stale-session',
        networkChainId: 84532,
        corsWorkerUrl: 'https://stale.example',
      },
      account: '0x00000000000000000000000000000000000000aa',
      fallbackChainId: 11155420,
    });

    expect(mockedRefreshSessionRegistryFieldsCache).not.toHaveBeenCalled();
    expect(mockedReadWorkerResourcePresence).not.toHaveBeenCalled();
    expect(mockedCheckSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(result.accessMap).toEqual({
      ai: { resourceKey: 'ai', status: 'ok' },
      arweave: null,
      rpc: null,
      txGas: null,
    });
  });
});
