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
  v: 2;
  sessionId?: string;
  sessionSlug: string;
  expiresAt: string;
  address: string;
  capabilities: AgentClientCapabilities;
  bridgeCredential: AgentClientCredential;
  workerCredential: AgentClientCredential;
  workerUrl?: string;
  agentBridgeUrl?: string;
  buckets?: unknown;
};

export type AgentClientTokenValidation = {
  ok: boolean;
  token: string;
  reason?: string;
};

export type ExchangeAgentClientLoginArgs = {
  agentBridgeUrl: string;
  sessionId?: unknown;
  sessionSlug: string;
  tokenOrLink: string;
  workerUrl?: unknown;
  fetchImpl?: typeof fetch;
};

export type AgentClientLoginIdentityTarget = {
  agentBridgeUrl?: unknown;
  sessionId?: unknown;
  sessionSlug: unknown;
  workerUrl?: unknown;
};

const STORAGE_PREFIX = 'ce:agentClientLogin:v2';
const RAW_AGENT_TOKEN_RE = /^ceagt_[A-Za-z0-9_-]{16,}$/;
const agentClientLoginMemoryCache = new Map<string, string>();

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStr = (value: unknown): string => String(value ?? '').trim();

const normalizeIdentityTarget = (
  target: unknown | AgentClientLoginIdentityTarget,
): {
  agentBridgeUrl: string;
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
    agentBridgeUrl: normalizeWorkerUrl(toStr(source.agentBridgeUrl)),
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
    encodeURIComponent(identity.agentBridgeUrl || 'no-bridge-origin'),
  ].join(':');
};

const identityTargetForEnvelope = (envelope: AgentClientLoginEnvelope): AgentClientLoginIdentityTarget => ({
  sessionSlug: envelope.sessionSlug,
  sessionId: envelope.sessionId,
  workerUrl: envelope.workerUrl,
  agentBridgeUrl: envelope.agentBridgeUrl,
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
  if (expected.agentBridgeUrl && actual.agentBridgeUrl !== expected.agentBridgeUrl) return false;
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
      if (key && (key === STORAGE_PREFIX || key.startsWith(`${STORAGE_PREFIX}:`))) {
        storage.removeItem(key);
      }
    }
  } catch (_) {}
};

// Exchanged Bridge and Worker bearer credentials used to be tab-persistent.
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
  return knownReason ? `telegram_client_login_${knownReason}` : `telegram_client_login_failed_${status}`;
};

const normalizeExchangeEnvelope = ({
  body,
  sessionSlug,
  sourceToken,
  agentBridgeUrl,
}: {
  body: UnknownRecord;
  sessionSlug: string;
  sourceToken: string;
  agentBridgeUrl: string;
}): AgentClientLoginEnvelope => {
  if (sourceToken && JSON.stringify(body).includes(sourceToken)) {
    throw new Error('telegram_client_login_echoed_source_token');
  }
  const bridgeCredential = toRecord(body.bridgeCredential);
  const workerCredential = toRecord(body.workerCredential);
  if (!toStr(bridgeCredential.token)) throw new Error('telegram_client_login_missing_bridge_credential');
  if (!toStr(workerCredential.token)) throw new Error('telegram_client_login_missing_worker_credential');
  const normalizedSlug = normalizeSessionSlug(body.sessionSlug || sessionSlug);
  if (normalizedSlug !== normalizeSessionSlug(sessionSlug)) {
    throw new Error('telegram_client_login_session_mismatch');
  }
  const capabilities = normalizeCapabilities(body.capabilities);
  const sessionId = normalizeWorkerCanonicalSessionIdHex(body.sessionId);
  if (capabilities.readGroups && !sessionId) {
    throw new Error('telegram_client_login_session_identity_missing');
  }
  const expiresAt =
    toStr(body.expiresAt) || (Number(body.exp || 0) > 0 ? new Date(Number(body.exp) * 1000).toISOString() : '');
  const address = toStr(toRecord(body.account).address || body.accountAddress || body.address);
  const envelope: AgentClientLoginEnvelope = {
    v: 2,
    ...(sessionId ? { sessionId } : {}),
    sessionSlug: normalizedSlug,
    expiresAt,
    address,
    capabilities,
    bridgeCredential: {
      kind: toStr(bridgeCredential.kind) || 'agent_bridge_browser_token',
      token: toStr(bridgeCredential.token),
      expiresAt: toStr(bridgeCredential.expiresAt),
    },
    workerCredential: {
      kind: toStr(workerCredential.kind) || 'session_worker_jwt',
      token: toStr(workerCredential.token),
      expiresAt: toStr(workerCredential.expiresAt),
    },
    workerUrl: normalizeWorkerUrl(toStr(body.workerUrl)),
    agentBridgeUrl: normalizeWorkerUrl(agentBridgeUrl),
    buckets: body.buckets ?? null,
  };
  return envelope;
};

