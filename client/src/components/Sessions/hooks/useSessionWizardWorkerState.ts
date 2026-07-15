import { useState } from 'react';
import type { WorkerPanelProps } from '../WorkerPanel';
import { normalizeBaseUrl } from '../../../utilities/urlUtils.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { sanitizeSessionWizardWorkerSecretsForLitMode } from '../sessionWizardWorkerSecretSupport';
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
  devPersistWorkerSecrets: boolean;
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
  devPersistWorkerSecrets,
  defaultAllowedOrigins,
  buildProvisionedSponsoredContextState,
}: UseSessionWizardWorkerStateOptions<TProvisionedSponsoredContext>) => {
  const cachedDeployForm = resolveCachedDeployForm(cachedWizard);
  const normalizedWorkerBundleUrlDefault = toStr(workerBundleUrlDefault);
  const [workerMode, setWorkerMode] = useState('default');
  const [workerSecretsEnabled, setWorkerSecretsEnabled] = useState(() =>
    typeof cachedWizard?.workerSecretsEnabled === 'boolean' ? cachedWizard.workerSecretsEnabled : true,
  );
  const [persistWorkerSecrets, setPersistWorkerSecrets] = useState(() =>
    typeof cachedWizard?.persistWorkerSecrets === 'boolean'
      ? cachedWizard.persistWorkerSecrets
      : devPersistWorkerSecrets,
  );
  const [deployHelperUrl, setDeployHelperUrl] = useState(() => toStr(deployHelperUrlDefault));
  const [deployForm, setDeployForm] = useState<DeployFormState>({
    apiToken: toStr(cachedDeployForm.apiToken || '').trim(),
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
  const [deployComplete, setDeployComplete] = useState(
    () =>
      !!cachedWizard?.deployComplete &&
      !(cachedWizard as (CachedWorkerState & { workerRequirementProof?: unknown }))?.workerRequirementProof,
  );
  const [deployWorkerUrl, setDeployWorkerUrl] = useState(() =>
    normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()),
  );
  // Requirement evidence contains live-only salted secret comparisons. Never
  // hydrate it from storage; reloads must reverify the stable deploy attempt.
  const [workerRequirementProof, setWorkerRequirementProof] = useState<SessionWizardWorkerRequirementProof | null>(null);
  const [provisionedSponsoredContext, setProvisionedSponsoredContext] = useState<TProvisionedSponsoredContext>(() =>
    buildProvisionedSponsoredContextState(cachedWizard?.provisionedSponsoredContext),
  );
  const [workerSecrets, setWorkerSecrets] = useState<WorkerSecretsLike>(() => {
    const cached = cachedWizard?.workerSecrets;
    return sanitizeSessionWizardWorkerSecretsForLitMode(
      cached && typeof cached === 'object' ? (cached as WorkerSecretsLike) : {},
    );
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
