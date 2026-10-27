import { normalizeWorkerUrl } from '../worker/workerUrl.js';
import { normalizeWorkerCanonicalSessionIdHex } from './sessionWorkerDiscovery.js';
import { normalizeSessionSlugAlias as normalizeSessionSlug, sessionSlugStorageKey } from './sessionSlug';

type UnknownRecord = Record<string, unknown>;

export type AgentClientCapabilities = Record<string, boolean>;

export type AgentClientCredential = {
  kind: string;
  token: string;
  expiresAt?: string;
};

export type AgentClientLoginEnvelope = {
  v: 3;
  sessionId?: string;
  sessionSlug: string;
  expiresAt: string;
  address: string;
  capabilities: AgentClientCapabilities;
  agentCredential: AgentClientCredential;
  workerCredential: AgentClientCredential;
  workerUrl?: string;
  agentWorkerUrl?: string;
  buckets?: unknown;
};

export type AgentClientTokenValidation = {
  ok: boolean;
  token: string;
  reason?: string;
};

export type ExchangeAgentClientLoginArgs = {
  agentWorkerUrl: string;
  sessionId?: unknown;
  sessionSlug: string;
  tokenOrLink: string;
  workerUrl?: unknown;
  fetchImpl?: typeof fetch;
};

export type AgentClientLoginIdentityTarget = {
  agentWorkerUrl?: unknown;
  sessionId?: unknown;
  sessionSlug: unknown;
  workerUrl?: unknown;
};

const STORAGE_PREFIX = 'ce:agentClientLogin:v3';
const RAW_AGENT_TOKEN_RE = /^ceagt_[A-Za-z0-9_-]{16,}$/;
const agentClientLoginMemoryCache = new Map<string, string>();

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStr = (value: unknown): string => String(value ?? '').trim();

const normalizeIdentityTarget = (
  target: unknown | AgentClientLoginIdentityTarget,
): {
  agentWorkerUrl: string;
  sessionId: string;
  sessionSlug: string;
  workerUrl: string;
} => {
  const source =
    target && typeof target === 'object' && !Array.isArray(target)
      ? (target as AgentClientLoginIdentityTarget)
      : ({ sessionSlug: target } as AgentClientLoginIdentityTarget);
  return {
    sessionSlug: normalizeSessionSlug(source.sessionSlug),
    sessionId: normalizeWorkerCanonicalSessionIdHex(source.sessionId),
    workerUrl: normalizeWorkerUrl(toStr(source.workerUrl)),
    agentWorkerUrl: normalizeWorkerUrl(toStr(source.agentWorkerUrl)),
  };
};

const storageSlugPart = (sessionSlug: unknown): string => encodeURIComponent(sessionSlugStorageKey(sessionSlug));

const storageKey = (target: unknown | AgentClientLoginIdentityTarget): string => {
  const identity = normalizeIdentityTarget(target);
  return [
    STORAGE_PREFIX,
    storageSlugPart(identity.sessionSlug),
    encodeURIComponent(identity.sessionId || 'no-session-id'),
    encodeURIComponent(identity.workerUrl || 'no-worker-origin'),
    encodeURIComponent(identity.agentWorkerUrl || 'no-bridge-origin'),
  ].join(':');
};

const identityTargetForEnvelope = (envelope: AgentClientLoginEnvelope): AgentClientLoginIdentityTarget => ({
  sessionSlug: envelope.sessionSlug,
  sessionId: envelope.sessionId,
  workerUrl: envelope.workerUrl,
  agentWorkerUrl: envelope.agentWorkerUrl,
});

export const agentClientLoginEnvelopeMatchesIdentity = (
  envelope: AgentClientLoginEnvelope | null,
  target: unknown | AgentClientLoginIdentityTarget,
): boolean => {
  if (!envelope) return false;
  const expected = normalizeIdentityTarget(target);
  const actual = normalizeIdentityTarget(identityTargetForEnvelope(envelope));
  if (actual.sessionSlug !== expected.sessionSlug) return false;
  if (expected.sessionId && actual.sessionId !== expected.sessionId) return false;
  if (expected.workerUrl && actual.workerUrl !== expected.workerUrl) return false;
  if (expected.agentWorkerUrl && actual.agentWorkerUrl !== expected.agentWorkerUrl) return false;
  if (!actual.workerUrl || actual.agentWorkerUrl !== actual.workerUrl) return false;
  if (envelope.capabilities?.readGroups === true) {
    return (
      !!expected.sessionId &&
      !!expected.workerUrl &&
      actual.sessionId === expected.sessionId &&
      actual.workerUrl === expected.workerUrl
    );
  }
  return true;
};

const sessionStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage || null;
  } catch (_) {
    return null;
  }
};

const purgePersistedAgentClientLoginEnvelopes = (): void => {
  const storage = sessionStorageSafe();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && key.startsWith('ce:agentClientLogin:')) {
        storage.removeItem(key);
      }
    }
  } catch (_) {}
};

// Purge historical tab-persistent credentials on startup.
// Remove those records at startup; current credentials live only in page memory.
purgePersistedAgentClientLoginEnvelopes();

export const extractAgentClientToken = (input: unknown): AgentClientTokenValidation => {
  const text = toStr(input);
  if (!text) return { ok: false, token: '', reason: 'empty' };
  if (/[\r\n]/.test(text)) return { ok: false, token: '', reason: 'multiline' };
  if (!RAW_AGENT_TOKEN_RE.test(text)) {
    return { ok: false, token: '', reason: 'unsupported_format' };
  }
  return { ok: true, token: text };
};

const normalizeCapabilities = (input: unknown): AgentClientCapabilities => {
  const source = toRecord(input);
  const out: AgentClientCapabilities = {};
  Object.entries(source).forEach(([key, value]) => {
    out[key] = value === true;
  });
  return out;
};

const normalizeClientLoginFailureReason = (value: unknown, status: number): string => {
  const reason = toStr(value).toLowerCase();
  const knownReason = [
    'expired',
    'session_mismatch',
    'session_identity',
    'scope_denied',
    'origin_not_allowed',
    'origin_denied',
    'not_enabled',
    'disabled',
  ].find((candidate) => reason.includes(candidate));
  return knownReason ? `agent_client_login_${knownReason}` : `agent_client_login_failed_${status}`;
};

const normalizeExchangeEnvelope = ({
  body,
  sessionSlug,
  sourceToken,
  agentWorkerUrl,
}: {
  body: UnknownRecord;
  sessionSlug: string;
  sourceToken: string;
  agentWorkerUrl: string;
}): AgentClientLoginEnvelope => {
  if (sourceToken && JSON.stringify(body).includes(sourceToken)) {
    throw new Error('agent_client_login_echoed_source_token');
  }
  const agentCredential = toRecord(body.agentCredential);
  const workerCredential = toRecord(body.workerCredential);
  if (!toStr(agentCredential.token)) throw new Error('agent_client_login_missing_bridge_credential');
  if (!toStr(workerCredential.token)) throw new Error('agent_client_login_missing_worker_credential');
  const normalizedSlug = normalizeSessionSlug(body.sessionSlug || sessionSlug);
  if (normalizedSlug !== normalizeSessionSlug(sessionSlug)) {
    throw new Error('agent_client_login_session_mismatch');
  }
  const capabilities = normalizeCapabilities(body.capabilities);
  const sessionId = normalizeWorkerCanonicalSessionIdHex(body.sessionId);
  if (capabilities.readGroups && !sessionId) {
    throw new Error('agent_client_login_session_identity_missing');
  }
  const expiresAt =
    toStr(body.expiresAt) || (Number(body.exp || 0) > 0 ? new Date(Number(body.exp) * 1000).toISOString() : '');
  const address = toStr(toRecord(body.account).address || body.accountAddress || body.address);
  const envelope: AgentClientLoginEnvelope = {
    v: 3,
    ...(sessionId ? { sessionId } : {}),
    sessionSlug: normalizedSlug,
    expiresAt,
    address,
    capabilities,
    agentCredential: {
      kind: toStr(agentCredential.kind) || 'session_agent_browser_token',
      token: toStr(agentCredential.token),
      expiresAt: toStr(agentCredential.expiresAt),
    },
    workerCredential: {
      kind: toStr(workerCredential.kind) || 'session_worker_jwt',
      token: toStr(workerCredential.token),
      expiresAt: toStr(workerCredential.expiresAt),
    },
    workerUrl: normalizeWorkerUrl(toStr(body.workerUrl)),
    agentWorkerUrl: normalizeWorkerUrl(agentWorkerUrl),
    buckets: body.buckets ?? null,
  };
  return envelope;
};

