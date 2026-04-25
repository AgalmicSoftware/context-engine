import {
  getLitPayerWalletStatus,
  deriveLitPayerAddress,
} from '../../utilities/crypto/litPayerWallet.js';
import { SPONSORED_BUNDLE_SUPPORTED_FIELDS } from '../../utilities/arweave/sponsoredBundles.js';
import {
  normalizeSponsoredFieldSnapshot,
  SPONSORED_FIELD_KEYS,
} from '../../utilities/session/sponsoredFlags.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { DEFAULT_GATE_KEYS } from './sessionWizardGateUtils';
import type {
  AnyRecord,
  ChainIdLike,
  WorkerSecretsLike,
} from '../shellTypes';

export const DEFAULT_WORKER_SECRETS: WorkerSecretsLike = {
  openaiKey: '',
  anthropicKey: '',
  openrouterKey: '',
  customRpcUrl: '',
  customRpcKey: '',
  arweaveJwk: '',
  faucetPrivateKey: '',
  litPayerPrivateKey: '',
  litPayerAddress: '',
};

export const normalizeWorkerSecrets = (value: WorkerSecretsLike | AnyRecord = {}): WorkerSecretsLike => {
  const next: WorkerSecretsLike = { ...DEFAULT_WORKER_SECRETS };
  if (!value || typeof value !== 'object') return next;
  Object.keys(next).forEach((key) => {
    const v = toStr((value as AnyRecord)[key]).trim();
    next[key] = v === '[redacted]' ? '' : v;
  });
  if (next.litPayerPrivateKey) {
    next.litPayerAddress = deriveLitPayerAddress(next.litPayerPrivateKey);
  }
  return next;
};

export const mergeSponsoredBundleWorkerSecrets = (
  currentSecrets: WorkerSecretsLike | AnyRecord = {},
  bundle: AnyRecord = {}
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
  bundle: AnyRecord = {}
): AnyRecord => {
  void bundle;
  return currentDeployForm && typeof currentDeployForm === 'object'
    ? { ...currentDeployForm }
    : {};
};

export const sanitizeSessionWizardWorkerSecretsForLitMode = (
  value: WorkerSecretsLike | AnyRecord = {},
  { litPayerWalletInputEnabled = true }: { litPayerWalletInputEnabled?: boolean } = {}
): WorkerSecretsLike => {
  const next = normalizeWorkerSecrets(value);
  if (litPayerWalletInputEnabled) return next;
  return {
    ...next,
    litPayerPrivateKey: '',
    litPayerAddress: '',
  };
};

export const sanitizeSessionWizardSponsoredFieldSnapshotForLitMode = (
  value: AnyRecord = {},
  { litPayerWalletInputEnabled = true }: { litPayerWalletInputEnabled?: boolean } = {}
) => {
  const next = normalizeSponsoredFieldSnapshot(value);
  if (!litPayerWalletInputEnabled) {
    next[SPONSORED_FIELD_KEYS.lit] = '0';
  }
  return next;
};

export const getSessionWizardWorkerResourceKeys = (
  { litPayerWalletInputEnabled = true }: { litPayerWalletInputEnabled?: boolean } = {}
) => (
  litPayerWalletInputEnabled
    ? DEFAULT_GATE_KEYS
    : DEFAULT_GATE_KEYS.filter((key) => key !== 'lit')
);

export const resolveSessionWizardLitPaymentDelegation = ({
  workerSecretsEnabled = true,
  resolvedWorkerUrl = '',
  litPayerPrivateKey = '',
  draft = null,
  chainId = null,
}: {
  workerSecretsEnabled?: boolean;
  resolvedWorkerUrl?: string;
  litPayerPrivateKey?: string;
  draft?: AnyRecord | null;
  chainId?: ChainIdLike;
} = {}) => {
  const litPayerStatus = getLitPayerWalletStatus(litPayerPrivateKey);
  // Regression guard: user-paid mode can leave a valid payer key in memory.
  // Keep delegation aligned with workerSecretsEnabled so the toggle fully disables sponsorship.
  if (!(workerSecretsEnabled && resolvedWorkerUrl && litPayerStatus.valid)) {
    return undefined;
  }
  return {
    enabled: true,
    bootstrapLitPayerPrivateKey: litPayerStatus.privateKey,
    sessionSlug: toStr(draft?.slug || '').trim(),
    sessionConfig: {
      ...(draft && typeof draft === 'object' ? draft : {}),
      networkChainId: chainId,
      corsWorkerUrl: resolvedWorkerUrl,
      sponsoredKeys: {
        ...((draft?.sponsoredKeys && typeof draft.sponsoredKeys === 'object') ? draft.sponsoredKeys : {}),
        lit: true,
      },
    },
    workerUrl: resolvedWorkerUrl,
  };
};
