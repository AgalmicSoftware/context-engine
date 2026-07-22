import {
  AGENT_SESSION_WRAPPED_CAPABILITY_VERSION,
  normalizeAgentSessionWrappedCapability,
} from './agentSessionWrapped';

describe('Agent Session Wrapped capability', () => {
  const enabled = {
    version: 1,
    enabled: true,
    origin: 'https://wrapped.example.workers.dev/',
    protocolVersion: 'agent-session-wrapped-v1',
    revision: 'wrapped-revision-1',
    verifiedAt: '2026-07-20T18:00:00.000Z',
  };

  it('normalizes one safe versioned public-config record', () => {
    expect(normalizeAgentSessionWrappedCapability(enabled)).toEqual({
      ...enabled,
      origin: 'https://wrapped.example.workers.dev',
    });
    expect(AGENT_SESSION_WRAPPED_CAPABILITY_VERSION).toBe(1);
  });

  it.each([
    ['wrong version', { ...enabled, version: 2 }],
    ['non-HTTPS origin', { ...enabled, origin: 'http://wrapped.example.test' }],
    ['origin path', { ...enabled, origin: 'https://wrapped.example.test/path' }],
    ['missing protocol', { ...enabled, protocolVersion: '' }],
    ['unsafe revision', { ...enabled, revision: 'revision with spaces' }],
    ['invalid verification time', { ...enabled, verifiedAt: 'not-a-date' }],
    ['secret-shaped extras', { ...enabled, cloudflareApiToken: 'secret' }],
  ])('rejects %s', (_label, value) => {
    expect(normalizeAgentSessionWrappedCapability(value)).toBeNull();
  });
});
