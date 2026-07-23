import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { WorkerPanelProps } from '../WorkerPanel';
import { normalizeBaseUrl } from '../../../utilities/urlUtils.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import {
  sanitizeSessionWizardWorkerSecretsForLitMode,
  WORKER_SECRET_CACHE_SAFE_FIELDS,
} from '../sessionWizardWorkerSecretSupport';
import type { SessionWizardWorkerRequirementProof } from '../sessionWizardWorkerRequirementProof';
import type { WorkerSecretsLike } from '../../shellTypes';

type DeployFormState = NonNullable<WorkerPanelProps['deployForm']> & {
  apiToken?: string;
  workerName?: string;
  adminAddress?: string;
  bundleUrl?: string;
};

type CachedWorkerState =
  | {
      workerSecretsEnabled?: unknown;
      persistWorkerSecrets?: unknown;
      deployComplete?: unknown;
      deployWorkerUrl?: unknown;
      deployForm?: unknown;
      provisionedSponsoredContext?: unknown;
      workerSecrets?: unknown;
    }
  | null
  | undefined;

export interface UseSessionWizardWorkerStateOptions<TProvisionedSponsoredContext> {
  cachedWizard?: CachedWorkerState;
  deployHelperUrlDefault?: unknown;
  workerBundleUrlDefault?: unknown;
  defaultAllowedOrigins: string;
  buildProvisionedSponsoredContextState: (value: unknown) => TProvisionedSponsoredContext;
}

const resolveCachedDeployForm = (cachedWizard: CachedWorkerState): DeployFormState =>
  cachedWizard?.deployForm && typeof cachedWizard.deployForm === 'object' && !Array.isArray(cachedWizard.deployForm)
    ? (cachedWizard.deployForm as DeployFormState)
    : {};

const useSessionWizardWorkerState = <TProvisionedSponsoredContext>({
  cachedWizard,
  deployHelperUrlDefault = '',
  workerBundleUrlDefault = '',
  defaultAllowedOrigins,
  buildProvisionedSponsoredContextState,
}: UseSessionWizardWorkerStateOptions<TProvisionedSponsoredContext>) => {
  const cachedDeployForm = resolveCachedDeployForm(cachedWizard);
  const normalizedWorkerBundleUrlDefault = toStr(workerBundleUrlDefault);
  const [workerMode, setWorkerMode] = useState('default');
  const [workerSecretsEnabled, setWorkerSecretsEnabled] = useState(() =>
    typeof cachedWizard?.workerSecretsEnabled === 'boolean' ? cachedWizard.workerSecretsEnabled : true,
  );
  const persistWorkerSecrets = false;
  const setPersistWorkerSecrets = useCallback<Dispatch<SetStateAction<boolean>>>((nextValue) => {
    // Kept as a compatibility callback for sponsored-bundle state restoration.
    // Secret persistence is intentionally unsupported in every build.
    void nextValue;
  }, []);
  const [deployHelperUrl, setDeployHelperUrl] = useState(() => toStr(deployHelperUrlDefault));
  const [deployForm, setDeployForm] = useState<DeployFormState>({
    // Cloudflare deployment tokens are request-only. Ignore legacy cache values.
    apiToken: '',
    workerName: toStr(cachedDeployForm.workerName || '').trim(),
    adminAddress: toStr(cachedDeployForm.adminAddress || '').trim() || undefined,
    bundleUrl: toStr(cachedDeployForm.bundleUrl || normalizedWorkerBundleUrlDefault),
  });
  const [bundleMode, setBundleMode] = useState(() => (normalizedWorkerBundleUrlDefault ? 'url' : 'upload'));
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [forceManualBundleFile, setForceManualBundleFile] = useState(false);
  const [normalModeBundleUrlOverride, setNormalModeBundleUrlOverride] = useState('');
  const [deployStatus, setDeployStatus] = useState('');
  const [deployInFlight, setDeployInFlight] = useState(false);
  const [deployComplete, setDeployComplete] = useState(() => !!cachedWizard?.deployComplete);
  const [deployWorkerUrl, setDeployWorkerUrl] = useState(() =>
    normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()),
  );
  const [provisionedSponsoredContext, setProvisionedSponsoredContext] = useState<TProvisionedSponsoredContext>(() =>
    buildProvisionedSponsoredContextState(cachedWizard?.provisionedSponsoredContext),
  );
  const [workerSecrets, setWorkerSecrets] = useState<WorkerSecretsLike>(() => {
    const cached = cachedWizard?.workerSecrets;
    const safePublicConfig = WORKER_SECRET_CACHE_SAFE_FIELDS.reduce<WorkerSecretsLike>((next, key) => {
      if (cached && typeof cached === 'object') next[key] = (cached as WorkerSecretsLike)[key];
      return next;
    }, {});
    return sanitizeSessionWizardWorkerSecretsForLitMode(safePublicConfig);
  });
  const [workerUrlAutoFilled, setWorkerUrlAutoFilled] = useState(false);
  const [workerAllowOrigins, setWorkerAllowOrigins] = useState(defaultAllowedOrigins);
  const [workerLimitPerWallet, setWorkerLimitPerWallet] = useState('');

  return {
    workerMode,
    setWorkerMode,
    workerSecretsEnabled,
    setWorkerSecretsEnabled,
    persistWorkerSecrets,
    setPersistWorkerSecrets,
    deployHelperUrl,
    setDeployHelperUrl,
    deployForm,
    setDeployForm,
    bundleMode,
    setBundleMode,
    bundleFile,
    setBundleFile,
    forceManualBundleFile,
    setForceManualBundleFile,
    normalModeBundleUrlOverride,
    setNormalModeBundleUrlOverride,
    deployStatus,
    setDeployStatus,
    deployInFlight,
    setDeployInFlight,
    deployComplete,
    setDeployComplete,
    deployWorkerUrl,
    setDeployWorkerUrl,
    workerRequirementProof,
    setWorkerRequirementProof,
    provisionedSponsoredContext,
    setProvisionedSponsoredContext,
    workerSecrets,
    setWorkerSecrets,
    workerUrlAutoFilled,
    setWorkerUrlAutoFilled,
    workerAllowOrigins,
    setWorkerAllowOrigins,
    workerLimitPerWallet,
    setWorkerLimitPerWallet,
  };
};

export default useSessionWizardWorkerState;