const persistedEnvelope = (envelope: AgentClientLoginEnvelope): AgentClientLoginEnvelope => ({
  v: 2,
  ...(normalizeWorkerCanonicalSessionIdHex(envelope.sessionId)
    ? { sessionId: normalizeWorkerCanonicalSessionIdHex(envelope.sessionId) }
    : {}),
  sessionSlug: envelope.sessionSlug,
  expiresAt: envelope.expiresAt,
  address: envelope.address,
  capabilities: { ...(envelope.capabilities || {}) },
  bridgeCredential: {
    kind: envelope.bridgeCredential.kind,
    token: envelope.bridgeCredential.token,
    expiresAt: envelope.bridgeCredential.expiresAt,
  },
  workerCredential: {
    kind: envelope.workerCredential.kind,
    token: envelope.workerCredential.token,
    expiresAt: envelope.workerCredential.expiresAt,
  },
  workerUrl: envelope.workerUrl,
  agentBridgeUrl: envelope.agentBridgeUrl,
  buckets: null,
});

export const isAgentClientLoginEnvelopeExpired = (
  envelope: AgentClientLoginEnvelope | null,
  nowMs = Date.now(),
): boolean => {
  if (!envelope?.expiresAt) return false;
  const expiresMs = Date.parse(envelope.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs <= nowMs;
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
    const bridgeCredential = toRecord(parsed.bridgeCredential);
    const workerCredential = toRecord(parsed.workerCredential);
    const envelope: AgentClientLoginEnvelope = {
      v: 2,
      ...(normalizeWorkerCanonicalSessionIdHex(parsed.sessionId)
        ? { sessionId: normalizeWorkerCanonicalSessionIdHex(parsed.sessionId) }
        : {}),
      sessionSlug: normalizeSessionSlug(parsed.sessionSlug),
      expiresAt: toStr(parsed.expiresAt),
      address: toStr(parsed.address),
      capabilities: normalizeCapabilities(parsed.capabilities),
      bridgeCredential: {
        kind: toStr(bridgeCredential.kind) || 'agent_bridge_browser_token',
        token: toStr(bridgeCredential.token),
        expiresAt: toStr(bridgeCredential.expiresAt),
      },
      workerCredential: {
        kind: toStr(workerCredential.kind) || 'session_worker_jwt',
        token: toStr(workerCredential.token),
        expiresAt: toStr(workerCredential.expiresAt),
      },
      workerUrl: normalizeWorkerUrl(toStr(parsed.workerUrl)),
      agentBridgeUrl: normalizeWorkerUrl(toStr(parsed.agentBridgeUrl)),
      buckets: null,
    };
    if (
      !envelope.bridgeCredential.token ||
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

export const buildAgentBridgeAuthHeaders = (envelope: AgentClientLoginEnvelope | null): Record<string, string> =>
  envelope?.bridgeCredential?.token ? { Authorization: `Bearer ${envelope.bridgeCredential.token}` } : {};

export const exchangeAgentClientLogin = async ({
  agentBridgeUrl,
  sessionId: expectedSessionIdRaw,
  sessionSlug,
  tokenOrLink,
  workerUrl: expectedWorkerUrlRaw,
  fetchImpl = fetch,
}: ExchangeAgentClientLoginArgs): Promise<AgentClientLoginEnvelope> => {
  const bridge = normalizeWorkerUrl(agentBridgeUrl);
  if (!bridge) throw new Error('telegram_client_login_bridge_missing');
  const slug = normalizeSessionSlug(sessionSlug);
  if (!slug) throw new Error('telegram_client_login_session_required');
  const validation = extractAgentClientToken(tokenOrLink);
  if (!validation.ok) throw new Error(`telegram_client_login_${validation.reason}`);

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
    agentBridgeUrl: bridge,
  });
  const expectedSessionId = normalizeWorkerCanonicalSessionIdHex(expectedSessionIdRaw);
  const expectedWorkerUrl = normalizeWorkerUrl(toStr(expectedWorkerUrlRaw));
  if ((toStr(expectedSessionIdRaw) && !expectedSessionId) || (toStr(expectedWorkerUrlRaw) && !expectedWorkerUrl)) {
    throw new Error('telegram_client_login_expected_identity_invalid');
  }
  if (envelope.capabilities.readGroups && (!expectedSessionId || !expectedWorkerUrl)) {
    throw new Error('telegram_client_login_expected_identity_missing');
  }
  if (
    !agentClientLoginEnvelopeMatchesIdentity(envelope, {
      sessionSlug: slug,
      sessionId: expectedSessionId,
      workerUrl: expectedWorkerUrl,
      agentBridgeUrl: bridge,
    })
  ) {
    throw new Error('telegram_client_login_session_identity_mismatch');
  }
  writeAgentClientLoginEnvelope(envelope);
  return envelope;
};

export const __test__agentClientStorageKey = storageKey;
