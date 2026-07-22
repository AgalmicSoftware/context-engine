import { buildSbtPageHolderListSignature } from './sbtPageHolderHelpers';

type BuildSbtPageMintedModalInitialFilterPatchArgs = {
  buildAddressListSignature?: (list: unknown) => string;
  netHolders?: unknown;
};
type SbtPageMintedModalInitialFilterPatch = {
  filteredMintedUsers: unknown[];
  filteredMintedUsersSignature: string;
  mintingAddressesFilterInitialized: true;
  loadingMintedFilter: false;
};
type BuildSbtPageInitialStateArgs = {
  network?: unknown;
};
type BuildSbtPageBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};
type BuildSbtPageAddressChangeResetMintUiPatchArgs = {
  forceReset?: unknown;
  sbtAddressChanged?: unknown;
};
type BuildSbtPageNetworkUpdatePatchArgs = {
  network?: unknown;
  resetMintUiState?: Record<string, unknown> | null;
};
type BuildSbtPageMintFailurePatchArgs = {
  error?: unknown;
};
type BuildSbtPageMintPendingPatchArgs = {
  clearError?: unknown;
};
type BuildSbtPageMintSuccessPatchArgs = {
  clearManualPassword?: unknown;
  mintStep?: unknown;
  txHash?: unknown;
};
type BuildSbtPageBurnFailurePatchArgs = {
  error?: unknown;
  resetBurnSearch?: unknown;
};
type BuildSbtPageBurnSuccessPatchArgs = {
  resetBurnSearch?: unknown;
  txHash?: unknown;
};
type BuildSbtPageBurnSearchInputPatchArgs = {
  input?: unknown;
};
type BuildSbtPageBurnSearchResultPatchArgs = {
  address?: unknown;
  resultType?: unknown;
  tokenId?: unknown;
};
type BuildSbtPageErrorPatchArgs = {
  error?: unknown;
};
type BuildSbtPageCachedPasswordsPatchArgs = {
  cachedPasswords?: unknown;
};
type BuildSbtPageMintedModalVisibilityPatchArgs = {
  visible?: unknown;
};
type BuildSbtPageLoadingMintersBurnersPatchArgs = {
  loading?: unknown;
};
type BuildSbtPageLoadInfoLoadingStartPatchArgs = {
  hasExplicitSlug?: unknown;
  normalizedExplicitSlug?: unknown;
};
type BuildSbtPageMintCountdownPatchArgs = {
  countdown?: unknown;
};
type BuildSbtPageIntervalIdPatchArgs = {
  intervalId?: unknown;
};
type BuildSbtPageSbtInfoPatchArgs = {
  sbtInfo?: unknown;
};
type BuildSbtPageResolvedSessionSlugPatchArgs = {
  slug?: unknown;
};
type BuildSbtPageRelevantInfoPatchArgs = {
  sbtLabel?: unknown;
};
type BuildSbtPageLogScanProgressPatchArgs = {
  progress?: unknown;
  slug?: unknown;
};
type BuildSbtPageBookmarkedPatchArgs = {
  bookmarked?: unknown;
};
type BuildSbtPagePasswordMintInputPatchArgs = {
  inputField?: unknown;
  inputValue?: unknown;
};
type BuildSbtPagePasswordInputValuePatchArgs = {
  inputField?: unknown;
  inputValue?: unknown;
};
type BuildSbtPageMintPasswordPrefillPatchArgs = {
  currentGroupPasswordInput?: unknown;
  finalPasswordToUse?: unknown;
  invitePayload?: {
    inviteCode?: unknown;
  } | null;
  isList?: unknown;
};
type BuildSbtPagePasswordClaimStartSuccessPatchArgs = {
  txHash?: unknown;
};
type BuildSbtPageAdminInviteSuccessPatchArgs = {
  passwordList?: unknown;
};
type BuildSbtPageExportFormatPatchArgs = {
  exportFormat?: unknown;
};
type BuildSbtPageIncludePreviousPasswordsPatchArgs = {
  includePreviousPasswords?: unknown;
};
type BuildSbtPagePasswordGenerationCountPatchArgs = {
  value?: unknown;
};
type BuildSbtPageCopiedAddressPatchArgs = {
  addressType?: unknown;
};
type BuildSbtPageCopiedErrorPatchArgs = {
  copied?: unknown;
};
type BuildSbtPageMiniPasswordInputPatchArgs = {
  visible?: unknown;
};
type SbtPageAdminInviteSuccessPatch = {
  adminGeneratedPasswords: unknown[];
  passwordGenerationCount: '';
};
type SbtPageDocModalResetPatch = {
  docModalOpen: false;
  docModalLoading: false;
  docModalError: '';
  docModalContent: '';
  docModalName: '';
  docModalBlobUrl: '';
};
type BuildSbtPageDocModalOpenPatchArgs = {
  blobUrl?: unknown;
  content?: unknown;
  error?: unknown;
  loading?: unknown;
  name?: unknown;
};
type BuildSbtPageDocModalContentPatchArgs = {
  blobUrl?: unknown;
  content?: unknown;
  error?: unknown;
  name?: unknown;
};
type BuildSbtPageDocModalErrorPatchArgs = {
  error?: unknown;
};
type SbtPageDocModalOpenPatch = {
  docModalOpen: true;
  docModalLoading: boolean;
  docModalError: string;
  docModalContent: string;
  docModalName: string;
  docModalBlobUrl: string;
};
type SbtPageDocModalContentPatch = {
  docModalLoading: false;
  docModalError: string;
  docModalContent: string;
  docModalName: string;
  docModalBlobUrl: string;
};
type SbtPageDocModalErrorPatch = {
  docModalLoading: false;
  docModalError: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const buildSbtPageInitialState = ({ network = null }: BuildSbtPageInitialStateArgs = {}): Record<
  string,
  unknown
> => ({
  sbtInfo: null,
  userHasSBT: false,
  userIsSbtAdmin: false,
  claimCountdown: 5,
  error: null,
  copiedAddress: null,
  network,
  bookmarked: false,
  showModal: false,
  showFullImage: false,
  mintedAddresses: [],
  burnedAddresses: [],
  countsLoaded: false,
  holdersMetaKey: null,
  mintedTokensOverride: null,
  showStats: true,
  showActions: true,
  showMoreDetails: false,
  showAdminSection: false,
  showDocsSection: true,
  intervalId: null,
  loadingMintersBurners: true,
  mintingStatus: 'idle',
  burningStatus: 'idle',
  mintPassword: '',
  groupPasswordInput: '',
  mintStep: 0,
  relevantQuestions: [],
  relevantDocuments: [],
  showPasswordAlert: false,
  mintCountdown: null,
  transactionHash: null,
  burnSearchInput: '',
  burnSearchResult: null,
  burnSearchType: null,
  filteredMintedUsers: [],
  filteredMintedUsersSignature: '',
  loadingMintedFilter: false,
  lastTransactionType: null,
  adminInvitesToGenerate: '',
  adminGeneratedPasswords: [],
  manualPasswordInput: '',
  createGroupMode: false,
  passwordGenerationCount: '',
  mintingAddressesFilterInitialized: false,
  includePreviousPasswords: false,
  exportFormat: 'json',
  encryptedRecoveryEnabled: false,
  encryptedRecoveryStatus: 'idle',
  cachedPasswords: [],
  newPasswords: [],
  lastMintTxHash: null,
  lastBurnTxHash: null,
  showMiniPasswordInput: false,
  hasGroupPasswordMint: false,
  hasInviteMint: false,
  groupPasswordHash: null,
  groupPasswordHashLoaded: false,
  docModalOpen: false,
  docModalLoading: false,
  docModalError: '',
  docModalContent: '',
  docModalName: '',
  docModalBlobUrl: '',
  resolvedSessionSlug: null,
  logScanProgress: null,
  displayImageFallbackKey: '',
  displayImageFallbackIndex: 0,
});

export const buildSbtPageBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: BuildSbtPageBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = isRecord(state) ? state : {};
  return {
    [key]: !source[key],
  };
};

