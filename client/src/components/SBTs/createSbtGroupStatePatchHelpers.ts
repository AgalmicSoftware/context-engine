import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeCreateSbtSelectedGateIds, normalizeMetadataLockGateIds } from './createSbtGroupMetadataLockHelpers';

type BuildCreateSbtAccountDistributionSyncStatePatchArgs = {
  currentDistribution?: unknown;
  syncPatch?: unknown;
};
type BuildCreateSbtDistributionFieldPatchArgs = {
  fieldKey?: unknown;
  fieldValue?: unknown;
  state?: unknown;
};
type BuildCreateSbtBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};
type BuildCreateSbtCopySuccessPatchArgs = {
  copied?: unknown;
  stateKey?: unknown;
};
type BuildCreateSbtCopiedLinkIndexPatchArgs = {
  index?: unknown;
};
type BuildCreateSbtOpenLockKeyPatchArgs = {
  lockKey?: unknown;
};
type BuildCreateSbtGroupHashPatchArgs = {
  groupHash?: unknown;
};
type BuildCreateSbtPasswordListPatchArgs = {
  passwordList?: unknown;
};
type BuildCreateSbtBookmarkedSbtsSetPatchArgs = {
  bookmarkedSbtsSet?: unknown;
};
type BuildCreateSbtPredictedAddressPatchArgs = {
  predictedAddress?: unknown;
  predictedAddressBusy?: unknown;
  predictedAddressStatus?: unknown;
};
type BuildCreateSbtMintFailurePatchArgs = {
  error?: unknown;
};
type BuildCreateSbtMintSuccessPatchArgs = {
  passwordList?: unknown;
  sbtAddress?: unknown;
};
type BuildCreateSbtEditResetPatchArgs = {
  resetUploadState?: unknown;
};
type BuildCreateSbtErrorPatchArgs = {
  error?: unknown;
};
type BuildCreateSbtMetadataLockGateIdsPatchArgs = {
  metadataLockGateIds?: unknown;
};
type BuildCreateSbtMetadataLockSelectionPatchArgs = {
  fieldKey?: unknown;
  metadataLockGateIds?: unknown;
  openLockKey?: unknown;
  selectedGateIds?: unknown;
  validGateIds?: unknown[];
};
type BuildCreateSbtMetadataLockFallbackPatchArgs = {
  fallbackGateIds?: unknown;
  fieldKey?: unknown;
  lockKey?: unknown;
  metadataLockGateIds?: unknown;
};
type BuildCreateSbtSymbolPatchArgs = {
  sbtSymbol?: unknown;
};
type BuildCreateSbtShareableUrlPatchArgs = {
  autoJoinUrl?: unknown;
};
type BuildCreateSbtInviteLinksBackupPatchArgs = {
  sbtInviteBackupDate?: unknown;
  sbtInviteLinks?: unknown;
};
type BuildCreateSbtNumInviteLinksPatchArgs = {
  numInviteLinks?: unknown;
};
type BuildCreateSbtExportFormatPatchArgs = {
  exportFormat?: unknown;
};
type BuildCreateSbtInputChangePatchArgs = {
  name?: string;
  value?: unknown;
};
type BuildCreateSbtCountdownTickPatchArgs = {
  state?: unknown;
};

const isCreateSbtStatePatchPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildCreateSbtDistributionFieldPatch = ({
  fieldKey = '',
  fieldValue = null,
  state = {},
}: BuildCreateSbtDistributionFieldPatchArgs = {}): Record<string, unknown> => {
  const stateRecord = isCreateSbtStatePatchPlainObject(state) ? state : {};
  const distributionSource = stateRecord.sbtDistribution;
  const previousDistribution =
    distributionSource !== null && typeof distributionSource === 'object'
      ? (distributionSource as Record<string, unknown>)
      : {};
  return {
    sbtDistribution: {
      ...previousDistribution,
      [String(fieldKey || '')]: fieldValue,
    },
  };
};

export const buildCreateSbtNetworkChangePatch = ({
  chain = null,
  currentDistribution = {},
  network = '',
}: {
  chain?: unknown;
  currentDistribution?: unknown;
  network?: unknown;
} = {}): Record<string, unknown> => {
  const distribution = isCreateSbtStatePatchPlainObject(currentDistribution) ? currentDistribution : {};
  return {
    network,
    sbtDistribution: {
      ...distribution,
      network: chain,
    },
  };
};

export const buildCreateSbtBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: BuildCreateSbtBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = isCreateSbtStatePatchPlainObject(state) ? state : {};
  return {
    [key]: !source[key],
  };
};

export const buildCreateSbtCopySuccessPatch = ({
  copied = true,
  stateKey = 'copyLinkSuccess',
}: BuildCreateSbtCopySuccessPatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || 'copyLinkSuccess');
  return {
    [key]: copied === true,
  };
};

export const buildCreateSbtCopiedLinkIndexPatch = ({
  index = null,
}: BuildCreateSbtCopiedLinkIndexPatchArgs = {}): Record<string, unknown> => ({
  copiedLinkIndex: index,
});

