import { ANALYSIS_CARD_FEATURE } from '@ce-shared/analysisCardSaved.mjs';
import {
  PUBLIC_WORKER_AI_FIELDS,
  PUBLIC_WORKER_CONFIG_FIELDS,
  SET_CONFIG_MERGES_AI_FIELD,
  WORKER_SUPPORT_FIELDS,
} from '@ce-shared/workerSessionPublicConfig.mjs';
import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
  type DiscoveryEnvironment,
} from '../../utilities/session/sessionWorkerDiscovery';
import { classifySessionModeProfileSupport, type SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { CHIPOTLE_LIT_CONFIG_FIELDS } from './sessionWizardWorkerSecretSupport';
import { fingerprintSessionWizardJson } from './sessionWizardCanonicalJson';
import { sanitizeSessionSlug as normalizeSlug } from '../../utilities/session/sessionSlug';

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
  finalizePublication?: boolean;
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
// The Worker sets these public fields itself: the authorization epoch and the
// publication marker on writes, and response field encryption and every
// "this Worker supports X" field on every read. They are not config the
// wizard writes, so the readback check skips them.
const WORKER_MANAGED_PUBLIC_CONFIG_FIELDS = Object.freeze([
  'authzEpoch',
  WORKER_CANONICAL_PUBLICATION_REVISION_KEY,
  'responseFieldEncryption',
  ...WORKER_SUPPORT_FIELDS,
]);
// Only a finalizing write claims a revision. Before that, a stored revision
// (such as one the deploy helper staged) is not part of the checked config.
const resolveIgnoredPublicConfigFields = (finalizePublication: boolean): readonly string[] =>
  finalizePublication
    ? WORKER_MANAGED_PUBLIC_CONFIG_FIELDS
    : [...WORKER_MANAGED_PUBLIC_CONFIG_FIELDS, 'configRevision'];
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const REVISION_PATTERN = /^[a-z0-9._:-]{1,128}$/i;
const LIT_CREDENTIAL_DESCRIPTOR_FIELDS = new Set<string>(CHIPOTLE_LIT_CONFIG_FIELDS);

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

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

const pickFields = (source: UnknownRecord, fields: readonly string[]): UnknownRecord =>
  fields.reduce<UnknownRecord>((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) picked[field] = source[field];
    return picked;
  }, {});

const buildExpectedPublicConfig = (config: UnknownRecord, ignoredFields: readonly string[]): UnknownRecord =>
  PUBLIC_WORKER_CONFIG_FIELDS.reduce<UnknownRecord>((expected, key) => {
    if (ignoredFields.includes(key) || !Object.prototype.hasOwnProperty.call(config, key)) return expected;
    // A Session Agent of null is off, as no setting is (see the readback below).
    if (key === 'sessionAgent' && config.sessionAgent === null) return expected;
    if (key === 'ai') {
      const ai =
        config.ai && typeof config.ai === 'object' && !Array.isArray(config.ai) ? (config.ai as UnknownRecord) : {};
      expected.ai = pickFields(ai, PUBLIC_WORKER_AI_FIELDS);
      return expected;
    }
    expected[key] = config[key];
    return expected;
  }, {});