export const buildSbtPageAddressChangeResetMintUiPatch = ({
  forceReset = false,
  sbtAddressChanged = false,
}: BuildSbtPageAddressChangeResetMintUiPatchArgs = {}): Record<string, unknown> | null =>
  sbtAddressChanged || forceReset
    ? {
        showMiniPasswordInput: false,
        mintStep: 0,
        mintingStatus: 'idle',
        burningStatus: 'idle',
        manualPasswordInput: '',
        groupPasswordInput: '',
        mintPassword: '',
        showPasswordAlert: false,
        error: null,
      }
    : null;

export const buildSbtPageNetworkUpdatePatch = ({
  network = null,
  resetMintUiState = null,
}: BuildSbtPageNetworkUpdatePatchArgs = {}): Record<string, unknown> => ({
  ...(resetMintUiState || {}),
  network,
});

export const buildSbtPageMintFailurePatch = ({ error = null }: BuildSbtPageMintFailurePatchArgs = {}): Record<
  string,
  unknown
> => ({
  error,
  mintingStatus: 'failure',
});

export const buildSbtPageMintPendingPatch = ({ clearError = false }: BuildSbtPageMintPendingPatchArgs = {}): Record<
  string,
  unknown
> => ({
  mintingStatus: 'pending',
  lastTransactionType: 'mint',
  ...(clearError === true ? { error: null } : {}),
});

