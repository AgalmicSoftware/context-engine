import { SPONSORED_BUNDLE_SUPPORTED_FIELDS } from '../../utilities/arweave/sponsoredBundles.js';
import { normalizeSponsoredFieldSnapshot } from '../../utilities/session/sponsoredFlags.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { DEFAULT_GATE_KEYS } from './sessionWizardGateUtils';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';

export const CHIPOTLE_LIT_CONFIG_FIELDS = Object.freeze(['litApiBase', 'litGroupId', 'litPkpId', 'litActionCid']);

export const WORKER_SECRET_CACHE_SAFE_FIELDS = Object.freeze([...CHIPOTLE_LIT_CONFIG_FIELDS]);

export const DEFAULT_WORKER_SECRETS: WorkerSecretsLike = {
  openaiKey: '',
  anthropicKey: '',
  openrouterKey: '',
  customRpcUrl: '',
  customRpcKey: '',
  arweaveJwk: '',
  faucetPrivateKey: '',
  litApiBase: '',
  litGroupId: '',
  litPkpId: '',
  litActionCid: '',
  litAccountApiKey: '',
  litUsageApiKey: '',
};

export const WORKER_SECRET_PERSISTED_FIELDS = Object.freeze(
  Object.keys(DEFAULT_WORKER_SECRETS).filter((key) => !WORKER_SECRET_CACHE_SAFE_FIELDS.includes(key)),
);

export const AI_PROVIDER_WORKER_SECRET_FIELDS = Object.freeze(['openaiKey', 'anthropicKey', 'openrouterKey']);

export const hasConfiguredAiProviderWorkerSecret = (value: WorkerSecretsLike | AnyRecord = {}): boolean =>
  AI_PROVIDER_WORKER_SECRET_FIELDS.some((key) => !!toStr(value?.[key]).trim());

export const isAiProviderWorkerSecretField = (key: unknown): boolean =>
  AI_PROVIDER_WORKER_SECRET_FIELDS.includes(toStr(key).trim());

export const normalizeWorkerSecrets = (value: WorkerSecretsLike | AnyRecord = {}): WorkerSecretsLike => {
  const next: WorkerSecretsLike = { ...DEFAULT_WORKER_SECRETS };
  if (!value || typeof value !== 'object') return next;
  Object.keys(next).forEach((key) => {
    const v = toStr((value as AnyRecord)[key]).trim();
    next[key] = v === '[redacted]' ? '' : v;
  });
  return next;
};

export const mergeSponsoredBundleWorkerSecrets = (
  currentSecrets: WorkerSecretsLike | AnyRecord = {},
  bundle: AnyRecord = {},
): WorkerSecretsLike => {
  const next = normalizeWorkerSecrets(currentSecrets);
  SPONSORED_BUNDLE_SUPPORTED_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return;
    const value = toStr(bundle?.[key] || '').trim();
    if (!value) return;
    next[key] = value;
  });
  if (toStr(bundle?.customRpcUrl || '').trim()) {
    // Sponsored bundles never ship `customRpcKey`; clear any cached key so we
    // do not send a stale Authorization header to the sponsored endpoint.
    next.customRpcKey = '';
  }
  return normalizeWorkerSecrets(next);
};

export const mergeSponsoredBundleDeployForm = (
  currentDeployForm: AnyRecord = {},
  bundle: AnyRecord = {},
): AnyRecord => {
  void bundle;
  return currentDeployForm && typeof currentDeployForm === 'object' ? { ...currentDeployForm } : {};
};

export const buildWorkerLitCredentialsConfig = (
  workerSecrets: WorkerSecretsLike | AnyRecord = {},
): Record<string, string> =>
  CHIPOTLE_LIT_CONFIG_FIELDS.reduce(
    (acc, key) => {
      const value = toStr((workerSecrets as AnyRecord)?.[key]).trim();
      if (value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

export const sanitizeSessionWizardWorkerSecretsForLitMode = (
  value: WorkerSecretsLike | AnyRecord = {},
): WorkerSecretsLike => {
  const next = normalizeWorkerSecrets(value);
  if (toStr(next.litAccountApiKey).trim()) {
    CHIPOTLE_LIT_CONFIG_FIELDS.forEach((key) => {
      next[key] = '';
    });
    next.litUsageApiKey = '';
  }
  return next;
};

export const resolveSessionWizardEnabledWorkerSecrets = ({
  workerSecrets = {},
  workerSecretsEnabled = true,
}: {
  workerSecrets?: WorkerSecretsLike | AnyRecord;
  workerSecretsEnabled?: boolean;
} = {}): WorkerSecretsLike =>
  workerSecretsEnabled ? sanitizeSessionWizardWorkerSecretsForLitMode(workerSecrets) : { ...DEFAULT_WORKER_SECRETS };

export const sanitizeSessionWizardSponsoredFieldSnapshotForLitMode = (value: AnyRecord = {}) => {
  return normalizeSponsoredFieldSnapshot(value);
};

export const getSessionWizardWorkerResourceKeys = () => DEFAULT_GATE_KEYS;
