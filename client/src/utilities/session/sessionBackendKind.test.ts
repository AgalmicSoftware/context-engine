import { isHostedAgentSessionConfig, resolveSessionBackendKind } from './sessionBackendKind';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from './sessionModeProfile';

describe('sessionBackendKind', () => {
  it.each([
    [{ telegramOnly: true }],
    [{ telegram_only: true }],
    [{ sessionMode: 'telegram_only' }],
    [{ telegramMode: 'telegram_only' }],
    [{ telegram: { only: true } }],
    [{ telegram: { mode: 'telegram_only' } }],
  ])('detects legacy telegram-first config variant %#', (metadata) => {
    expect(isHostedAgentSessionConfig(metadata)).toBe(true);
    expect(resolveSessionBackendKind({ sessionConfig: metadata })).toBe('agent');
  });

  it('enables hosted agent HTTP sessions while both retired surfaces are off', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.agentHttp = true;
    profile.surfaces.telegram = false;
    profile.surfaces.miniApp = false;
    expect(isHostedAgentSessionConfig({ sessionModeProfile: profile })).toBe(true);
    expect(resolveSessionBackendKind({ sessionConfig: { sessionModeProfile: profile } })).toBe('agent');
  });

  it('keeps explicit HTTP-off profiles authoritative over stale legacy config and probe flags', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.telegram = true;
    profile.surfaces.agentHttp = false;
    const sessionConfig = { sessionModeProfile: profile, telegramOnly: true };
    expect(isHostedAgentSessionConfig(sessionConfig)).toBe(false);
    expect(resolveSessionBackendKind({ sessionConfig, probeResult: { telegramOnly: true } })).toBe('onchain');
  });

  it('does not enable the agent shell for registry authority or a malformed explicit profile', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    profile.surfaces.agentHttp = true;
    expect(isHostedAgentSessionConfig({ sessionModeProfile: profile, telegramOnly: true })).toBe(false);
    expect(isHostedAgentSessionConfig({ sessionModeProfile: null, telegramOnly: true })).toBe(false);
  });

  it('uses session-meta probe results when config is not locally available', () => {
    expect(
      resolveSessionBackendKind({
        sessionConfig: {},
        probeResult: { ok: true, telegramOnly: true, telegramBridgeEnabled: true },
      }),
    ).toBe('agent');
  });

  it('accepts neutral hosted HTTP probe metadata and honors its explicit off value', () => {
    const enabled = { ok: true, authorityMode: 'worker_canonical', agentHttpEnabled: true };
    expect(resolveSessionBackendKind({ probeResult: enabled })).toBe('agent');
    expect(
      resolveSessionBackendKind({ probeResult: { ...enabled, agentHttpEnabled: false, telegramOnly: true } }),
    ).toBe('onchain');
  });

  it('ignores stale session-meta probe results from a different session slug', () => {
    expect(
      resolveSessionBackendKind({
        sessionConfig: { slug: 'demo' },
        sessionSlug: 'demo',
        probeResult: {
          ok: true,
          sessionSlug: 'edge',
          telegramOnly: true,
          telegramBridgeEnabled: true,
        },
      }),
    ).toBe('onchain');
  });

  it.each(['telegram', 'agent'])(
    'reads the stored %s backend through the compatibility boundary',
    (sessionBackendKind) => {
      expect(isHostedAgentSessionConfig({ sessionBackendKind })).toBe(true);
      expect(resolveSessionBackendKind({ sessionConfig: { sessionBackendKind } })).toBe('agent');
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
      expect(resolveSessionBackendKind({ sessionConfig: { sessionBackendKind, sessionModeProfile: profile } })).toBe(
        'onchain',
      );
    },
  );

  it('defaults ordinary sessions to onchain', () => {
    expect(isHostedAgentSessionConfig({ sessionMode: 'standard' })).toBe(false);
    expect(resolveSessionBackendKind({ sessionConfig: { sessionMode: 'standard' } })).toBe('onchain');
  });
});