// A Worker without the merges-ai field is older and shows only ai.models.
const expectedForWorker = (expected: UnknownRecord, readback: UnknownRecord): UnknownRecord =>
  readback[SET_CONFIG_MERGES_AI_FIELD] === true || !expected.ai || typeof expected.ai !== 'object'
    ? expected
    : { ...expected, ai: pickFields(expected.ai as UnknownRecord, ['models']) };

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
    // Field names only: values are never part of the message.
    const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
    const unexpectedKeys = actualKeys.filter((key) => !expectedKeys.includes(key));
    if (missingKeys.length || unexpectedKeys.length) {
      const detail = [
        missingKeys.length ? `missing ${missingKeys.join(', ')}` : '',
        unexpectedKeys.length ? `unexpected ${unexpectedKeys.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      throw new Error(`Worker config verification failed: public config mismatch at "${path}" (${detail}).`);
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

const buildComparableActualPublicConfig = ({
  config,
  revision,
  workerOrigin,
  ignoredFields,
}: {
  config: UnknownRecord;
  revision: string;
  workerOrigin: string;
  ignoredFields: readonly string[];
}): UnknownRecord => {
  if (
    Object.prototype.hasOwnProperty.call(config, WORKER_CANONICAL_PUBLICATION_REVISION_KEY) &&
    toTrimmedString(config[WORKER_CANONICAL_PUBLICATION_REVISION_KEY]) !== revision
  ) {
    throw new Error('Worker config verification failed: publication revision mismatch.');
  }
  const comparableConfig = { ...config };
  ignoredFields.forEach((key) => {
    delete comparableConfig[key];
  });
  // The Worker stores an off Session Agent as no setting; null means the same.
  if (comparableConfig.sessionAgent === null) delete comparableConfig.sessionAgent;
  // The critical-field check has already matched this URL's origin; a
  // trailing slash or letter case does not change the Worker it names.
  comparableConfig.corsWorkerUrl = workerOrigin;
  return comparableConfig;
};

const deriveConfigRevision = (value: UnknownRecord): string =>
  `config:${fingerprintSessionWizardJson('context-engine:worker-canonical-publication:v1', value)}`;

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

// set-config merges fields, so a config that leaves out its instructions for AI
// agents or its Session Agent must clear stored ones, with '' and null. Older
// Workers refuse these fields, so each clear is sent only when the Worker's
// config already has the field. A Worker with no config answers 404. Any other
// failed read stops before signing: leaving a field out could keep what is
// stored, and would change the revision a retry signs.
// set-config replaces limits whole and /new has no AI daily limit, so the one
// stored (set in Settings) is kept the same way.
const CLEARED_WHEN_LEFT_OUT = { agentInstructions: '', sessionAgent: null } as const;
// The two card switches. Each is off unless true, and a config leaves it out
// when off.
// - A session still being made takes what the page says. A switch the page
//   leaves out is turned off where an earlier attempt stored it, so Create
//   makes the session match the page.
// - A published session keeps its own. Its switches are changed in Settings:
//   a /new sync onto it sends back what it holds, and nothing for a switch it
//   never saved, whatever this page's draft says. Otherwise pointing /new at a
//   session that exists would turn its analysis card on (the box on /new
//   starts ticked) or its Context cards off.
const CARD_SWITCHES = ['contextCardsEnabled', 'analysisCardEnabled'] as const;

// What the Worker says it has; null when it cannot be asked. Asked afresh each
// time, so a Worker just updated is not judged by an earlier answer. A Worker
// from before capabilities answers 404: it has neither kind of card.
const readWorkerFeatures = async (
  workerOrigin: string,
  slug: string,
  fetchImpl: SessionWizardWorkerConfigFetchPort,
): Promise<unknown[] | null> => {
  try {
    const response = await fetchImpl(`${workerOrigin}/capabilities?slug=${encodeURIComponent(slug)}`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const features = response.ok ? (await readResponseJson(response)).features : response.status === 404 ? [] : null;
    return Array.isArray(features) ? features : null;
  } catch {
    return null;
  }
};

// A switch this page turns on is sent only to a Worker that says it has the
// feature: an older one would refuse the whole save, naming only the field.
// Context cards are a choice the admin made on the page, so a Worker too old
// for them stops the save and says so. The analysis card is on because its box
// starts ticked: on a Worker without it there is simply no card, so the switch
// is left out and the session is made.
const withSwitchesTheWorkerHas = async <T extends UnknownRecord>(
  config: T,
  fromPage: ReadonlyArray<(typeof CARD_SWITCHES)[number]>,
  workerOrigin: string,
  slug: string,
  fetchImpl: SessionWizardWorkerConfigFetchPort,
): Promise<T> => {
  const asked = fromPage.filter((field) => config[field] === true);
  if (!asked.length) return config;
  const features = await readWorkerFeatures(workerOrigin, slug, fetchImpl);
  if (asked.includes('contextCardsEnabled')) {
    if (!features) {
      throw new Error(
        "The Session Worker couldn't be checked for Context cards, so the settings weren't saved. Try again.",
      );
    }
    if (!features.includes('context_cards_v1')) {
      throw new Error(
        'This Session Worker is too old to keep Context cards. Untick Context cards under Context, or update the Worker, then try again.',
      );
    }
  }
  if (!asked.includes('analysisCardEnabled')) return config;
  if (!features) {
    throw new Error(
      "The Session Worker couldn't be checked for the Analysis card, so the settings weren't saved. Try again.",
    );
  }
  if (features.includes(ANALYSIS_CARD_FEATURE)) return config;
  const { analysisCardEnabled: _none, ...rest } = config;
  return rest as T;
};

export const withStoredConfigKept = async <T extends UnknownRecord>({
  config,
  workerOrigin,
  slug,
  fetchImpl,
}: {
  config: T;
  workerOrigin: string;
  slug: string;
  fetchImpl: SessionWizardWorkerConfigFetchPort;
}): Promise<T> => {
  const profile = config.sessionModeProfile as { authority?: { mode?: unknown } } | undefined;
  if (profile?.authority?.mode !== 'worker_canonical') return config;
  const has = (field: string): boolean => Object.prototype.hasOwnProperty.call(config, field);
  const leftOut = Object.keys(CLEARED_WHEN_LEFT_OUT).filter((field) => !has(field)) as Array<
    keyof typeof CLEARED_WHEN_LEFT_OUT
  >;
  // A switch stated as off needs no look at what is stored: off is sent as it is.
  const switches = CARD_SWITCHES.filter((field) => !has(field) || config[field] === true);
  const limits = config.limits && typeof config.limits === 'object' ? (config.limits as UnknownRecord) : null;
  const keepsAiLimit = !!limits && !Object.prototype.hasOwnProperty.call(limits, 'aiPerWalletPerDay');
  if (!leftOut.length && !switches.length && !keepsAiLimit) return config;
  let response: Response;
  try {
    response = await fetchImpl(`${workerOrigin}/session-config`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json', 'X-Session-Slug': slug },
    });
  } catch {
    throw new Error("The Session Worker couldn't be reached, so the settings weren't saved. Try again.");
  }
  // No session there yet: it is made as the page says.
  if (response.status === 404) return withSwitchesTheWorkerHas(config, switches, workerOrigin, slug, fetchImpl);
  if (!response.ok) {
    throw new Error(
      `The Session Worker's settings couldn't be read (${response.status}), so the settings weren't saved. Try again.`,
    );
  }
  const stored = getPublicConfigFromResponse(await readResponseJson(response));
  const storedAiLimit = (stored.limits as UnknownRecord | undefined)?.aiPerWalletPerDay;
  const next: UnknownRecord =
    keepsAiLimit && storedAiLimit != null
      ? { ...config, limits: { ...limits, aiPerWalletPerDay: storedAiLimit } }
      : { ...config };
  const published = !!toTrimmedString(stored[WORKER_CANONICAL_PUBLICATION_REVISION_KEY]);
  switches.forEach((field) => {
    const kept = typeof stored[field] === 'boolean' ? stored[field] : undefined;
    if (published) {
      if (kept === undefined) delete next[field];
      else next[field] = kept;
    } else if (!has(field) && kept !== undefined) {
      next[field] = false;
    }
  });
  leftOut
    .filter((field) => Object.prototype.hasOwnProperty.call(stored, field))
    .forEach((field) => {
      next[field] = CLEARED_WHEN_LEFT_OUT[field];
    });
  // What a published session holds it was already able to take.
  return withSwitchesTheWorkerHas(next as T, published ? [] : switches, workerOrigin, slug, fetchImpl);
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