export const buildCreateSbtOpenLockKeyPatch = ({ lockKey = '' }: BuildCreateSbtOpenLockKeyPatchArgs = {}): Record<
  string,
  string
> => ({
  openLockKey: String(lockKey ?? ''),
});

export const buildCreateSbtGroupHashPatch = ({ groupHash = '' }: BuildCreateSbtGroupHashPatchArgs = {}): Record<
  string,
  string
> => ({
  groupHash: String(groupHash ?? ''),
});

export const buildCreateSbtPasswordListPatch = ({
  passwordList = [],
}: BuildCreateSbtPasswordListPatchArgs = {}): Record<string, unknown[]> => ({
  passwordList: Array.isArray(passwordList) ? passwordList : [],
});

export const buildCreateSbtBookmarkedSbtsSetPatch = ({
  bookmarkedSbtsSet = new Set<string>(),
}: BuildCreateSbtBookmarkedSbtsSetPatchArgs = {}): Record<string, Set<string>> => ({
  bookmarkedSbtsSet: bookmarkedSbtsSet instanceof Set ? (bookmarkedSbtsSet as Set<string>) : new Set<string>(),
});

export const buildCreateSbtPredictedAddressBusyPatch = (): Record<string, unknown> => ({
  predictedAddressBusy: true,
  predictedAddressStatus: 'Calculating address\u2026',
});

export const buildCreateSbtPredictedAddressPatch = ({
  predictedAddress = '',
  predictedAddressBusy = false,
  predictedAddressStatus = '',
}: BuildCreateSbtPredictedAddressPatchArgs = {}): Record<string, unknown> => ({
  predictedAddress: String(predictedAddress ?? ''),
  predictedAddressStatus: String(predictedAddressStatus ?? ''),
  predictedAddressBusy: predictedAddressBusy === true,
});

export const buildCreateSbtMintResetFailurePatch = ({ error = '' }: BuildCreateSbtMintFailurePatchArgs = {}): Record<
  string,
  unknown
> => ({
  mintingFailed: true,
  startedMinting: false,
  currentStep: 0,
  error,
});

export const buildCreateSbtDeferredSaveCompletePatch = (): Record<string, unknown> => ({
  startedMinting: false,
  mintingFailed: false,
  currentStep: 0,
  error: '',
});

export const buildCreateSbtDeferredUploadFallbackPatch = (): Record<string, unknown> => ({
  tokenURI: '',
  tokenUriUploaded: false,
  ...buildCreateSbtDeferredSaveCompletePatch(),
});

export const buildCreateSbtMintValidationFailurePatch = ({
  error = '',
}: BuildCreateSbtMintFailurePatchArgs = {}): Record<string, unknown> => ({
  mintingFailed: true,
  error,
});

export const buildCreateSbtMintSuccessPatch = ({
  passwordList = [],
  sbtAddress = '',
}: BuildCreateSbtMintSuccessPatchArgs = {}): Record<string, unknown> => ({
  sbtMinted: true,
  sbtAddress,
  currentStep: 3,
  passwordList: Array.isArray(passwordList) ? passwordList : [],
});

export const buildCreateSbtEditResetPatch = ({
  resetUploadState = true,
}: BuildCreateSbtEditResetPatchArgs = {}): Record<string, unknown> => ({
  sbtMinted: false,
  sbtAddress: '',
  currentStep: 0,
  startedMinting: false,
  mintingFailed: false,
  error: '',
  encryptedRecoveryEnabled: false,
  encryptedRecoveryStatus: 'idle',
  ...(resetUploadState === true
    ? {
        imageUploaded: false,
        tokenUriUploaded: false,
      }
    : {}),
});

export const buildCreateSbtErrorPatch = ({ error = '' }: BuildCreateSbtErrorPatchArgs = {}): Record<
  string,
  unknown
> => ({
  error,
});

export const buildCreateSbtMintStartPatch = (): Record<string, unknown> => ({
  startedMinting: true,
  mintingFailed: false,
  error: '',
});

export const buildCreateSbtMetadataLockGateIdsPatch = ({
  metadataLockGateIds = {},
}: BuildCreateSbtMetadataLockGateIdsPatchArgs = {}): Record<string, unknown> => ({
  metadataLockGateIds,
});

export const buildCreateSbtMetadataLockSelectionPatch = ({
  fieldKey = '',
  metadataLockGateIds = {},
  openLockKey = '',
  selectedGateIds = [],
  validGateIds = [],
}: BuildCreateSbtMetadataLockSelectionPatchArgs = {}): Record<string, unknown> => {
  const normalized = normalizeCreateSbtSelectedGateIds(selectedGateIds, validGateIds);
  return {
    metadataLockGateIds: {
      ...normalizeMetadataLockGateIds(metadataLockGateIds),
      [String(fieldKey || '')]: normalized,
    },
    openLockKey: normalized.length ? openLockKey : '',
  };
};

