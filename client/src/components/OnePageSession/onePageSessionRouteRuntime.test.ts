import {
  resolveOnePageSessionAggregatorCacheScope,
  resolveOnePageSessionRouteUiState,
} from './onePageSessionRouteRuntime';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

const buildWorkerHybridProfile = (kind: 'sbt' | 'lit') => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.evm.registryChainId = 11155420;
  if (kind === 'sbt') {
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };
  } else {
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl!.encryption = 'lit';
  }
  return profile;
};

describe('onePageSessionRouteRuntime', () => {
  it('uses the Worker cache partition for a pure Worker profile despite stale top-level chain metadata', () => {
    expect(
      resolveOnePageSessionAggregatorCacheScope({
        network: { id: 84532 },
        networkChainId: 11155420,
        sessionConfig: {
          slug: 'demo-sh',
          networkChainId: 11155420,
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        },
      }),
    ).toBe('worker');
  });

  it('uses the validated profile chain instead of wallet or top-level chain metadata', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);

    expect(
      resolveOnePageSessionAggregatorCacheScope({
        network: { id: 10 },
        networkChainId: 84532,
        sessionConfig: {
          slug: 'registry-session',
          networkChainId: 84532,
          sessionModeProfile: profile,
        },
      }),
    ).toBe('11155420');
  });

  it.each(['sbt', 'lit'] as const)(
    'keeps a Worker/%s hybrid aggregator on Worker-owned question and response storage',
    (kind) => {
      expect(
        resolveOnePageSessionAggregatorCacheScope({
          network: { id: 84532 },
          networkChainId: 84532,
          slug: 'worker-hybrid',
          sessionConfig: {
            slug: 'worker-hybrid',
            networkChainId: 84532,
            sessionModeProfile: buildWorkerHybridProfile(kind),
          },
        }),
      ).toBe('worker');
    },
  );

  it('fails closed for an invalid concrete profile', () => {
    expect(
      resolveOnePageSessionAggregatorCacheScope({
        network: { id: 84532 },
        networkChainId: 11155420,
        sessionConfig: {
          slug: 'broken-session',
          sessionModeProfile: { profileVersion: 1, preset: 'custom' },
        },
      }),
    ).toBe('');
  });

  it('fails closed for a concrete session whose capability profile is missing', () => {
    expect(
      resolveOnePageSessionAggregatorCacheScope({
        network: { id: 84532 },
        networkChainId: 11155420,
        slug: 'missing-profile',
        sessionConfig: {
          slug: 'missing-profile',
          networkChainId: 11155420,
        },
      }),
    ).toBe('');
  });

  it('keeps route result state derived from explicit route flags', () => {
    expect(resolveOnePageSessionRouteUiState({ routeAutoOpenResults: true })).toEqual({
      showQuestions: true,
      autoOpenResults: true,
    });
  });
});
