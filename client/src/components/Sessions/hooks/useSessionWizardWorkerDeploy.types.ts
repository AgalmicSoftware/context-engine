import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { SessionWizardWorkerRequirementProof } from '../sessionWizardWorkerRequirementProof';
import type { AnyRecord, ChainIdLike, NetworkLike, WorkerSecretsLike } from '../../shellTypes';
import type { verifySessionWizardWorkerPublicDeployment } from '../sessionWizardWorkerPublicVerification';

export type DeployFormLike = AnyRecord & {
  apiToken?: string;
  workerName?: string;
  adminAddress?: string;
  bundleUrl?: string;
};

export type DraftLike = AnyRecord & {
  slug?: string;
  corsWorkerUrl?: string;
  networkChainId?: ChainIdLike;
  blockLimits?: AnyRecord;
  contracts?: AnyRecord;
  rpc?: AnyRecord;
  faucet?: AnyRecord;
};

export type SessionWizardWorkerDeployRuntime = {
  account?: string;
  provider?: AnyRecord | null;
  network?: NetworkLike | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  toggleLoginModal?: ((nextOpen?: boolean) => unknown) | null;
  registryAddress?: string;
  registryChainId?: ChainIdLike;
  wizardMode?: string;
  workerMode?: string;
  bundleMode?: string;
  bundleFile?: File | null;
  forceManualBundleFile?: boolean;
  normalModeBundleUrlOverride?: string;
  workerSecretsEnabled?: boolean;
  workerLimitPerWallet?: string | number;
  embeddedDeployHelperEnabled?: boolean;
  deployHelperUrl?: string;
  latestChainBlock?: number | null;
  sessionId?: string | number | null;
  sessionIdHex?: string;
  workerCanonicalPublishCompleted?: boolean;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
  draft?: DraftLike | null;
  deployForm?: DeployFormLike | null;
};

export type SessionWizardWorkerDeployStateUpdate = {
  deployForm?: DeployFormLike;
  deployStatus?: string;
  deployInFlight?: boolean;
  deployComplete?: boolean;
  workerUrlAutoFilled?: boolean;
  workerMode?: string;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
  provisionedSponsoredContext?: AnyRecord;
  forceManualBundleFile?: boolean;
  normalModeBundleUrlOverride?: string;
};

export type UseSessionWizardWorkerDeployOptions = {
  refs?: {
    runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>;
    resolvedWalletAccountRef?: MutableRefObject<string>;
    sponsoredBundleAppliedBundleRef?: MutableRefObject<AnyRecord | null>;
  };
  getCurrentWorkerSecrets?: () => WorkerSecretsLike;
  applyWorkerSecretsUpdate?: (nextValueOrUpdater: unknown) => unknown;
  getMissingWorkerSecretsForDeploy?: (secretsSnapshot?: WorkerSecretsLike) => string[];
  resolveWorkerBaseUrl?: () => string;
  resolveWorkerRpcUrl?: () => string;
  resolveWorkerRpcUrlMap?: () => Record<string, string[]>;
  resolveWorkerFaucetConfig?: () => AnyRecord;
  parseAllowOriginsInput?: () => string[];
  signTypedAdminAction?: (options?: {
    action?: string;
    body?: AnyRecord;
    targetSlug?: string;
    workerUrl?: string;
    accountOverride?: string;
  }) => Promise<AnyRecord>;
  setDeployForm?: Dispatch<SetStateAction<DeployFormLike>>;
  updateDraftValue?: (path: string[], value: unknown) => void;
  updateDeploymentState?: (nextState?: SessionWizardWorkerDeployStateUpdate) => void;
  clearSelectedBundleFile?: () => void;
  clearCachedWorkerSecretsAfterDeploy?: () => void;
  verifyPublicWorkerDeployment?: typeof verifySessionWizardWorkerPublicDeployment;
};