const persistedEnvelope = (envelope: AgentClientLoginEnvelope): AgentClientLoginEnvelope => ({
  v: 3,
  ...(normalizeWorkerCanonicalSessionIdHex(envelope.sessionId)
    ? { sessionId: normalizeWorkerCanonicalSessionIdHex(envelope.sessionId) }
    : {}),
  sessionSlug: envelope.sessionSlug,
  expiresAt: envelope.expiresAt,
  address: envelope.address,
  capabilities: { ...(envelope.capabilities || {}) },
  agentCredential: {
    kind: envelope.agentCredential.kind,
    token: envelope.agentCredential.token,
    expiresAt: envelope.agentCredential.expiresAt,
  },
  workerCredential: {
    kind: envelope.workerCredential.kind,
    token: envelope.workerCredential.token,
    expiresAt: envelope.workerCredential.expiresAt,
  },
  workerUrl: envelope.workerUrl,
  agentWorkerUrl: envelope.agentWorkerUrl,
  buckets: null,
});

export const isAgentClientLoginEnvelopeExpired = (
  envelope: AgentClientLoginEnvelope | null,
  nowMs = Date.now(),
): boolean => {
  const expiries = [
    envelope?.expiresAt,
    envelope?.agentCredential?.expiresAt,
    envelope?.workerCredential?.expiresAt,
  ].map((value) => Date.parse(value || ''));
  return expiries.some((value) => !Number.isFinite(value) || value <= nowMs);
};

export const writeAgentClientLoginEnvelope = (envelope: AgentClientLoginEnvelope): AgentClientLoginEnvelope => {
  const persisted = persistedEnvelope(envelope);
  purgePersistedAgentClientLoginEnvelopes();
  agentClientLoginMemoryCache.set(storageKey(identityTargetForEnvelope(persisted)), JSON.stringify(persisted));
  return persisted;
};

export const readAgentClientLoginEnvelope = (
  target: unknown | AgentClientLoginIdentityTarget,
): AgentClientLoginEnvelope | null => {
  purgePersistedAgentClientLoginEnvelopes();
  const expected = normalizeIdentityTarget(target);
  const key = storageKey(expected);
  try {
    const raw = agentClientLoginMemoryCache.get(key);
    if (!raw) return null;
    const parsed = toRecord(JSON.parse(raw));
    const agentCredential = toRecord(parsed.agentCredential);
    const workerCredential = toRecord(parsed.workerCredential);
    const envelope: AgentClientLoginEnvelope = {
      v: 3,
      ...(normalizeWorkerCanonicalSessionIdHex(parsed.sessionId)
        ? { sessionId: normalizeWorkerCanonicalSessionIdHex(parsed.sessionId) }
        : {}),
      sessionSlug: normalizeSessionSlug(parsed.sessionSlug),
      expiresAt: toStr(parsed.expiresAt),
      address: toStr(parsed.address),
      capabilities: normalizeCapabilities(parsed.capabilities),
      agentCredential: {
        kind: toStr(agentCredential.kind) || 'session_agent_browser_token',
        token: toStr(agentCredential.token),
        expiresAt: toStr(agentCredential.expiresAt),
      },
      workerCredential: {
        kind: toStr(workerCredential.kind) || 'session_worker_jwt',
        token: toStr(workerCredential.token),
        expiresAt: toStr(workerCredential.expiresAt),
      },
      workerUrl: normalizeWorkerUrl(toStr(parsed.workerUrl)),
      agentWorkerUrl: normalizeWorkerUrl(toStr(parsed.agentWorkerUrl)),
      buckets: null,
    };
    if (
      !envelope.agentCredential.token ||
      !envelope.workerCredential.token ||
      (envelope.capabilities.readGroups && !envelope.sessionId) ||
      !agentClientLoginEnvelopeMatchesIdentity(envelope, expected)
    ) {
      agentClientLoginMemoryCache.delete(key);
      return null;
    }
    if (isAgentClientLoginEnvelopeExpired(envelope)) {
      agentClientLoginMemoryCache.delete(key);
      return null;
    }
    return envelope;
  } catch (_) {
    agentClientLoginMemoryCache.delete(key);
    return null;
  }
};

