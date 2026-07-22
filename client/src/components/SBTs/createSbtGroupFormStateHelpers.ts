import type { CreateSbtAuthoringChainState } from './createSbtGroupAuthoringChainHelpers';
import { createEmptyMetadataLockGateIds } from './createSbtGroupMetadataLockHelpers';

export type BuildCreateSbtDefaultDistributionStateArgs = {
  account?: unknown;
  authoringChain?: Partial<CreateSbtAuthoringChainState> | null;
};

export type BuildCreateSbtResetFormStateArgs = BuildCreateSbtDefaultDistributionStateArgs & {
  deferredCreate2SaltBuilder?: (() => unknown) | null;
  deferredDeploy?: unknown;
};

export type BuildCreateSbtInitialStateArgs = BuildCreateSbtResetFormStateArgs;

const isCreateSbtFormStatePlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildCreateSbtRestoredDistributionState = ({
  currentDistribution = {},
  distributionPayload = {},
  restoredAuthoringChain = {},
}: {
  currentDistribution?: unknown;
  distributionPayload?: unknown;
  restoredAuthoringChain?: unknown;
} = {}): Record<string, unknown> => {
  const current = isCreateSbtFormStatePlainObject(currentDistribution) ? currentDistribution : {};
  const payload = isCreateSbtFormStatePlainObject(distributionPayload) ? distributionPayload : {};
  const chainState = isCreateSbtFormStatePlainObject(restoredAuthoringChain) ? restoredAuthoringChain : {};
  const nextDistribution = {
    ...current,
    ...payload,
  };
  const rawMintingEndTime = payload.mintingEndTime;
  nextDistribution.mintingEndTime = rawMintingEndTime ? new Date(rawMintingEndTime as string | number | Date) : null;
  nextDistribution.network = chainState.chain;
  return nextDistribution;
};

export const resolveCreateSbtRestoredDeferredCreate2Salt = (
  value: unknown = '',
  fallbackValue: unknown = '',
): unknown => (typeof value === 'string' && value.trim() ? value : fallbackValue);

export const resolveCreateSbtRestoredPredictableAddressEnabled = (
  value: unknown = null,
  fallbackValue: unknown = false,
): boolean => (typeof value === 'boolean' ? value : !!fallbackValue);

export const buildCreateSbtGroupPasswordPredictableExitPatch = ({
  autoCreate2SaltForGroupPassword = false,
  nextDistributionOption = '',
  prevDistributionOption = '',
}: {
  autoCreate2SaltForGroupPassword?: unknown;
  nextDistributionOption?: unknown;
  prevDistributionOption?: unknown;
} = {}): Record<string, unknown> | null => {
  if (
    prevDistributionOption !== 'groupPassword' ||
    nextDistributionOption === 'groupPassword' ||
    !autoCreate2SaltForGroupPassword
  ) {
    return null;
  }

  return {
    create2Salt: '',
    predictableAddressEnabled: false,
  };
};

export const buildCreateSbtGroupPasswordPredictableEntryPatch = ({
  autoSalt = '',
  isDeferredDeployMode = false,
  isPredictableAddressEnabled = false,
  nextDistributionOption = '',
  prevDistributionOption = '',
}: {
  autoSalt?: unknown;
  isDeferredDeployMode?: unknown;
  isPredictableAddressEnabled?: unknown;
  nextDistributionOption?: unknown;
  prevDistributionOption?: unknown;
} = {}): Record<string, unknown> | null => {
  if (
    nextDistributionOption !== 'groupPassword' ||
    prevDistributionOption === 'groupPassword' ||
    isDeferredDeployMode ||
    isPredictableAddressEnabled ||
    !autoSalt
  ) {
    return null;
  }

  return {
    create2Salt: autoSalt,
    predictableAddressEnabled: true,
  };
};

export const buildCreateSbtRestoredScalarState = ({
  currentExportFormat = '',
  currentNumInviteLinks = 0,
  parsed = {},
}: {
  currentExportFormat?: unknown;
  currentNumInviteLinks?: unknown;
  parsed?: unknown;
} = {}): Record<string, unknown> => {
  const source = isCreateSbtFormStatePlainObject(parsed) ? parsed : {};
  return {
    sbtName: source.sbtName || '',
    sbtDescription: source.sbtDescription || '',
    sbtImageUrl: source.sbtImageUrl || '',
    useImageUrl: !!source.useImageUrl,
    documentIDHashes: source.documentIDHashes || '',
    documentURLs: Array.isArray(source.documentURLs) ? source.documentURLs : [],
    groupPassword: source.groupPassword || '',
    autoAppliedDefaultTags: Array.isArray(source.autoAppliedDefaultTags) ? source.autoAppliedDefaultTags : [],
    dismissedDefaultTags: Array.isArray(source.dismissedDefaultTags) ? source.dismissedDefaultTags : [],
    numInviteLinks: typeof source.numInviteLinks === 'number' ? source.numInviteLinks : currentNumInviteLinks,
    exportFormat: source.exportFormat || currentExportFormat,
    create2Salt: source.create2Salt || '',
  };
};

