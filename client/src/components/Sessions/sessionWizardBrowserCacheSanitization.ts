import { deepClone } from './sessionWizardCoreUtils';
import { stripSessionWizardMetadataSecretFields } from './sessionWizardMetadataPayload';
import { WORKER_SECRET_CACHE_SAFE_FIELDS } from './sessionWizardWorkerSecretSupport';
import type { AnyRecord } from '../shellTypes';

const CACHE_FORBIDDEN_FIELD_NAMES = new Set(
  [
    'apiKey',
    'encryptedApiKey',
    'jwk',
    'encryptedJwk',
    'privateKey',
    'encryptedPrivateKey',
    'openaiKey',
    'anthropicKey',
    'openrouterKey',
    'customRpcUrl',
    'customRpcKey',
    'faucetPrivateKey',
    'faucetGrantToken',
    'deployGrantToken',
    'apiToken',
    'litAccountApiKey',
    'litUsageApiKey',
    'litCapacityDelegationAuthSig',
    'litCapacityDelegationAuthSigJson',
    'capacityDelegationAuthSig',
    'authSig',
    'sponsoredBundleKey',
    'initialSponsoredBundleKey',
    'bundleDecryptionKey',
    'password',
    'passwordList',
    'passwords',
    'groupPassword',
    'inviteCode',
    'claimCode',
    'passkeyCredential',
    'passkeyCredentialId',
  ].map((key) => key.toLowerCase()),
);

const stripForbiddenFieldsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripForbiddenFieldsDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value as AnyRecord).reduce<AnyRecord>((result, [key, entry]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (CACHE_FORBIDDEN_FIELD_NAMES.has(normalizedKey)) return result;
    result[key] = stripForbiddenFieldsDeep(entry);
    return result;
  }, {});
};

const keepPublicLitRuntimeConfig = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as AnyRecord;
  return WORKER_SECRET_CACHE_SAFE_FIELDS.reduce<Record<string, string>>((result, key) => {
    const entry = typeof source[key] === 'string' ? source[key].trim() : '';
    if (entry) result[key] = entry;
    return result;
  }, {});
};

export const sanitizeSessionWizardDraftForBrowserCache = (value: unknown): AnyRecord => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
  const stripped = stripSessionWizardMetadataSecretFields(deepClone(source));
  const next = stripForbiddenFieldsDeep(stripped) as AnyRecord;

  if (Object.prototype.hasOwnProperty.call(next, 'litCredentials')) {
    next.litCredentials = keepPublicLitRuntimeConfig(next.litCredentials);
  }
  delete next.secrets;
  delete next.workerSecrets;
  delete next.workerRequirementProof;
  delete next.deployForm;

  return next;
};