export const buildSbtPageMintSuccessPatch = ({
  clearManualPassword = false,
  mintStep,
  txHash = '',
}: BuildSbtPageMintSuccessPatchArgs = {}): Record<string, unknown> => ({
  mintingStatus: 'success',
  transactionHash: txHash,
  lastTransactionType: 'mint',
  lastMintTxHash: txHash,
  ...(mintStep !== undefined ? { mintStep } : {}),
  ...(clearManualPassword === true ? { manualPasswordInput: '' } : {}),
});

export const buildSbtPageBurnFailurePatch = ({
  error = null,
  resetBurnSearch = false,
}: BuildSbtPageBurnFailurePatchArgs = {}): Record<string, unknown> => ({
  error,
  burningStatus: 'failure',
  ...(resetBurnSearch === true
    ? {
        burnSearchInput: '',
        burnSearchResult: null,
        burnSearchType: null,
      }
    : {}),
});

export const buildSbtPageBurnPendingPatch = (): Record<string, string> => ({
  burningStatus: 'pending',
  lastTransactionType: 'burn',
});

export const buildSbtPageBurnSuccessPatch = ({
  resetBurnSearch = false,
  txHash = '',
}: BuildSbtPageBurnSuccessPatchArgs = {}): Record<string, unknown> => ({
  burningStatus: 'success',
  transactionHash: txHash,
  lastTransactionType: 'burn',
  lastBurnTxHash: txHash,
  ...(resetBurnSearch === true
    ? {
        burnSearchInput: '',
        burnSearchResult: null,
        burnSearchType: null,
      }
    : {}),
});

export const buildSbtPageBurnSearchInputPatch = ({ input = '' }: BuildSbtPageBurnSearchInputPatchArgs = {}): Record<
  string,
  unknown
> => ({
  burnSearchInput: String(input ?? ''),
  burnSearchResult: null,
  burnSearchType: null,
});

export const buildSbtPageBurnSearchResultPatch = ({
  address = '',
  resultType = '',
  tokenId = null,
}: BuildSbtPageBurnSearchResultPatchArgs = {}): Record<string, unknown> => ({
  burnSearchResult: {
    address,
    tokenId,
  },
  burnSearchType: String(resultType ?? ''),
});

export const buildSbtPageErrorPatch = ({ error = null }: BuildSbtPageErrorPatchArgs = {}): Record<string, unknown> => ({
  error,
});

export const buildSbtPageCachedPasswordsPatch = ({
  cachedPasswords = [],
}: BuildSbtPageCachedPasswordsPatchArgs = {}): Record<string, unknown> => ({
  cachedPasswords,
});

export const buildSbtPageMintedModalVisibilityPatch = ({
  visible = false,
}: BuildSbtPageMintedModalVisibilityPatchArgs = {}): Record<string, boolean> => ({
  showModal: visible === true,
});