const PUBLICATION_FINALIZED_ERROR_PATTERN = /publication is already finalized/i;

// A publication commits before its readback. When that readback failed and
// the draft changed since, the next attempt meets the committed publication;
// it is this session's if the Worker still serves the same identity.
const isPublishedForIdentity = async ({
  fetchImpl,
  workerOrigin,
  slug,
  sessionId,
  adminAddress,
  environment,
}: {
  fetchImpl: SessionWizardWorkerConfigFetchPort;
  workerOrigin: string;
  slug: string;
  sessionId: string;
  adminAddress: string;
  environment?: DiscoveryEnvironment;
}): Promise<boolean> => {
  try {
    const response = await fetchImpl(`${workerOrigin}/session-config`, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json', 'X-Session-Slug': slug },
    });
    if (!response.ok) return false;
    const config = getPublicConfigFromResponse(await readResponseJson(response));
    verifyCriticalWorkerConfigFields({ config, slug, sessionId, workerOrigin, environment });
    return normalizeAdminAddress(config.adminAddress) === adminAddress;
  } catch {
    return false;
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
  finalizePublication = true,
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

  const preparedConfig = clonePublicConfig(config);
  assertReachableWorkerCanonicalProfile(preparedConfig.sessionModeProfile, 'Prepared worker config');
  const publicConfig = await withStoredConfigKept({
    config: preparedConfig,
    workerOrigin,
    slug: normalizedSlug,
    fetchImpl,
  });

  const revisionConfig = { ...publicConfig };
  delete revisionConfig.configRevision;
  delete revisionConfig.workerCanonicalPublicationRevision;
  delete revisionConfig.authzEpoch;
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
    ...revisionConfig,
    slug: normalizedSlug,
    sessionId: normalizedSessionId,
    adminAddress: normalizedAdminAddress,
    corsWorkerUrl: workerOrigin,
    ...(finalizePublication ? { configRevision: revision } : {}),
  };
  const ignoredPublicConfigFields = resolveIgnoredPublicConfigFields(finalizePublication);
  const expectedPublicConfig = buildExpectedPublicConfig(configToPersist, ignoredPublicConfigFields);
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
    if (
      finalizePublication &&
      writeResponse.status === 409 &&
      PUBLICATION_FINALIZED_ERROR_PATTERN.test(detail) &&
      (await isPublishedForIdentity({
        fetchImpl,
        workerOrigin,
        slug: normalizedSlug,
        sessionId: normalizedSessionId,
        adminAddress: normalizedAdminAddress,
        environment,
      }))
    ) {
      throw Object.assign(
        new Error('This session is already published. Its earlier settings are live; later edits were not applied.'),
        { workerCanonicalAlreadyPublished: true },
      );
    }
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
    if (!finalizePublication || toTrimmedString(verifiedPublicConfig.configRevision) === revision) {
      // A revision alone proves only that some write claimed this identity. Verify
      // every public field this publication expected so a partial/foreign merge
      // cannot be reported as a successful canonical publication.
      let configMatches = true;
      try {
        verifyExpectedPublicConfigValue(
          expectedForWorker(expectedPublicConfig, verifiedPublicConfig),
          buildComparableActualPublicConfig({
            config: verifiedPublicConfig,
            revision,
            workerOrigin,
            ignoredFields: ignoredPublicConfigFields,
          }),
          'config',
        );
      } catch (error) {
        if (finalizePublication || attempt === delays.length) throw error;
        configMatches = false;
      }
      if (configMatches)
        return {
          workerOrigin,
          configRevision: finalizePublication ? revision : '',
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
