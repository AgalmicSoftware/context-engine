export const AGENT_SESSION_WRAPPED_CAPABILITY_VERSION = 1 as const;

export type AgentSessionWrappedCapability = {
  version: typeof AGENT_SESSION_WRAPPED_CAPABILITY_VERSION;
  enabled: boolean;
  origin: string;
  protocolVersion: string;
  revision: string;
  verifiedAt: string;
};

const CAPABILITY_KEYS = new Set(['version', 'enabled', 'origin', 'protocolVersion', 'revision', 'verifiedAt']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeHttpsOrigin = (value: unknown): string => {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};

const normalizeSafeIdentifier = (value: unknown): string =>
  typeof value === 'string' && /^[a-z0-9._:-]{1,128}$/i.test(value) ? value : '';

const normalizeIsoTime = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return '';
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : '';
};

export const normalizeAgentSessionWrappedCapability = (value: unknown): AgentSessionWrappedCapability | null => {
  if (!isRecord(value) || Object.keys(value).some((key) => !CAPABILITY_KEYS.has(key))) return null;
  if (value.version !== AGENT_SESSION_WRAPPED_CAPABILITY_VERSION || typeof value.enabled !== 'boolean') {
    return null;
  }
  const origin = normalizeHttpsOrigin(value.origin);
  const protocolVersion = normalizeSafeIdentifier(value.protocolVersion);
  const revision = normalizeSafeIdentifier(value.revision);
  const verifiedAt = normalizeIsoTime(value.verifiedAt);
  if (!origin || !protocolVersion || !revision || !verifiedAt) return null;
  return {
    version: AGENT_SESSION_WRAPPED_CAPABILITY_VERSION,
    enabled: value.enabled,
    origin,
    protocolVersion,
    revision,
    verifiedAt,
  };
};
