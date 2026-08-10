import type { UnknownRecord } from '../../utilities/session/sessionTypes.js';
import type { ChainIdLike, NetworkLike, SessionContractsLike } from '../shellTypes';
import type { WorkerPanelProps } from './WorkerPanel';
import type { SessionWizardResourceGateSelectionState } from './sessionWizardResourceGateSupport';

export type DeployFormState = NonNullable<WorkerPanelProps['deployForm']> & {
  bundleUrl?: string;
};

export type ResourceGateMapState = Record<string, SessionWizardResourceGateSelectionState>;

type GateSelectionState = UnknownRecord & {
  sbts?: unknown[];
  mode?: string;
  chainId?: ChainIdLike | null;
  perMemberLimit?: unknown;
};

export type GateSelectionsState = Record<string, GateSelectionState>;

export type DraftSponsoredState = UnknownRecord & {
  defaultGateId?: unknown;
  gates?: Record<string, UnknownRecord>;
};

export type DraftState = UnknownRecord &
  NonNullable<WorkerPanelProps['draft']> & {
    sessionName?: string;
    sessionInfo?: string;
    sessionHeader?: string;
    sessionHeaderImg?: string;
    appearance?: {
      colorSchemeId?: string;
    };
    slug?: string;
    corsWorkerUrl?: string;
    networkChainId?: string | number;
    blockLimits?: UnknownRecord;
    contracts?: SessionContractsLike;
    defaultFeaturedSBTs?: unknown;
    embeddedDeployHelperEnabled?: boolean;
    featuredSBTs?: UnknownRecord[];
    faucet?: UnknownRecord;
    ai?: UnknownRecord;
    arweave?: UnknownRecord;
    lit?: UnknownRecord;
    rpc?: UnknownRecord;
    sponsored?: DraftSponsoredState;
    sessionModeProfile?: UnknownRecord;
    groupCreationPolicy?: string;
    __registry?: UnknownRecord;
  };

export type DraftAiModelsState = Record<string, UnknownRecord>;
export type DraftAiState = UnknownRecord & {
  models?: DraftAiModelsState;
};

export type SessionWizardProps = {
  account?: string;
  provider?: UnknownRecord | null;
  network?: NetworkLike;
  activeSessionSlug?: string;
  ensureLightSbtUniverse?: (() => unknown) | null;
  sbtCacheRevision?: unknown;
  toggleLoginModal?: ((open?: boolean) => void) | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  initialSessionId?: string | number | null;
  initialRegistryChainId?: ChainIdLike;
  initialSponsoredBundleId?: string | null;
  initialSponsoredBundleKey?: string | null;
  [key: string]: unknown;
};

export type CreateSbtModalState = {
  open: boolean;
  targetType: string;
  gateId: string;
  sessionSlug: string;
  arweaveJwkOverride: string;
};

export type ContractViewerModalState = {
  open: boolean;
  contractKey: string;
};

export type SessionSlugExistsArgs = {
  registryChainId?: ChainIdLike;
  slug: string;
};

export type SessionRegistryReadContract = {
  sessionExists?: (slug: string) => Promise<boolean> | boolean;
  sessionIdExists?: (sessionIdHex: string) => Promise<boolean> | boolean;
};

export type ProvisionedSponsoredContextState = UnknownRecord & {
  sessionSlug: string;
  workerUrl: string;
  fields: UnknownRecord;
};
