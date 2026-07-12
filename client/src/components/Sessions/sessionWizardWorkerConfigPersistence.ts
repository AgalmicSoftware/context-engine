import {
  parseSessionWorkerDiscoveryOrigin,
  type DiscoveryEnvironment,
} from '../../utilities/session/sessionWorkerDiscovery';

type UnknownRecord = Record<string, unknown>;

export type SessionWizardWorkerConfigSignInput = {
  action: 'set-config';
  body: SessionWizardWorkerConfigWriteBody;
  targetSlug: string;
  workerUrl: string;
};

export type SessionWizardWorkerConfigWriteBody = {
  sessionSlug: string;
  adminAddress: string;
  config: UnknownRecord;
};

export type SessionWizardWorkerConfigSignPort = (input: SessionWizardWorkerConfigSignInput) => Promise<UnknownRecord>;

export type SessionWizardWorkerConfigFetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type PersistAndVerifySessionWizardWorkerConfigInput = {
  workerUrl: unknown;
  slug: unknown;
  sessionId: unknown;
  adminAddress: unknown;
  config: unknown;
  signAdminAction: SessionWizardWorkerConfigSignPort;
  fetchImpl?: SessionWizardWorkerConfigFetchPort;
  configRevision?: unknown;
  randomRevision?: (() => unknown) | null;
  sleep?: ((delayMs: number) => Promise<void>) | null;
  retryDelaysMs?: readonly number[];
  environment?: DiscoveryEnvironment;
};

export type VerifiedSessionWizardWorkerConfig = {
  workerOrigin: string;
  configRevision: string;
  publicConfig: UnknownRecord;
};

const DEFAULT_RETRY_DELAYS_MS = Object.freeze([100, 250, 500]);
const SESSION_ID_PATTERN = /^0x[0-9a-f]{32}$/;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const REVISION_PATTERN = /^[a-z0-9._:-]{1,128}$/i;

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const normalizeSlug = (value: unknown): string =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

const normalizeSessionId = (value: unknown): string => {
  const normalized = toTrimmedString(value).toLowerCase().replace(/-/g, '');
  const withPrefix = normalized.startsWith('0x') ? normalized : `0x${normalized}`;
  return SESSION_ID_PATTERN.test(withPrefix) ? withPrefix : '';
};

const normalizeAdminAddress = (value: unknown): string => {
  const normalized = toTrimmedString(value).toLowerCase();
  return ADDRESS_PATTERN.test(normalized) ? normalized : '';
};

const normalizeSecretFieldKey = (value: unknown): string =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const isSecretBearingConfigField = (key: unknown): boolean => {
  const normalized = normalizeSecretFieldKey(key);
  if (!normalized) return false;
  if (normalized === 'secret' || normalized === 'secrets') return true;
  if (normalized.endsWith('token')) return true;
  if (normalized.endsWith('apikey')) return true;
  if (normalized.endsWith('privatekey') || normalized.endsWith('secretkey')) return true;
  if (normalized.endsWith('jwk')) return true;
  if (normalized === 'aikey') return true;
  if (/^(openai|anthropic|openrouter|gemini|googleai|mistral|groq)(api)?key$/.test(normalized)) return true;
  if (normalized === 'litcredentials') return true;
  if (normalized.startsWith('rpc') || normalized.startsWith('customrpc')) return true;
  if (normalized.startsWith('faucet')) return true;
  return false;
};

const clonePublicConfigValue = (value: unknown, path: string, seen: WeakSet<object>): unknown => {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Worker config field "${path}" must be JSON-safe.`);
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error(`Worker config field "${path}" must be JSON-safe.`);
  }
  if (seen.has(value)) throw new Error(`Worker config field "${path}" must not be circular.`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => clonePublicConfigValue(entry, `${path}[${index}]`, seen));
    }

    const source = value as UnknownRecord;
    const next: UnknownRecord = {};
    for (const [key, entry] of Object.entries(source)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (
        isSecretBearingConfigField(key) &&
        !(normalizeSecretFieldKey(key).startsWith('exposes') && typeof entry === 'boolean')
      ) {
        throw new Error(`Secret-bearing worker config field "${nextPath}" is not allowed.`);
      }
      next[key] = clonePublicConfigValue(entry, nextPath, seen);
    }
    return next;
  } finally {
    seen.delete(value);
  }
};

const clonePublicConfig = (value: unknown): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Prepared worker config must be an object.');
  }
  return clonePublicConfigValue(value, 'config', new WeakSet()) as UnknownRecord;
};

const defaultRandomRevision = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`;
};

const resolveConfigRevision = ({
  configRevision,
  randomRevision,
}: Pick<PersistAndVerifySessionWizardWorkerConfigInput, 'configRevision' | 'randomRevision'>): string => {
  const revision = toTrimmedString(
    configRevision || (typeof randomRevision === 'function' ? randomRevision() : defaultRandomRevision()),
  );
  if (!REVISION_PATTERN.test(revision)) {
    throw new Error('Worker config revision must be a non-secret identifier of 1-128 safe characters.');
  }
  return revision;
};

const defaultSleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, delayMs));
  });

const readResponseJson = async (response: Response): Promise<UnknownRecord> => {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as UnknownRecord) : {};
};

const readResponseError = (body: UnknownRecord): string =>
  toTrimmedString(body.error || body.message || body.statusMessage);

const getPublicConfigFromResponse = (body: UnknownRecord): UnknownRecord => {
  const candidate = body.config || body.sessionConfig || body;
  return clonePublicConfig(candidate);
};

