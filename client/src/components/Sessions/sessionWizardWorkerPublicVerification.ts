import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
} from '../../utilities/session/sessionWorkerDiscovery';
import { toStr } from '../../utilities/shared/primitives.js';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
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

const getPublicConfig = (body: AnyRecord): AnyRecord => {
  const value = body.config || body.sessionConfig || body;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
};

const normalizeAllowedOrigins = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]+/) : [])
    .map((entry) => toStr(entry).trim().replace(/\/+$/, ''))
    .filter(Boolean);

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
  const normalizedAdminAddress = toStr(adminAddress).trim();
  if (!normalizedSlug) throw new Error('Public Worker verification requires an exact session slug.');
  if (!normalizedAdminAddress) throw new Error('Public Worker verification requires the session admin.');

  if (isWorkerCanonical) {
    return persistAndVerifySessionWizardWorkerConfig({
      workerUrl: workerOrigin,
      slug: normalizedSlug,
      sessionId: normalizedSessionId,
      adminAddress: normalizedAdminAddress,
      config,
      signAdminAction,
      fetchImpl,
    });
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
  const writeResponse = await fetchImpl(`${workerOrigin}/admin/set-config`, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...requestBody, ...auth }),
  });
  if (!writeResponse.ok) {
    throw new Error(`Public Worker config write failed (${writeResponse.status}).`);
  }

  const readResponse = await fetchImpl(`${workerOrigin}/session-config?slug=${encodeURIComponent(normalizedSlug)}`, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'error',
    headers: { Accept: 'application/json', 'X-Session-Slug': normalizedSlug },
  });
  if (!readResponse.ok) {
    throw new Error(`Public Worker config read failed (${readResponse.status}).`);
  }
  const publicConfig = getPublicConfig(await readJsonRecord(readResponse));
  if (normalizeSlug(publicConfig.slug || publicConfig.sessionSlug) !== normalizedSlug) {
    throw new Error('Public Worker config readback returned another session slug.');
  }
  if (
    normalizedSessionId &&
    normalizeWorkerCanonicalSessionIdHex(publicConfig.sessionIdHex || publicConfig.sessionId) !== normalizedSessionId
  ) {
    throw new Error('Public Worker config readback returned another session ID.');
  }
  if (publicConfig.corsWorkerUrl) {
    const representedOrigin = parseSessionWorkerDiscoveryOrigin(publicConfig.corsWorkerUrl);
    if (representedOrigin !== workerOrigin) {
      throw new Error('Public Worker config readback returned another Worker origin.');
    }
  }

  const expectedBrowserOrigin = toStr(browserOrigin).trim().replace(/\/+$/, '');
  const allowedOrigins = normalizeAllowedOrigins(publicConfig.allowOrigins);
  if (
    expectedBrowserOrigin &&
    allowedOrigins.length &&
    !allowedOrigins.includes('*') &&
    !allowedOrigins.includes(expectedBrowserOrigin)
  ) {
    throw new Error('Public Worker config does not allow the current browser origin.');
  }

  return {
    workerOrigin,
    configRevision: toStr(publicConfig.configRevision).trim(),
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
      note: 'Public Worker config and browser-origin access verified.',
      synced: true,
    };
  } catch (_) {
    throw new Error(
      'Worker infrastructure was created, but public config readback and browser-origin verification are still pending.',
    );
  }
};
