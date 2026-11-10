import { isHostedAgentSessionConfig, resolveSessionBackendKind } from './sessionBackendKind';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from './sessionModeProfile';

describe('sessionBackendKind', () => {
  it('enables hosted agent HTTP sessions while both retired surfaces are off', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.agentHttp = true;
    profile.surfaces.telegram = false;
    profile.surfaces.miniApp = false;
    expect(isHostedAgentSessionConfig({ sessionModeProfile: profile })).toBe(true);
    expect(resolveSessionBackendKind({ sessionConfig: { sessionModeProfile: profile } })).toBe('agent');
  });

  it('keeps explicit HTTP-off profiles authoritative over the probe', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.telegram = true;
    profile.surfaces.agentHttp = false;
    const sessionConfig = { sessionModeProfile: profile };
    expect(isHostedAgentSessionConfig(sessionConfig)).toBe(false);
    expect(
      resolveSessionBackendKind({
        sessionConfig,
        probeResult: { authorityMode: 'worker_canonical', agentHttpEnabled: true },
      }),
    ).toBe('onchain');
  });

  it('does not enable the agent shell for registry authority or a malformed explicit profile', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    profile.surfaces.agentHttp = true;
    expect(isHostedAgentSessionConfig({ sessionModeProfile: profile })).toBe(false);
    expect(isHostedAgentSessionConfig({ sessionModeProfile: null })).toBe(false);
  });

  it('uses session-meta probe results when config is not locally available', () => {
    expect(
      resolveSessionBackendKind({
        sessionConfig: {},
        probeResult: { ok: true, authorityMode: 'worker_canonical', agentHttpEnabled: true },
      }),
    ).toBe('agent');
  });

  it('accepts neutral hosted HTTP probe metadata and honors its explicit off value', () => {
    const enabled = { ok: true, authorityMode: 'worker_canonical', agentHttpEnabled: true };
    expect(resolveSessionBackendKind({ probeResult: enabled })).toBe('agent');
    expect(resolveSessionBackendKind({ probeResult: { ...enabled, agentHttpEnabled: false } })).toBe('onchain');
  });

  it('ignores stale session-meta probe results from a different session slug', () => {
    expect(
      resolveSessionBackendKind({
        sessionConfig: { slug: 'demo' },
        sessionSlug: 'demo',
        probeResult: {
          ok: true,
          sessionSlug: 'edge',
          authorityMode: 'worker_canonical',
          agentHttpEnabled: true,
        },
      }),
    ).toBe('onchain');
  });

  it('defaults ordinary sessions to onchain', () => {
    expect(isHostedAgentSessionConfig({ slug: 'demo' })).toBe(false);
    expect(resolveSessionBackendKind({ sessionConfig: { slug: 'demo' } })).toBe('onchain');
  });
});
