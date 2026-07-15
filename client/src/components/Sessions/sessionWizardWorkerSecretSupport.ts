import { SPONSORED_BUNDLE_SUPPORTED_FIELDS } from '../../utilities/arweave/sponsoredBundles.js';
import { normalizeSponsoredFieldSnapshot } from '../../utilities/session/sponsoredFlags.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { workerAuthPublishAdapter } from '../../domains/sessions/publish/sessionPublishAdapters.js';
import { DEFAULT_GATE_KEYS } from './sessionWizardGateUtils';
import { normalizeSessionWizardSlug } from './sessionWizardUrlSupport';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';

export const CHIPOTLE_LIT_CONFIG_FIELDS = Object.freeze(['litApiBase', 'litGroupId', 'litPkpId', 'litActionCid']);

export const LIT_RUNTIME_RECOVERY_MARKER_FIELD = 'litRuntimeRecovered';

export const WORKER_SECRET_CACHE_SAFE_FIELDS = Object.freeze([
  ...CHIPOTLE_LIT_CONFIG_FIELDS,
  LIT_RUNTIME_RECOVERY_MARKER_FIELD,
]);

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
  litRuntimeRecovered: '',
  litAccountApiKey: '',
  litUsageApiKey: '',
};

export const WORKER_SECRET_PERSISTED_FIELDS = Object.freeze(
  Object.keys(DEFAULT_WORKER_SECRETS).filter((key) => !WORKER_SECRET_CACHE_SAFE_FIELDS.includes(key)),
);

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

export const resolveSessionWizardLitCredentialPathReadiness = (
  workerSecrets: WorkerSecretsLike | AnyRecord = {},
) => {
  const litAccountApiKey = toStr((workerSecrets as AnyRecord)?.litAccountApiKey).trim();
  const litUsageApiKey = toStr((workerSecrets as AnyRecord)?.litUsageApiKey).trim();
  const hasRuntimeConfig = CHIPOTLE_LIT_CONFIG_FIELDS.every((key) =>
    toStr((workerSecrets as AnyRecord)?.[key]).trim(),
  );
  const hasUsageCredential = !!litUsageApiKey;
  const canBootstrap = !!litAccountApiKey;
  return {
    canBootstrap,
    hasRuntimeConfig,
    hasUsageCredential,
    // An account key only permits the bootstrap attempt; it is not runtime proof.
    hasDeployCredentialPath: canBootstrap || (hasRuntimeConfig && hasUsageCredential),
  };
};

export const resolveSessionWizardWorkerRuntimeReadiness = ({
  requiredWorkerSecretFields = [],
  deploySecrets = {},
  helperWritesSecrets = false,
  secretsSyncStatus = {},
  requiresLit = false,
  litCredentials = {},
  litRuntimeConfigSynced = false,
  litBootstrapSynced = false,
  litProvisionSynced = false,
}: {
  requiredWorkerSecretFields?: string[];
  deploySecrets?: WorkerSecretsLike | AnyRecord;
  helperWritesSecrets?: boolean;
  secretsSyncStatus?: AnyRecord;
  requiresLit?: boolean;
  litCredentials?: AnyRecord;
  litRuntimeConfigSynced?: boolean;
  litBootstrapSynced?: boolean;
  litProvisionSynced?: boolean;
} = {}) => {
  const requiredWorkerSecretValuesPresent = requiredWorkerSecretFields.every((key) =>
    toStr((deploySecrets as AnyRecord)?.[key]).trim(),
  );
  const requiredWorkerSecretsDelivered =
    requiredWorkerSecretFields.length === 0 ||
    (requiredWorkerSecretValuesPresent &&
      (helperWritesSecrets || secretsSyncStatus?.synced === true || secretsSyncStatus?.deferred === true));
  const litUsageCredentialConfirmedRemote =
    litBootstrapSynced ||
    (!!toStr((deploySecrets as AnyRecord)?.litUsageApiKey).trim() && requiredWorkerSecretsDelivered);
  const litCredentialReadiness = resolveSessionWizardLitCredentialPathReadiness({
    ...litCredentials,
    ...(litUsageCredentialConfirmedRemote ? { litUsageApiKey: 'remote-confirmed' } : {}),
  });
  const litRuntimeConfigVerified = litRuntimeConfigSynced || litBootstrapSynced || litProvisionSynced;
  // An account key authorizes bootstrap, but only the worker's usage-key and
  // full-config write proofs make a selected Lit runtime publish-safe.
  const requiredLitRuntimeReady =
    !requiresLit ||
    (litCredentialReadiness.hasRuntimeConfig &&
      litCredentialReadiness.hasUsageCredential &&
      litRuntimeConfigVerified);
  return {
    requiredLitRuntimeReady,
    requiredWorkerSecretsDelivered,
    requiredWorkerSecretsReady: requiredWorkerSecretsDelivered && requiredLitRuntimeReady,
  };
};

export const resolveSessionWizardChipotleHookConfig = ({
  workerSecretsEnabled = true,
  workerSecrets = {},
  resolvedWorkerUrl = '',
  draft = null,
}: {
  workerSecretsEnabled?: boolean;
  workerSecrets?: WorkerSecretsLike | AnyRecord;
  resolvedWorkerUrl?: string;
  draft?: AnyRecord | null;
} = {}) => {
  if (!workerSecretsEnabled) return null;
  const litCredentials = buildWorkerLitCredentialsConfig(workerSecrets);
  const normalizedWorkerUrl = workerAuthPublishAdapter.normalizeWorkerUrl(resolvedWorkerUrl);
  if (
    !normalizedWorkerUrl ||
    !toStr(litCredentials?.litApiBase).trim() ||
    !toStr(litCredentials?.litPkpId).trim() ||
    !toStr(litCredentials?.litActionCid).trim()
  ) {
    return null;
  }
  return {
    enabled: true,
    workerUrl: normalizedWorkerUrl,
    sessionSlug: normalizeSessionWizardSlug(draft?.slug || ''),
    litCredentials,
    sessionConfig: {
      ...(draft && typeof draft === 'object' ? draft : {}),
      corsWorkerUrl: normalizedWorkerUrl,
      litCredentials,
    },
  };
};

export const sanitizeSessionWizardWorkerSecretsForLitMode = (
  value: WorkerSecretsLike | AnyRecord = {},
): WorkerSecretsLike => {
  const next = normalizeWorkerSecrets(value);
  if (toStr(next.litAccountApiKey).trim()) {
    if (toStr(next[LIT_RUNTIME_RECOVERY_MARKER_FIELD]).trim() !== 'bootstrap') {
      CHIPOTLE_LIT_CONFIG_FIELDS.forEach((key) => {
        next[key] = '';
      });
    }
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
