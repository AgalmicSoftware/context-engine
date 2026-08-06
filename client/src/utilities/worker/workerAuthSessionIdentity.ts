import { normalizeSessionSlug } from '../session/sessionNaming.js';
import {
  normalizeWorkerCanonicalSessionIdHex,
  resolveWorkerCanonicalSessionIdHex,
} from '../session/sessionWorkerDiscovery.js';
import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;
type WorkerAuthResponseKind = 'admin_nonce' | 'login' | 'nonce';

export type WorkerLoginResponse = {
  error?: unknown;
  exp?: unknown;
  sessionId?: unknown;
  sessionSlug?: unknown;
  token?: string;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

export const bindWorkerAuthRequestIdentity = (payload: UnknownRecord, sessionId: string): UnknownRecord =>
  sessionId ? { ...payload, sessionId } : payload;

export const resolveWorkerAuthSessionId = (sessionConfig: unknown): string => {
  const config = asRecord(sessionConfig);
  const profile = asRecord(config.sessionModeProfile);
  const authority = asRecord(profile.authority);
  if (toStr(authority.mode).trim().toLowerCase() !== 'worker_canonical') return '';

  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  if (!sessionId) {
    throw new Error('Worker-canonical authentication requires an exact session identity.');
  }
  return sessionId;
};

export const resolveAdminActionSessionId = ({
  body,
  providedSessionId,
  sessionAuthorityMode,
}: {
  body: UnknownRecord;
  providedSessionId?: unknown;
  sessionAuthorityMode?: unknown;
}): string => {
  const explicitAuthorityMode = toStr(sessionAuthorityMode).trim().toLowerCase();
  if (explicitAuthorityMode && explicitAuthorityMode !== 'worker_canonical') return '';
  const config = asRecord(body.config);
  const hasProvidedId =
    providedSessionId !== undefined && providedSessionId !== null && toStr(providedSessionId).trim() !== '';
  const profile = asRecord(config.sessionModeProfile);
  const authority = asRecord(profile.authority);
  const configAuthorityMode = toStr(authority.mode).trim().toLowerCase();
  const bodyIdentityEligible = !configAuthorityMode || configAuthorityMode === 'worker_canonical';
  const hasBodyId =
    bodyIdentityEligible &&
    (Object.prototype.hasOwnProperty.call(body, 'sessionId') ||
      Object.prototype.hasOwnProperty.call(body, 'sessionIdHex'));
  const hasConfigId =
    bodyIdentityEligible &&
    (Object.prototype.hasOwnProperty.call(config, 'sessionId') ||
      Object.prototype.hasOwnProperty.call(config, 'sessionIdHex'));
  const source = hasProvidedId ? { sessionId: providedSessionId } : hasBodyId ? body : hasConfigId ? config : {};
  const sessionId = resolveWorkerCanonicalSessionIdHex(source);
  if ((hasProvidedId || hasBodyId || hasConfigId) && !sessionId) {
    throw new Error('Worker session identity is invalid.');
  }
  return sessionId;
};

export const shouldBootstrapWorkerCanonicalIdentity = ({
  action,
  body,
}: {
  action: unknown;
  body: UnknownRecord;
}): boolean => {
  if (toStr(action).trim().toLowerCase() !== 'set-config') return false;
  const config = asRecord(body.config);
  const profile = asRecord(config.sessionModeProfile);
  const authority = asRecord(profile.authority);
  return toStr(authority.mode).trim().toLowerCase() === 'worker_canonical';
};

export const assertWorkerAuthResponseIdentity = (
  payload: unknown,
  {
    expectedSessionId,
    expectedSessionSlug,
    kind,
  }: {
    expectedSessionId: string;
    expectedSessionSlug: string;
    kind: WorkerAuthResponseKind;
  },
): void => {
  if (!expectedSessionId) return;
  const response = asRecord(payload);
  const idMatches = normalizeWorkerCanonicalSessionIdHex(response.sessionId) === expectedSessionId;
  const slugMatches = normalizeSessionSlug(response.sessionSlug) === expectedSessionSlug;
  if (idMatches && slugMatches) return;

  if (kind === 'admin_nonce') {
    throw new Error('Worker nonce response does not match the exact session identity.');
  }
  const label = kind === 'login' ? 'Worker login' : 'Worker nonce';
  const field = idMatches ? 'slug' : 'identity';
  throw new Error(`${label} returned a different canonical session ${field}.`);
};