export const buildCreateSbtRestoredCollapseState = ({
  currentDistributionOptionsCollapsed = false,
  currentMintOptionsCollapsed = false,
  shouldExpandSections = false,
}: {
  currentDistributionOptionsCollapsed?: unknown;
  currentMintOptionsCollapsed?: unknown;
  shouldExpandSections?: unknown;
} = {}): Record<string, boolean> => ({
  tokenInfoCollapsed: false,
  mintOptionsCollapsed: shouldExpandSections ? false : !!currentMintOptionsCollapsed,
  distributionOptionsCollapsed: shouldExpandSections ? false : !!currentDistributionOptionsCollapsed,
});

export const buildCreateSbtDefaultDistributionState = ({
  account = '',
  authoringChain = null,
}: BuildCreateSbtDefaultDistributionStateArgs = {}): Record<string, unknown> => ({
  isLimited: false,
  limitedNumber: 0,
  hasAdmin: false,
  adminAddress: account || '',
  isRevocable: false,
  isTimeLimited: false,
  mintingEndTime: null,
  distributionOption: 'anyoneCanMint',
  burnAuth: 'AdminOnly',
  burnAdmin: account || '',
  network: authoringChain?.chain,
  unlisted: false,
});

export const buildCreateSbtResetFormState = ({
  account = '',
  authoringChain = null,
  deferredCreate2SaltBuilder = null,
  deferredDeploy = false,
}: BuildCreateSbtResetFormStateArgs = {}): Record<string, unknown> => ({
  sbtName: '',
  sbtDescription: '',
  sbtImageFile: null,
  sbtImageUrl: '',
  useImageUrl: false,
  sbtDistribution: buildCreateSbtDefaultDistributionState({ account, authoringChain }),
  tags: [],
  currentTagInput: '',
  autoAppliedDefaultTags: [],
  dismissedDefaultTags: [],
  documentURLs: [],
  documentUrl: '',
  groupPassword: '',
  openLockKey: '',
  metadataLockGateIds: createEmptyMetadataLockGateIds(),
  lockedImageAsset: null,
  create2Salt: '',
  deferredCreate2Salt:
    deferredDeploy && typeof deferredCreate2SaltBuilder === 'function' ? deferredCreate2SaltBuilder() : '',
  predictableAddressEnabled: !!deferredDeploy,
  predictedAddress: '',
  predictedAddressStatus: '',
  predictedAddressBusy: false,
  sbtMinted: false,
  sbtAddress: '',
  currentStep: 0,
  startedMinting: false,
  mintingFailed: false,
  error: '',
  network: authoringChain?.chainId || '',
  imageUploaded: false,
  tokenUriUploaded: false,
  tokenURI: '',
  showJson: false,
  showTagsInput: false,
  imageChooserStatusText: '',
  imageChooserStatusTone: 'default',
});

export const buildCreateSbtInitialState = ({
  account = '',
  authoringChain = null,
  deferredCreate2SaltBuilder = null,
  deferredDeploy = false,
}: BuildCreateSbtInitialStateArgs = {}): Record<string, unknown> => {
  const autoExpandAllSections = !!deferredDeploy;
  return {
    ...buildCreateSbtResetFormState({
      account,
      authoringChain,
      deferredCreate2SaltBuilder,
      deferredDeploy,
    }),
    sbtCodes: [],
    groupSubmitted: false,
    groupHash: '',
    passwordList: [],
    sbtInviteLinks: [],
    sbtInviteBackupDate: '',
    textToUpload: '',
    csvAddresses: '',
    estimatedMintCost: '0',
    tokenInfoCollapsed: false,
    mintOptionsCollapsed: !autoExpandAllSections,
    distributionOptionsCollapsed: !autoExpandAllSections,
    numInviteLinks: 10,
    copiedLinkIndex: null,
    exportFormat: 'json',
    encryptedRecoveryEnabled: false,
    encryptedRecoveryStatus: 'idle',
    countdown: 12,
    countdownActive: false,
    sbtSymbol: '',
    documentIDHashes: '',
    arweaveTxId: '',
    shareableUrl: '',
    autoJoinUrl: '',
    copyJsonSuccess: false,
    copyLinkSuccess: false,
    copyIdSuccess: false,
    bookmarkedSbtsSet: new Set(),
  };
};