export const buildCreateSbtMetadataLockFallbackPatch = ({
  fallbackGateIds = [],
  fieldKey = '',
  lockKey = '',
  metadataLockGateIds = {},
}: BuildCreateSbtMetadataLockFallbackPatchArgs = {}): Record<string, unknown> => ({
  metadataLockGateIds: {
    ...normalizeMetadataLockGateIds(metadataLockGateIds),
    [String(fieldKey || '')]: Array.isArray(fallbackGateIds) ? fallbackGateIds : [],
  },
  openLockKey: lockKey,
});

export const buildCreateSbtCountdownStartPatch = (): Record<string, unknown> => ({
  countdownActive: true,
  countdown: 12,
});

export const buildCreateSbtSymbolPatch = ({ sbtSymbol = '' }: BuildCreateSbtSymbolPatchArgs = {}): Record<
  string,
  unknown
> => ({
  sbtSymbol: String(sbtSymbol ?? ''),
});

export const buildCreateSbtShareableUrlPatch = ({ autoJoinUrl = '' }: BuildCreateSbtShareableUrlPatchArgs = {}): Record<
  string,
  unknown
> => {
  const url = String(autoJoinUrl ?? '');
  return {
    shareableUrl: url,
    autoJoinUrl: url,
  };
};

export const buildCreateSbtInviteLinksBackupPatch = ({
  sbtInviteBackupDate = '',
  sbtInviteLinks = [],
}: BuildCreateSbtInviteLinksBackupPatchArgs = {}): Record<string, unknown> => ({
  sbtInviteLinks,
  sbtInviteBackupDate,
});

export const buildCreateSbtNumInviteLinksPatch = ({
  numInviteLinks = '',
}: BuildCreateSbtNumInviteLinksPatchArgs = {}): Record<string, unknown> => ({
  numInviteLinks,
});

export const buildCreateSbtExportFormatPatch = ({
  exportFormat = '',
}: BuildCreateSbtExportFormatPatchArgs = {}): Record<string, string> => ({
  exportFormat: String(exportFormat ?? ''),
});

export const buildCreateSbtInputChangePatch = ({
  name = '',
  value = '',
}: BuildCreateSbtInputChangePatchArgs = {}): Record<string, unknown> => ({
  [name]: value,
  ...(name === 'sbtImageUrl' ? { lockedImageAsset: null } : {}),
  ...(name === 'sbtImageUrl' ? { imageChooserStatusText: '', imageChooserStatusTone: 'default' } : {}),
});

export const buildCreateSbtCountdownTickPatch = ({ state = {} }: BuildCreateSbtCountdownTickPatchArgs = {}): Record<
  string,
  unknown
> => {
  const source = isCreateSbtStatePatchPlainObject(state) ? state : {};
  const nextCountdown = Math.max(0, Number(source.countdown || 0) - 1);
  return {
    countdown: nextCountdown,
    ...(nextCountdown === 0 ? { countdownActive: false } : null),
  };
};

export const normalizeComparableAddress = (value: unknown): string => toStr(value).trim().toLowerCase();

export const buildCreateSbtAccountDistributionSyncPatch = ({
  currentDistribution = {},
  nextAccount = '',
  prevAccount = '',
}: {
  currentDistribution?: unknown;
  nextAccount?: unknown;
  prevAccount?: unknown;
} = {}): Record<string, string> | null => {
  const prevAccountAddress = normalizeComparableAddress(prevAccount);
  const nextAccountAddress = normalizeComparableAddress(nextAccount);
  if (prevAccountAddress === nextAccountAddress) return null;

  const source = isCreateSbtStatePatchPlainObject(currentDistribution) ? currentDistribution : {};
  const currentBurnAdmin = toStr(source.burnAdmin).trim();
  const currentAdminAddress = toStr(source.adminAddress).trim();
  const shouldSyncBurnAdmin = !currentBurnAdmin || normalizeComparableAddress(currentBurnAdmin) === prevAccountAddress;
  const shouldSyncAdminAddress =
    !currentAdminAddress || normalizeComparableAddress(currentAdminAddress) === prevAccountAddress;
  if (!shouldSyncBurnAdmin && !shouldSyncAdminAddress) return null;

  const nextAccountText = toStr(nextAccount).trim();
  return {
    ...(shouldSyncBurnAdmin ? { burnAdmin: nextAccountText } : {}),
    ...(shouldSyncAdminAddress ? { adminAddress: nextAccountText } : {}),
  };
};

export const buildCreateSbtAccountDistributionSyncStatePatch = ({
  currentDistribution = {},
  syncPatch = null,
}: BuildCreateSbtAccountDistributionSyncStatePatchArgs = {}): Record<string, unknown> | null => {
  if (!syncPatch || !isCreateSbtStatePatchPlainObject(syncPatch)) return null;
  return {
    sbtDistribution: {
      ...(currentDistribution as Record<string, unknown>),
      ...syncPatch,
    },
  };
};