const verifyCriticalWorkerConfigFields = ({
  config,
  slug,
  sessionId,
  workerOrigin,
  environment,
}: {
  config: UnknownRecord;
  slug: string;
  sessionId: string;
  workerOrigin: string;
  environment?: DiscoveryEnvironment;
}): void => {
  if (normalizeSlug(config.slug) !== slug) {
    throw new Error('Worker config verification failed: session slug mismatch.');
  }
  if (normalizeSessionId(config.sessionIdHex || config.sessionId) !== sessionId) {
    throw new Error('Worker config verification failed: session ID mismatch.');
  }
  const profile =
    config.sessionModeProfile && typeof config.sessionModeProfile === 'object'
      ? (config.sessionModeProfile as UnknownRecord)
      : {};
  const authority =
    profile.authority && typeof profile.authority === 'object' ? (profile.authority as UnknownRecord) : {};
  if (authority.mode !== 'worker_canonical') {
    throw new Error('Worker config verification failed: authority profile is not worker_canonical.');
  }
  let representedWorkerOrigin = '';
  try {
    representedWorkerOrigin = parseSessionWorkerDiscoveryOrigin(config.corsWorkerUrl, { environment });
  } catch {
    representedWorkerOrigin = '';
  }
  if (representedWorkerOrigin !== workerOrigin) {
    throw new Error('Worker config verification failed: CORS worker origin mismatch.');
  }
};

export const persistAndVerifySessionWizardWorkerConfig = async ({
  workerUrl,
  slug,
  sessionId,
  adminAddress,
  config,
  signAdminAction,
  fetchImpl = globalThis.fetch.bind(globalThis),
  configRevision,
  randomRevision = null,
  sleep = defaultSleep,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  environment,
}: PersistAndVerifySessionWizardWorkerConfigInput): Promise<VerifiedSessionWizardWorkerConfig> => {
  let workerOrigin = '';
  try {
    workerOrigin = parseSessionWorkerDiscoveryOrigin(workerUrl, { environment });
  } catch {
    throw new Error('A validated worker origin is required.');
  }
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) throw new Error('A valid session slug is required for worker config persistence.');
  const normalizedSessionId = normalizeSessionId(sessionId);
  if (!normalizedSessionId) throw new Error('A valid 16-byte session ID is required for worker config persistence.');
  const normalizedAdminAddress = normalizeAdminAddress(adminAddress);
  if (!normalizedAdminAddress) throw new Error('A valid admin address is required for worker config persistence.');
  if (typeof signAdminAction !== 'function') throw new Error('Worker config signing is unavailable.');
  if (typeof fetchImpl !== 'function') throw new Error('Worker config transport is unavailable.');

  const publicConfig = clonePublicConfig(config);
  const profile =
    publicConfig.sessionModeProfile && typeof publicConfig.sessionModeProfile === 'object'
      ? (publicConfig.sessionModeProfile as UnknownRecord)
      : {};
  const authority =
    profile.authority && typeof profile.authority === 'object' ? (profile.authority as UnknownRecord) : {};
  if (authority.mode !== 'worker_canonical') {
    throw new Error('Prepared worker config must declare authority.mode "worker_canonical".');
  }

  const revision = resolveConfigRevision({ configRevision, randomRevision });
  const configToPersist: UnknownRecord = {
    ...publicConfig,
    slug: normalizedSlug,
    sessionId: normalizedSessionId,
    adminAddress: normalizedAdminAddress,
    corsWorkerUrl: workerOrigin,
    configRevision: revision,
  };
  const requestBody: SessionWizardWorkerConfigWriteBody = {
    sessionSlug: normalizedSlug,
    adminAddress: normalizedAdminAddress,
    config: configToPersist,
  };
  const auth = await signAdminAction({
    action: 'set-config',
    body: requestBody,
    targetSlug: normalizedSlug,
    workerUrl: workerOrigin,
  });
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw new Error('Worker config signing returned an invalid authorization payload.');
  }

  const writeResponse = await fetchImpl(`${workerOrigin}/admin/set-config`, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...auth, ...requestBody }),
  });
  if (!writeResponse.ok) {
    const writeBody = await readResponseJson(writeResponse);
    const detail = readResponseError(writeBody);
    throw new Error(`Worker config write failed (${writeResponse.status})${detail ? `: ${detail}` : '.'}`);
  }

  const delays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs.map((delay) => Math.max(0, Number(delay) || 0))
    : [...DEFAULT_RETRY_DELAYS_MS];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const readResponse = await fetchImpl(`${workerOrigin}/session-config`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'X-Session-Slug': normalizedSlug,
      },
    });
    if (!readResponse.ok) {
      const readBody = await readResponseJson(readResponse);
      const detail = readResponseError(readBody);
      throw new Error(`Worker config read failed (${readResponse.status})${detail ? `: ${detail}` : '.'}`);
    }

    const readBody = await readResponseJson(readResponse);
    const verifiedPublicConfig = getPublicConfigFromResponse(readBody);
    verifyCriticalWorkerConfigFields({
      config: verifiedPublicConfig,
      slug: normalizedSlug,
      sessionId: normalizedSessionId,
      workerOrigin,
      environment,
    });
    if (toTrimmedString(verifiedPublicConfig.configRevision) === revision) {
      return {
        workerOrigin,
        configRevision: revision,
        publicConfig: verifiedPublicConfig,
      };
    }

    if (attempt < delays.length) {
      if (typeof sleep !== 'function') throw new Error('Worker config retry sleep port is unavailable.');
      await sleep(delays[attempt]);
    }
  }

  throw new Error(`Timed out waiting for worker config revision "${revision}".`);
};
