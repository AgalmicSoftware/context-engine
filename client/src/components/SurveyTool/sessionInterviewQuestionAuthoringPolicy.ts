import { resolveWorkerCanonicalAuthoringTarget } from '../../domains/surveys/workerCanonicalAuthoringPort';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import {
  normalizeSessionStorageConfig,
  resolveSessionStorageBackend,
  SESSION_STORAGE_PAYLOAD_ACCESS_GATES,
  SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES,
} from '../../utilities/storage/sessionStorageConfig.js';
import { STORAGE_BACKENDS } from '../../utilities/storage/storageRefs.js';

// This helper is a conservative UI projection only. The Worker storage upload
// route remains the final authority for question creation writes.
type UnknownRecord = Record<string, unknown>;

export type SessionInterviewSuggestionAuthoringState = 'prelogin' | 'checking' | 'allowed' | 'denied';

type ResolveSuggestedQuestionAuthoringStateInput = {
  account?: unknown;
  loginComplete?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const normalizeAddressText = (value: unknown): string => {
  const address = String(value || '').trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(address) ? address : '';
};

const normalizeScopeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((scope) => String(scope || '').trim().toLowerCase()).filter(Boolean)))
    : [];

const isSessionEnded = (config: UnknownRecord): boolean => {
  const raw = config.sessionEndsAt;
  if (raw == null || raw === '') return false;
  const timestamp = typeof raw === 'number' ? raw : Date.parse(String(raw));
  if (!Number.isFinite(timestamp)) return false;
  const millis = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return millis <= Date.now();
};

const questionStorageResolvesTo = (config: UnknownRecord, backend: string): boolean =>
  resolveSessionStorageBackend(config, { resource: 'questions' }) === backend;


const workerScopeAllowed = (config: UnknownRecord, scope: 'storage' | 'arweave'): boolean => {
  const participantScopes = normalizeScopeList(asRecord(config.workerAuthority).participantScopes);
  return participantScopes.includes(scope) && asRecord(config.scopes)[scope] !== false;
};

const hasEffectiveStorageScope = (config: UnknownRecord): boolean => workerScopeAllowed(config, 'storage');

const hasEffectiveArweaveScope = (config: UnknownRecord): boolean => workerScopeAllowed(config, 'arweave');

const listAddresses = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(listAddresses);
  const record = asRecord(value);
  if (Object.keys(record).length) return listAddresses(record.addresses || record.members || []);
  const address = normalizeAddressText(value);
  return address ? [address] : [];
};

const resolveRoleAddressSet = (config: UnknownRecord, role: unknown = 'admin'): Set<string> => {
  const normalizedRole = String(role || 'admin').trim().toLowerCase() || 'admin';
  const addresses = new Set<string>();
  if (normalizedRole === 'admin') {
    listAddresses(config.adminAddress).forEach((address) => addresses.add(address));
    listAddresses(config.adminAddresses).forEach((address) => addresses.add(address));
    listAddresses(asRecord(config.admin).addresses).forEach((address) => addresses.add(address));
  }
  [config.workerRoles, config.roles, asRecord(config.authorization).roles]
    .map(asRecord)
    .forEach((roles) => listAddresses(roles[normalizedRole]).forEach((address) => addresses.add(address)));
  return addresses;
};

const resolveBareRoleGateName = (config: UnknownRecord): string => {
  const storageProfile = asRecord(config.storageProfile);
  const cloudflare = asRecord(storageProfile.cloudflare);
  const payloadAccessControl = asRecord(storageProfile.payloadAccessControl);
  return (
    String(
      payloadAccessControl.role ||
        payloadAccessControl.workerRole ||
        payloadAccessControl.roleName ||
        cloudflare.role ||
        cloudflare.workerRole ||
        config.storageRoleGate ||
        config.workerRoleGate ||
        'admin',
    )
      .trim()
      .toLowerCase() || 'admin'
  );
};

const normalizeAccessConditions = (value: unknown): { match: 'any' | 'all'; conditions: UnknownRecord[] } => {
  const source = asRecord(value);
  const conditions = Array.isArray(source.conditions)
    ? source.conditions.map(asRecord).filter((condition) => Object.keys(condition).length > 0)
    : [];
  return {
    match: String(source.match || '').trim().toLowerCase() === 'all' ? 'all' : 'any',
    conditions,
  };
};

