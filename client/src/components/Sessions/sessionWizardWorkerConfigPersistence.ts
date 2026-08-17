import sha256 from 'crypto-js/sha256';
import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
  type DiscoveryEnvironment,
} from '../../utilities/session/sessionWorkerDiscovery';
import { classifySessionModeProfileSupport, type SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { CHIPOTLE_LIT_CONFIG_FIELDS } from './sessionWizardWorkerSecretSupport';

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
  sleep?: ((delayMs: number) => Promise<void>) | null;
  retryDelaysMs?: readonly number[];
  environment?: DiscoveryEnvironment;
};

export type VerifiedSessionWizardWorkerConfig = {
  workerOrigin: string;
  configRevision: string;
  publicConfig: UnknownRecord;
};

// Cloudflare KV may serve a stale or missing value for roughly a minute after a
// successful write. Keep the default horizon production-realistic while tests
// inject bounded zero/small delays through the existing port.
export const SESSION_WIZARD_WORKER_CONFIG_VISIBILITY_RETRY_DELAYS_MS = Object.freeze([
  250, 500, 1_000, 2_000, 4_000, 8_000, 12_000, 16_000, 17_000,
]);
const RETRYABLE_CONFIG_READ_STATUSES = new Set([404, 408, 425, 429]);
const isRetryableConfigReadStatus = (status: number): boolean =>
  RETRYABLE_CONFIG_READ_STATUSES.has(status) || (status >= 500 && status <= 599);
const WORKER_CANONICAL_PUBLICATION_REVISION_KEY = 'workerCanonicalPublicationRevision';
const PUBLIC_WORKER_CONFIG_FIELDS = Object.freeze([
  'slug',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'sessionName',
  'sessionInfo',
  'appearance',
  'sessionHeaderImg',
  'sessionEndsAt',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'questionsGenPrompt',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'adminAddress',
  'adminAddresses',
  'corsWorkerUrl',
  'allowOrigins',
  'sessionModeProfile',
  'workerAuthority',
  'groupCreationPolicy',
  'storageProfile',
  'ai',
  'limits',
  'scopes',
  'blockLimits',
  'contracts',
  'registryChainId',
  'networkChainId',
  'embeddedDeployHelperEnabled',
]);
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const REVISION_PATTERN = /^[a-z0-9._:-]{1,128}$/i;
const LIT_CREDENTIAL_DESCRIPTOR_FIELDS = new Set<string>(CHIPOTLE_LIT_CONFIG_FIELDS);

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const normalizeSlug = (value: unknown): string =>
  toTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

const normalizeSessionId = normalizeWorkerCanonicalSessionIdHex;

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

const hasUrlCredentials = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return false;
  try {
    const parsed = new URL(value);
    return !!parsed.username || !!parsed.password;
  } catch {
    return false;
  }
};

const cloneLitCredentialsDescriptor = (value: unknown, path: string): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Secret-bearing worker config field "${path}" is not allowed.`);
  }
  return Object.entries(value as UnknownRecord).reduce((acc: UnknownRecord, [key, entry]) => {
    const nextPath = `${path}.${key}`;
    if (!LIT_CREDENTIAL_DESCRIPTOR_FIELDS.has(key) || typeof entry !== 'string' || hasUrlCredentials(entry)) {
      throw new Error(`Secret-bearing worker config field "${nextPath}" is not allowed.`);
    }
    const normalized = entry.trim();
    if (normalized) acc[key] = normalized;
    return acc;
  }, {});
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
      if (path === 'config' && key === 'litCredentials') {
        next[key] = cloneLitCredentialsDescriptor(entry, nextPath);
        continue;
      }
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

const canonicalizeRevisionInput = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeRevisionInput);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as UnknownRecord)
    .sort()
    .reduce<UnknownRecord>((result, key) => {
      const entry = (value as UnknownRecord)[key];
      if (entry !== undefined) result[key] = canonicalizeRevisionInput(entry);
      return result;
    }, {});
};

const buildExpectedPublicConfig = (config: UnknownRecord): UnknownRecord =>
  PUBLIC_WORKER_CONFIG_FIELDS.reduce<UnknownRecord>((expected, key) => {
    if (!Object.prototype.hasOwnProperty.call(config, key)) return expected;
    if (key === 'ai') {
      const ai =
        config.ai && typeof config.ai === 'object' && !Array.isArray(config.ai) ? (config.ai as UnknownRecord) : {};
      expected.ai = Object.prototype.hasOwnProperty.call(ai, 'models') ? { models: ai.models } : {};
      return expected;
    }
    expected[key] = config[key];
    return expected;
  }, {});

const verifyExpectedPublicConfigValue = (expected: unknown, actual: unknown, path: string): void => {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      throw new Error(`Worker config verification failed: public config mismatch at "${path}".`);
    }
    expected.forEach((entry, index) => verifyExpectedPublicConfigValue(entry, actual[index], `${path}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`Worker config verification failed: public config mismatch at "${path}".`);
    }
    const expectedKeys = Object.keys(expected as UnknownRecord).sort();
    const actualKeys = Object.keys(actual as UnknownRecord).sort();
    if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) {
      throw new Error(`Worker config verification failed: public config mismatch at "${path}".`);
    }
    Object.entries(expected as UnknownRecord).forEach(([key, entry]) => {
      verifyExpectedPublicConfigValue(entry, (actual as UnknownRecord)[key], `${path}.${key}`);
    });
    return;
  }
  if (!Object.is(expected, actual)) {
    throw new Error(`Worker config verification failed: public config mismatch at "${path}".`);
  }
};

