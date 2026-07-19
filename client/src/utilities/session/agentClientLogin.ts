import { normalizeWorkerUrl } from '../worker/workerUrl.js';

type UnknownRecord = Record<string, unknown>;

export type AgentClientCapabilities = Record<string, boolean>;

export type AgentClientCredential = {
  kind: string;
  token: string;
  expiresAt?: string;
};

export type AgentClientLoginEnvelope = {
  v: 2;
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
  sessionSlug: string;
  tokenOrLink: string;
  fetchImpl?: typeof fetch;
};

const STORAGE_PREFIX = 'ce:agentClientLogin:v2';
const RAW_AGENT_TOKEN_RE = /ceagt_[A-Za-z0-9_-]{16,}/;

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const toStr = (value: unknown): string => String(value ?? '').trim();

const normalizeSessionSlug = (value: unknown): string => {
  const slug = toStr(value).toLowerCase();
  return slug === 'general' ? '' : slug;
};

const storageKey = (sessionSlug: unknown): string =>
  `${STORAGE_PREFIX}:${encodeURIComponent(normalizeSessionSlug(sessionSlug) || 'general')}`;

const sessionStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage || null;
  } catch (_) {
    return null;
  }
};

const extractTokenFromUrl = (input: string): string => {
  try {
    const parsed = new URL(input);
    const fromParams = [
      parsed.searchParams.get('token'),
      parsed.searchParams.get('agentToken'),
      parsed.searchParams.get('telegramToken'),
      parsed.searchParams.get('ceagt'),
    ]
      .map(toStr)
      .find((candidate) => RAW_AGENT_TOKEN_RE.test(candidate));
    if (fromParams) return fromParams.match(RAW_AGENT_TOKEN_RE)?.[0] || '';
    return input.match(RAW_AGENT_TOKEN_RE)?.[0] || '';
  } catch (_) {
    return input.match(RAW_AGENT_TOKEN_RE)?.[0] || '';
  }
};

export const extractAgentClientToken = (input: unknown): AgentClientTokenValidation => {
  const text = toStr(input);
  if (!text) return { ok: false, token: '', reason: 'empty' };
  if (/[\r\n]/.test(text)) return { ok: false, token: '', reason: 'multiline' };
  const token = text.startsWith('ceagt_') ? text : extractTokenFromUrl(text);
  if (!RAW_AGENT_TOKEN_RE.test(token) || token !== text.match(RAW_AGENT_TOKEN_RE)?.[0]) {
    return { ok: false, token: '', reason: 'unsupported_format' };
  }
  return { ok: true, token };
};

const normalizeCapabilities = (input: unknown): AgentClientCapabilities => {
  const source = toRecord(input);
  const out: AgentClientCapabilities = {};
  Object.entries(source).forEach(([key, value]) => {
    out[key] = value === true;
  });
  return out;
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
  const expiresAt =
    toStr(body.expiresAt) || (Number(body.exp || 0) > 0 ? new Date(Number(body.exp) * 1000).toISOString() : '');
  const address = toStr(toRecord(body.account).address || body.accountAddress || body.address);
  const envelope: AgentClientLoginEnvelope = {
    v: 2,
    sessionSlug: normalizedSlug,
    expiresAt,
    address,
    capabilities: normalizeCapabilities(body.capabilities),
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
  const storage = sessionStorageSafe();
  const persisted = persistedEnvelope(envelope);
  if (storage) {
    storage.setItem(storageKey(persisted.sessionSlug), JSON.stringify(persisted));
  }
  return persisted;
};

export const readAgentClientLoginEnvelope = (sessionSlug: unknown): AgentClientLoginEnvelope | null => {
  const storage = sessionStorageSafe();
  if (!storage) return null;
  const key = storageKey(sessionSlug);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = toRecord(JSON.parse(raw));
    const bridgeCredential = toRecord(parsed.bridgeCredential);
    const workerCredential = toRecord(parsed.workerCredential);
    const envelope: AgentClientLoginEnvelope = {
      v: 2,
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
      envelope.sessionSlug !== normalizeSessionSlug(sessionSlug)
    ) {
      storage.removeItem(key);
      return null;
    }
    if (isAgentClientLoginEnvelopeExpired(envelope)) {
      storage.removeItem(key);
      return null;
    }
    return envelope;
  } catch (_) {
    storage.removeItem(key);
    return null;
  }
};

export const clearAgentClientLoginEnvelope = (sessionSlug: unknown): void => {
  const storage = sessionStorageSafe();
  if (storage) storage.removeItem(storageKey(sessionSlug));
};

export const buildAgentBridgeAuthHeaders = (envelope: AgentClientLoginEnvelope | null): Record<string, string> =>
  envelope?.bridgeCredential?.token ? { Authorization: `Bearer ${envelope.bridgeCredential.token}` } : {};

export const exchangeAgentClientLogin = async ({
  agentBridgeUrl,
  sessionSlug,
  tokenOrLink,
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
    throw new Error(toStr(body.reason) || `telegram_client_login_failed_${response.status}`);
  }
  const envelope = normalizeExchangeEnvelope({
    body,
    sessionSlug: slug,
    sourceToken: validation.token,
    agentBridgeUrl: bridge,
  });
  writeAgentClientLoginEnvelope(envelope);
  return envelope;
};

export const __test__agentClientStorageKey = storageKey;