export const clearAgentClientLoginEnvelope = (target: unknown | AgentClientLoginIdentityTarget): void => {
  purgePersistedAgentClientLoginEnvelopes();
  const expected = normalizeIdentityTarget(target);
  const slugPrefix = `${STORAGE_PREFIX}:${storageSlugPart(expected.sessionSlug)}`;
  Array.from(agentClientLoginMemoryCache.keys()).forEach((key) => {
    if (key === slugPrefix || key.startsWith(`${slugPrefix}:`)) {
      agentClientLoginMemoryCache.delete(key);
    }
  });
};

export const buildSessionAgentAuthHeaders = (envelope: AgentClientLoginEnvelope | null): Record<string, string> =>
  envelope?.agentCredential?.token ? { Authorization: `Bearer ${envelope.agentCredential.token}` } : {};

export const exchangeAgentClientLogin = async ({
  agentWorkerUrl,
  sessionId: expectedSessionIdRaw,
  sessionSlug,
  tokenOrLink,
  workerUrl: expectedWorkerUrlRaw,
  fetchImpl = fetch,
}: ExchangeAgentClientLoginArgs): Promise<AgentClientLoginEnvelope> => {
  const bridge = normalizeWorkerUrl(agentWorkerUrl);
  if (!bridge) throw new Error('agent_client_login_worker_missing');
  if (expectedWorkerUrlRaw && normalizeWorkerUrl(toStr(expectedWorkerUrlRaw)) !== bridge)
    throw new Error('agent_client_login_origin_mismatch');
  const slug = normalizeSessionSlug(sessionSlug);
  if (!slug) throw new Error('agent_client_login_session_required');
  const validation = extractAgentClientToken(tokenOrLink);
  if (!validation.ok) throw new Error(`agent_client_login_${validation.reason}`);

  const capabilityResponse = await fetchImpl(`${bridge}/capabilities?slug=${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  const capability = toRecord(await capabilityResponse.json().catch(() => ({})));
  if (
    !capabilityResponse.ok ||
    !Array.isArray(capability.features) ||
    !capability.features.includes('agent_http_v1') ||
    toRecord(capability.agentHttp).ready !== true ||
    toRecord(capability.agentSessionWrapped).origin !== bridge
  ) {
    throw new Error('agent_client_login_worker_not_ready');
  }
  const response = await fetchImpl(`${bridge}/api/agent/client-login/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionSlug: slug,
      token: validation.token,
    }),
    cache: 'no-store',
  });
  const body = toRecord(await response.json().catch(() => ({})));
  if (!response.ok || body.ok === false) {
    throw new Error(normalizeClientLoginFailureReason(body.reason, response.status));
  }
  const envelope = normalizeExchangeEnvelope({
    body,
    sessionSlug: slug,
    sourceToken: validation.token,
    agentWorkerUrl: bridge,
  });
  const expectedSessionId = normalizeWorkerCanonicalSessionIdHex(expectedSessionIdRaw);
  const expectedWorkerUrl = normalizeWorkerUrl(toStr(expectedWorkerUrlRaw));
  if ((toStr(expectedSessionIdRaw) && !expectedSessionId) || (toStr(expectedWorkerUrlRaw) && !expectedWorkerUrl)) {
    throw new Error('agent_client_login_expected_identity_invalid');
  }
  if (envelope.capabilities.readGroups && (!expectedSessionId || !expectedWorkerUrl)) {
    throw new Error('agent_client_login_expected_identity_missing');
  }
  if (
    !agentClientLoginEnvelopeMatchesIdentity(envelope, {
      sessionSlug: slug,
      sessionId: expectedSessionId,
      workerUrl: expectedWorkerUrl,
      agentWorkerUrl: bridge,
    })
  ) {
    throw new Error('agent_client_login_session_identity_mismatch');
  }
  if (isAgentClientLoginEnvelopeExpired(envelope)) throw new Error('agent_client_login_expired');
  writeAgentClientLoginEnvelope(envelope);
  return envelope;
};
