import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
} from '../../utilities/session/sessionWorkerDiscovery';
import { toStr } from '../../utilities/shared/primitives.js';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import type { AnyRecord, WorkerSecretSyncResult } from '../shellTypes';

export type VerifySessionWizardWorkerPublicDeploymentInput = {
  workerUrl: unknown;
  slug: unknown;
  sessionId: unknown;
  adminAddress: unknown;
  config: AnyRecord;
  isWorkerCanonical: boolean;
  signAdminAction: (input: AnyRecord) => Promise<AnyRecord>;
  fetchImpl?: typeof fetch;
  browserOrigin?: unknown;
};

const normalizeSlug = (value: unknown): string =>
  toStr(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

const readJsonRecord = async (response: Response): Promise<AnyRecord> => {
  const value = await response.json().catch(() => ({}));
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
};

const normalizeAllowedOrigins = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]+/) : [])
    .map((entry) => toStr(entry).trim().replace(/\/+$/, ''))
    .filter(Boolean);

const normalizeAdminAddress = (value: unknown): string => {
  const normalized = toStr(value).trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(normalized) ? normalized : '';
};

export const verifySessionWizardWorkerPublicDeployment = async ({
  workerUrl,
  slug,
  sessionId,
  adminAddress,
  config,
  isWorkerCanonical,
  signAdminAction,
  fetchImpl = fetch,
  browserOrigin = typeof window !== 'undefined' ? window.location.origin : '',
}: VerifySessionWizardWorkerPublicDeploymentInput) => {
  const workerOrigin = parseSessionWorkerDiscoveryOrigin(workerUrl);
  const normalizedSlug = normalizeSlug(slug);
  const normalizedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const normalizedAdminAddress = normalizeAdminAddress(adminAddress);
  if (!normalizedSlug) throw new Error('Public Worker verification requires an exact session slug.');
  if (!normalizedSessionId) throw new Error('Public Worker verification requires a valid 16-byte session ID.');
  if (!normalizedAdminAddress) throw new Error('Public Worker verification requires a valid session admin address.');
  const publicConfig = config && typeof config === 'object' && !Array.isArray(config) ? config : null;
  if (!publicConfig) throw new Error('Prepared Worker config must be an object.');
  const expectedBrowserOrigin = toStr(browserOrigin).trim().replace(/\/+$/, '');
  const allowedOrigins = normalizeAllowedOrigins(publicConfig.allowOrigins);
  if (allowedOrigins.some((origin) => origin.includes('*'))) {
    throw new Error('Prepared Worker config must use exact browser origins; wildcards are not supported.');
  }
  if (
    !allowedOrigins.length ||
    (expectedBrowserOrigin && !allowedOrigins.includes(expectedBrowserOrigin))
  ) {
    throw new Error('Prepared Worker config must allow the current browser origin.');
  }

  if (isWorkerCanonical) {
    return persistAndVerifySessionWizardWorkerConfig({
      workerUrl: workerOrigin,
      slug: normalizedSlug,
      sessionId: normalizedSessionId,
      adminAddress: normalizedAdminAddress,
      config: publicConfig,
      signAdminAction,
      fetchImpl,
    });
  }

  const modeRequirements = resolveSessionWizardModeRequirements(publicConfig.sessionModeProfile);
  if (!modeRequirements.selected) {
    throw new Error('Prepared Worker config must claim a selected non-Worker-canonical runtime profile.');
  }
  if (!modeRequirements.usesWorkerRuntime || modeRequirements.isWorkerCanonical) {
    throw new Error('Prepared Worker config must not claim a Worker-canonical or non-runtime profile.');
  }
  if (normalizeSlug(publicConfig.slug || publicConfig.sessionSlug) !== normalizedSlug) {
    throw new Error('Prepared Worker config does not match the exact session slug.');
  }
  if (normalizeWorkerCanonicalSessionIdHex(publicConfig.sessionIdHex || publicConfig.sessionId) !== normalizedSessionId) {
    throw new Error('Prepared Worker config does not match the exact session ID.');
  }
  if (normalizeAdminAddress(publicConfig.adminAddress) !== normalizedAdminAddress) {
    throw new Error('Prepared Worker config does not match the exact session admin address.');
  }
  if (parseSessionWorkerDiscoveryOrigin(publicConfig.corsWorkerUrl) !== workerOrigin) {
    throw new Error('Prepared Worker config does not match the exact Worker origin.');
  }

  const requestBody = {
    sessionSlug: normalizedSlug,
    adminAddress: normalizedAdminAddress,
    config,
  };
  const auth = await signAdminAction({
    action: 'set-config',
    body: requestBody,
    targetSlug: normalizedSlug,
    workerUrl: workerOrigin,
  });
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw new Error('Public Worker config signing returned an invalid authorization payload.');
  }
  if (normalizeAdminAddress(auth.address) !== normalizedAdminAddress) {
    throw new Error('Public Worker config signer does not match the session admin address.');
  }
  const writeResponse = await fetchImpl(`${workerOrigin}/admin/set-config`, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, ...requestBody }),
  });
  const writeBody = await readJsonRecord(writeResponse);
  if (!writeResponse.ok) {
    throw new Error(`Public Worker config write failed (${writeResponse.status}).`);
  }
  if (writeBody.ok !== true) throw new Error('Public Worker config write did not confirm acceptance.');

  return {
    workerOrigin,
    configRevision: '',
    publicConfig,
  };
};

export const completeSessionWizardWorkerPublicDeployment = async ({
  verify = verifySessionWizardWorkerPublicDeployment,
  ...input
}: VerifySessionWizardWorkerPublicDeploymentInput & {
  verify?: typeof verifySessionWizardWorkerPublicDeployment;
}): Promise<WorkerSecretSyncResult> => {
  if (!toStr(input.workerUrl).trim()) {
    throw new Error('Worker infrastructure was created, but the public Worker URL is unavailable.');
  }
  try {
    const result = await verify(input);
    if (!result?.workerOrigin) throw new Error('Public Worker verification returned no canonical origin.');
    return {
      warning: '',
      note: input.isWorkerCanonical
        ? 'Public Worker config readback and browser-origin access verified.'
        : 'Signed Worker config acceptance and browser-origin access verified.',
      synced: true,
    };
  } catch (_) {
    throw new Error(
      input.isWorkerCanonical
        ? 'Worker infrastructure was created, but public config readback and browser-origin verification are still pending.'
        : 'Worker infrastructure was created, but signed config acceptance and browser-origin verification are still pending.',
    );
  }
};