export const buildSbtPageMintedModalInitialFilterPatch = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  netHolders = [],
}: BuildSbtPageMintedModalInitialFilterPatchArgs = {}): SbtPageMintedModalInitialFilterPatch => {
  const safeNetHolders = Array.isArray(netHolders) ? netHolders : [];
  return {
    filteredMintedUsers: safeNetHolders,
    filteredMintedUsersSignature: buildAddressListSignature(safeNetHolders),
    mintingAddressesFilterInitialized: true,
    loadingMintedFilter: false,
  };
};

export const buildSbtPageLoadingMintersBurnersPatch = ({
  loading = false,
}: BuildSbtPageLoadingMintersBurnersPatchArgs = {}): Record<string, boolean> => ({
  loadingMintersBurners: loading === true,
});

export const buildSbtPageLoadInfoLoadingStartPatch = ({
  hasExplicitSlug = false,
  normalizedExplicitSlug = null,
}: BuildSbtPageLoadInfoLoadingStartPatchArgs = {}): Record<string, unknown> => ({
  loadingMintersBurners: true,
  logScanProgress: null,
  ...(hasExplicitSlug === true ? { resolvedSessionSlug: normalizedExplicitSlug } : {}),
});

export const buildSbtPageMintCountdownPatch = ({ countdown = null }: BuildSbtPageMintCountdownPatchArgs = {}): Record<
  string,
  unknown
> => ({
  mintCountdown: countdown,
});

export const buildSbtPageIntervalIdPatch = ({ intervalId = null }: BuildSbtPageIntervalIdPatchArgs = {}): Record<
  string,
  unknown
> => ({
  intervalId,
});

export const buildSbtPageSbtInfoPatch = ({ sbtInfo = null }: BuildSbtPageSbtInfoPatchArgs = {}): Record<
  string,
  unknown
> => ({
  sbtInfo,
});

export const buildSbtPageResolvedSessionSlugPatch = ({
  slug = null,
}: BuildSbtPageResolvedSessionSlugPatchArgs = {}): Record<string, unknown> => ({
  resolvedSessionSlug: slug,
});

export const buildSbtPageRelevantInfoPatch = ({ sbtLabel = 'SBT' }: BuildSbtPageRelevantInfoPatchArgs = {}): Record<
  string,
  unknown
> => {
  const label = String(sbtLabel || 'SBT');
  return {
    relevantQuestions: [`What is the purpose of this ${label}?`, `How can I use this ${label}?`],
    relevantDocuments: [`${label} Whitepaper`, 'Community Guidelines'],
  };
};

export const buildSbtPageLogScanProgressPatch = ({
  progress = {},
  slug = '',
}: BuildSbtPageLogScanProgressPatchArgs = {}): Record<string, unknown> => ({
  logScanProgress: {
    ...(isRecord(progress) ? progress : {}),
    slug,
  },
});

export const buildSbtPageBookmarkedPatch = ({ bookmarked = false }: BuildSbtPageBookmarkedPatchArgs = {}): Record<
  string,
  boolean
> => ({
  bookmarked: bookmarked === true,
});

export const buildSbtPagePasswordMintInputPatch = ({
  inputField = 'groupPasswordInput',
  inputValue = '',
}: BuildSbtPagePasswordMintInputPatchArgs = {}): Record<string, unknown> => {
  const field = inputField === 'manualPasswordInput' ? 'manualPasswordInput' : 'groupPasswordInput';
  return {
    [field]: String(inputValue ?? ''),
    mintingStatus: 'idle',
    mintStep: 0,
    error: null,
  };
};

export const buildSbtPagePasswordInputValuePatch = ({
  inputField = 'groupPasswordInput',
  inputValue = '',
}: BuildSbtPagePasswordInputValuePatchArgs = {}): Record<string, unknown> => {
  const field = inputField === 'manualPasswordInput' ? 'manualPasswordInput' : 'groupPasswordInput';
  return {
    [field]: String(inputValue ?? ''),
  };
};

export const buildSbtPageMintPasswordPrefillPatch = ({
  currentGroupPasswordInput = '',
  finalPasswordToUse = '',
  invitePayload = null,
  isList = false,
}: BuildSbtPageMintPasswordPrefillPatchArgs = {}): Record<string, unknown> => {
  const hasInvitePayload = !!invitePayload;
  const shouldHidePlainPassword = isList === true || hasInvitePayload;
  return {
    mintPassword: shouldHidePlainPassword ? '' : finalPasswordToUse,
    manualPasswordInput: shouldHidePlainPassword ? '' : finalPasswordToUse,
    groupPasswordInput: hasInvitePayload ? invitePayload?.inviteCode : currentGroupPasswordInput,
    mintStep: 0,
    showPasswordAlert: isList !== true && !hasInvitePayload,
  };
};