const configuredAccessConditions = (config: UnknownRecord): { match: 'any' | 'all'; conditions: UnknownRecord[] } => {
  const storageProfile = asRecord(config.storageProfile);
  const cloudflare = asRecord(storageProfile.cloudflare);
  const payloadAccessControl = asRecord(storageProfile.payloadAccessControl);
  return normalizeAccessConditions(
    payloadAccessControl.accessConditions ||
      payloadAccessControl.conditions ||
      cloudflare.accessConditions ||
      storageProfile.accessConditions,
  );
};

const conditionIsPubliclyProvable = (condition: UnknownRecord, config: UnknownRecord, account: string): boolean | null => {
  const kind = String(condition.kind || '').trim().toLowerCase();
  if (kind === 'worker_role') {
    const role = String(condition.role || condition.name || 'admin').trim().toLowerCase() || 'admin';
    return resolveRoleAddressSet(config, role).has(account);
  }
  if (kind === 'agent_grant_scope') {
    const scope = String(condition.scope || condition.value || '').trim().toLowerCase();
    return scope === 'storage' ? hasEffectiveStorageScope(config) : null;
  }
  if (kind === 'sbt_onchain' || kind === 'worker_group') return null;
  return null;
};

const conditionsAllowFromPublicState = (config: UnknownRecord, account: string): boolean | null => {
  const document = configuredAccessConditions(config);
  if (!document.conditions.length) return null;
  const results = document.conditions.map((condition) => conditionIsPubliclyProvable(condition, config, account));
  if (document.match === 'any') return results.some((result) => result === true);
  return results.every((result) => result === true);
};

const payloadAccessAllowsQuestionWrite = (config: UnknownRecord, account: string): boolean => {
  const conditioned = conditionsAllowFromPublicState(config, account);
  if (conditioned !== null) return conditioned;

  const access = normalizeSessionStorageConfig(config).payloadAccessControl;
  // Lit-encrypted Cloudflare payloads do their real access proof in Lit; do not
  // hide the section just because the Worker cannot publicly prove membership.
  if (access.encryption === SESSION_STORAGE_PAYLOAD_ENCRYPTION_MODES.LIT) return true;
  if (access.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.NONE) return true;
  if (access.gate === SESSION_STORAGE_PAYLOAD_ACCESS_GATES.ROLE_GATE) {
    return resolveRoleAddressSet(config, resolveBareRoleGateName(config)).has(account);
  }
  return false;
};

const hasValidWorkerCanonicalQuestionTarget = (config: UnknownRecord, sessionSlug: unknown): boolean => {
  try {
    const slug = String(sessionSlug || config.slug || '').trim();
    if (!slug) return false;
    resolveWorkerCanonicalAuthoringTarget({ sessionConfig: config, sessionSlug: slug });
    return true;
  } catch {
    return false;
  }
};

export const resolveSuggestedQuestionAuthoringState = ({
  account,
  loginComplete,
  sessionConfig,
  sessionSlug,
}: ResolveSuggestedQuestionAuthoringStateInput): SessionInterviewSuggestionAuthoringState => {
  const normalizedAccount = normalizeAddressText(account);
  if (!loginComplete) return 'prelogin';
  if (!normalizedAccount) return 'checking';

  const config = asRecord(sessionConfig);
  if (!Object.keys(config).length) return 'checking';
  if (isSessionEnded(config)) return 'denied';

  const projection = resolveSessionCapabilityProjection(config);
  if (!projection.profileValid && projection.source !== 'legacy_registry') {
    return projection.source === 'missing' ? 'checking' : 'denied';
  }

  if (projection.isWorkerCanonical) {
    if (Number(asRecord(config.workerAuthority).version || 0) !== 1) return 'checking';
    const canUseCloudflare =
      questionStorageResolvesTo(config, STORAGE_BACKENDS.CLOUDFLARE) &&
      hasValidWorkerCanonicalQuestionTarget(config, sessionSlug) &&
      (hasEffectiveStorageScope(config) || hasEffectiveArweaveScope(config)) &&
      payloadAccessAllowsQuestionWrite(config, normalizedAccount);
    return canUseCloudflare ? 'allowed' : 'denied';
  }

  if (projection.isRegistryCanonical) {
    if (!questionStorageResolvesTo(config, STORAGE_BACKENDS.ARWEAVE)) return 'denied';
    return asRecord(config.scopes).arweave === false ? 'denied' : 'allowed';
  }

  return 'denied';
};

export const shouldHideSuggestedQuestionSection = (state: SessionInterviewSuggestionAuthoringState): boolean =>
  state !== 'prelogin' && state !== 'allowed';
