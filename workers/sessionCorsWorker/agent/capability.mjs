import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';

export const buildSessionAgentCapability = async ({ config, revision, origin, enabled, bundle = '' }) => {
  const data = new TextEncoder().encode(JSON.stringify([resolveCanonicalWorkerSessionIdHex(config), revision, origin, bundle]));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { version: 1, enabled, origin, protocolVersion: 'agent-session-wrapped-v1',
    revision: `wrapped-${hash.slice(0, 16)}`, verifiedAt: new Date().toISOString() };
};