const buildComparableActualPublicConfig = (config: UnknownRecord, revision: string): UnknownRecord => {
  const comparableConfig = { ...config };
  if (Object.prototype.hasOwnProperty.call(comparableConfig, WORKER_CANONICAL_PUBLICATION_REVISION_KEY)) {
    if (toTrimmedString(comparableConfig[WORKER_CANONICAL_PUBLICATION_REVISION_KEY]) !== revision) {
      throw new Error('Worker config verification failed: publication revision mismatch.');
    }
    delete comparableConfig[WORKER_CANONICAL_PUBLICATION_REVISION_KEY];
  }
  return comparableConfig;
};

const deriveConfigRevision = (value: UnknownRecord): string =>
  `config:${sha256(
    `context-engine:worker-canonical-publication:v1:${JSON.stringify(canonicalizeRevisionInput(value))}`,
  ).toString()}`;

const resolveConfigRevision = ({
  configRevision,
  derivedRevision,
}: {
  configRevision: unknown;
  derivedRevision: string;
}): string => {
  const revision = toTrimmedString(configRevision || derivedRevision);
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
  if (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    Object.prototype.hasOwnProperty.call(candidate, 'litCredentials')
  ) {
    throw new Error('Public worker config response exposed litCredentials.');
  }
  return clonePublicConfig(candidate);
};

const assertReachableWorkerCanonicalProfile = (profile: unknown, context: string): SessionModeProfile => {
  const support = classifySessionModeProfileSupport(profile);
  if (support.status !== 'reachable') {
    const firstIssue = support.validation.issues[0];
    throw new Error(
      `${context} failed: unsupported session mode profile${
        firstIssue ? ` at "${firstIssue.path || 'profile'}" (${firstIssue.code})` : ''
      }.`,
    );
  }
  const reachableProfile = profile as SessionModeProfile;
  if (reachableProfile.authority.mode !== 'worker_canonical') {
    throw new Error(`${context} is not worker_canonical.`);
  }
  return reachableProfile;
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
  assertReachableWorkerCanonicalProfile(config.sessionModeProfile, 'Worker config verification');
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
  sleep = defaultSleep,
  retryDelaysMs = SESSION_WIZARD_WORKER_CONFIG_VISIBILITY_RETRY_DELAYS_MS,
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
  assertReachableWorkerCanonicalProfile(publicConfig.sessionModeProfile, 'Prepared worker config');

  const revisionConfig = { ...publicConfig };
  delete revisionConfig.configRevision;
  delete revisionConfig.workerCanonicalPublicationRevision;
  // Regression guard: transport loss after the worker commits must be
  // retryable across reloads. Hash the canonical public publication payload so
  // independent invocations produce the same server-side revision marker.
  const revision = resolveConfigRevision({
    configRevision,
    derivedRevision: deriveConfigRevision({
      config: revisionConfig,
      slug: normalizedSlug,
      sessionId: normalizedSessionId,
      adminAddress: normalizedAdminAddress,
      corsWorkerUrl: workerOrigin,
    }),
  });
  const configToPersist: UnknownRecord = {
    ...publicConfig,
    slug: normalizedSlug,
    sessionId: normalizedSessionId,
    adminAddress: normalizedAdminAddress,
    corsWorkerUrl: workerOrigin,
    configRevision: revision,
  };
  const expectedPublicConfig = buildExpectedPublicConfig(configToPersist);
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
    : [...SESSION_WIZARD_WORKER_CONFIG_VISIBILITY_RETRY_DELAYS_MS];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    let readResponse: Response;
    try {
      readResponse = await fetchImpl(`${workerOrigin}/session-config`, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'X-Session-Slug': normalizedSlug,
        },
      });
    } catch (error) {
      if (attempt >= delays.length) throw error;
      if (typeof sleep !== 'function') throw new Error('Worker config retry sleep port is unavailable.');
      await sleep(delays[attempt]);
      continue;
    }
    if (!readResponse.ok) {
      const readBody = await readResponseJson(readResponse);
      const detail = readResponseError(readBody);
      if (isRetryableConfigReadStatus(readResponse.status) && attempt < delays.length) {
        if (typeof sleep !== 'function') throw new Error('Worker config retry sleep port is unavailable.');
        await sleep(delays[attempt]);
        continue;
      }
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
      // A revision alone proves only that some write claimed this identity. Verify
      // every public field this publication expected so a partial/foreign merge
      // cannot be reported as a successful canonical publication.
      verifyExpectedPublicConfigValue(
        expectedPublicConfig,
        buildComparableActualPublicConfig(verifiedPublicConfig, revision),
        'config',
      );
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