export const buildSbtPageMintPasswordClearPatch = (): Record<string, unknown> => ({
  mintPassword: '',
  manualPasswordInput: '',
  showPasswordAlert: false,
});

export const buildSbtPagePasswordClaimStartSuccessPatch = ({
  txHash = '',
}: BuildSbtPagePasswordClaimStartSuccessPatchArgs = {}): Record<string, unknown> => ({
  mintStep: 1,
  mintingStatus: 'idle',
  transactionHash: txHash,
});

export const buildSbtPageAdminInviteSuccessPatch = ({
  passwordList = [],
}: BuildSbtPageAdminInviteSuccessPatchArgs = {}): SbtPageAdminInviteSuccessPatch => ({
  adminGeneratedPasswords: Array.isArray(passwordList) ? passwordList : [],
  passwordGenerationCount: '',
});

export const buildSbtPageExportFormatPatch = ({ exportFormat = '' }: BuildSbtPageExportFormatPatchArgs = {}): Record<
  string,
  unknown
> => ({
  exportFormat: String(exportFormat ?? ''),
});

export const buildSbtPageIncludePreviousPasswordsPatch = ({
  includePreviousPasswords = false,
}: BuildSbtPageIncludePreviousPasswordsPatchArgs = {}): Record<string, boolean> => ({
  includePreviousPasswords: includePreviousPasswords === true,
});

export const buildSbtPagePasswordGenerationCountPatch = ({
  value = '',
}: BuildSbtPagePasswordGenerationCountPatchArgs = {}): Record<string, unknown> => {
  const parsed = parseInt(String(value ?? ''), 10);
  return {
    passwordGenerationCount: isNaN(parsed) ? '' : parsed,
  };
};

export const buildSbtPageCopiedAddressPatch = ({ addressType = null }: BuildSbtPageCopiedAddressPatchArgs = {}): Record<
  string,
  unknown
> => ({
  copiedAddress: addressType,
});

export const buildSbtPageCopiedErrorPatch = ({ copied = false }: BuildSbtPageCopiedErrorPatchArgs = {}): Record<
  string,
  boolean
> => ({
  copiedError: copied === true,
});

export const buildSbtPageMiniPasswordInputPatch = ({
  visible = false,
}: BuildSbtPageMiniPasswordInputPatchArgs = {}): Record<string, boolean> => ({
  showMiniPasswordInput: visible === true,
});

export const buildSbtPageDocModalResetPatch = (): SbtPageDocModalResetPatch => ({
  docModalOpen: false,
  docModalLoading: false,
  docModalError: '',
  docModalContent: '',
  docModalName: '',
  docModalBlobUrl: '',
});

export const buildSbtPageDocModalOpenPatch = ({
  blobUrl = '',
  content = '',
  error = '',
  loading = false,
  name = '',
}: BuildSbtPageDocModalOpenPatchArgs = {}): SbtPageDocModalOpenPatch => ({
  docModalOpen: true,
  docModalLoading: Boolean(loading),
  docModalError: String(error ?? ''),
  docModalContent: String(content ?? ''),
  docModalName: String(name ?? ''),
  docModalBlobUrl: String(blobUrl ?? ''),
});

export const buildSbtPageDocModalContentPatch = ({
  blobUrl = '',
  content = '',
  error = '',
  name = '',
}: BuildSbtPageDocModalContentPatchArgs = {}): SbtPageDocModalContentPatch => ({
  docModalLoading: false,
  docModalError: String(error ?? ''),
  docModalContent: String(content ?? ''),
  docModalName: String(name ?? ''),
  docModalBlobUrl: String(blobUrl ?? ''),
});

export const buildSbtPageDocModalErrorPatch = ({
  error = '',
}: BuildSbtPageDocModalErrorPatchArgs = {}): SbtPageDocModalErrorPatch => ({
  docModalLoading: false,
  docModalError: String(error ?? ''),
});
