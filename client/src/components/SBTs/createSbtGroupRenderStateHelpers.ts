type CreateSbtDistributionOptionConfig = Record<string, unknown> & {
  shouldUseActiveClass?: boolean;
  selected?: boolean;
  value?: unknown;
};
type BuildCreateSbtRenderStateArgs = {
  create2Salt?: unknown;
  deferredDeployMode?: unknown;
  deferredSurfaceBg?: unknown;
  descriptionSelectedGateIds?: unknown;
  distributionConfigs?: unknown;
  distributionOption?: unknown;
  docsSelectedGateIds?: unknown;
  documentURLs?: unknown;
  documentUrl?: unknown;
  imageSelectedGateIds?: unknown;
  isLimited?: unknown;
  nameSelectedGateIds?: unknown;
  normalizeDocumentUrlDraft?: ((documentUrl: unknown) => unknown) | null;
  sbtDescription?: unknown;
  sbtImageFile?: unknown;
  sbtImageUrl?: unknown;
  sbtName?: unknown;
  tags?: unknown;
  tagsSelectedGateIds?: unknown;
};
type ResolveCreateSbtInfoDisplayStateArgs = {
  documentURLs?: unknown;
  imageSelectedGateIds?: unknown;
  nameSelectedGateIds?: unknown;
  tags?: unknown;
};
type ResolveCreateSbtMintOptionsDisplayStateArgs = {
  hideNetworkSelector?: unknown;
  isLimited?: unknown;
  isTimeLimited?: unknown;
  predictableAddressActive?: unknown;
  predictedAddressBusy?: unknown;
};
type ResolveCreateSbtActionDisplayStateArgs = {
  currentStep?: unknown;
  distributionOption?: unknown;
  mintingFailed?: unknown;
  sbtMinted?: unknown;
  startedMinting?: unknown;
};
type ResolveCreateSbtPrimaryActionLabelArgs = {
  createActionLabel?: unknown;
  currentStep?: unknown;
  deferredDeployMode?: unknown;
  mintedLabel?: unknown;
  mintingLabel?: unknown;
  sbtMinted?: unknown;
};
type ResolveCreateSbtPrimaryButtonStateArgs = {
  sbtMinted?: unknown;
  startedMinting?: unknown;
};
type CreateSbtPrimaryButtonState = {
  disabled: boolean;
};
type ResolveCreateSbtClearFormButtonStateArgs = {
  isDirty?: unknown;
  sbtMinted?: unknown;
};
type CreateSbtClearFormButtonState = {
  shouldShowClearFormButton: boolean;
};
type BuildCreateSbtProgressIndicatorStateArgs = {
  currentStep?: unknown;
  sbtMinted?: unknown;
};
type BuildCreateSbtProgressStepClassNameArgs = {
  completed?: unknown;
  completedClassName?: unknown;
  pendingClassName?: unknown;
};
type CreateSbtProgressStepState = {
  completed: boolean;
  iconState: 'attention' | 'check' | 'spinner';
  spin: boolean;
};
type CreateSbtProgressIndicatorState = {
  imageUploadStep: CreateSbtProgressStepState;
  mintStep: CreateSbtProgressStepState;
  tokenUriUploadStep: CreateSbtProgressStepState;
};
type ResolveCreateSbtSuccessDisplayStateArgs = {
  distributionOption?: unknown;
  openMintAutoJoinUrl?: unknown;
  passwordList?: unknown;
  sbtInviteLinks?: unknown;
  sbtMinted?: unknown;
  showJson?: unknown;
  startedMinting?: unknown;
  tokenURI?: unknown;
};
type ResolveCreateSbtCopyActionDisplayStateArgs = {
  copied?: unknown;
  copiedLabel?: unknown;
  defaultLabel?: unknown;
};
type ResolveCreateSbtBookmarkActionDisplayStateArgs = {
  bookmarkedColor?: unknown;
  bookmarkedSbtsSet?: unknown;
  sbtAddress?: unknown;
};
type CreateSbtSuccessDisplayState = {
  shouldRenderContractAddress: boolean;
  shouldRenderGroupPasswordAutoJoin: boolean;
  shouldRenderInviteLinks: boolean;
  shouldRenderJsonPanel: boolean;
  shouldRenderOpenMintAutoJoin: boolean;
  shouldRenderPasswordRecovery: boolean;
  shouldRenderSuccessPanel: boolean;
  shouldRenderTokenUriLink: boolean;
};
type CreateSbtCopyActionDisplayState = {
  label: string;
  shouldRenderCopiedIcon: boolean;
  shouldRenderDefaultIcon: boolean;
};
type CreateSbtBookmarkActionDisplayState = {
  iconStyle: Record<string, string | undefined>;
  isBookmarked: boolean;
};
type CreateSbtRenderState = {
  createActionLabel: string;
  distributionOptions: CreateSbtDistributionOptionConfig[];
  headerTitle: string;
  isDirty: boolean;
  isLimitedWithPasswords: boolean;
  isPasswordDistribution: boolean;
  predictableAddressLocked: boolean;
  rootSurfaceStyle?: Record<string, string>;
};
type CreateSbtInfoDisplayState = {
  shouldRenderDocumentUrlList: boolean;
  shouldRenderImageLockHelp: boolean;
  shouldRenderNameLockHelp: boolean;
  shouldRenderTagPills: boolean;
};
type CreateSbtMintOptionsDisplayState = {
  shouldRenderLimitedNumberInput: boolean;
  shouldRenderNetworkReadonly: boolean;
  shouldRenderNetworkSelector: boolean;
  shouldRenderPredictableAddressBusy: boolean;
  shouldRenderPredictableAddressDetails: boolean;
  shouldRenderTimeLimitedInput: boolean;
  shouldUseLimitedOptionActiveClass: boolean;
  shouldUsePredictableAddressActiveClass: boolean;
  shouldUseTimeLimitedOptionActiveClass: boolean;
};
type CreateSbtActionDisplayState = {
  shouldRenderGroupPasswordInput: boolean;
  shouldRenderMintingFailureIcon: boolean;
  shouldRenderProgressIndicator: boolean;
  shouldRenderStartFreshButton: boolean;
};

const isCreateSbtRenderPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasCreateSbtTextValue = (value: unknown): boolean => String(value || '').trim().length > 0;

const hasCreateSbtLength = (value: unknown): boolean => (Array.isArray(value) ? value.length > 0 : false);

const hasCreateSbtDisplayLength = (value: unknown): boolean => Number((value as { length?: unknown })?.length || 0) > 0;

export const resolveCreateSbtInfoDisplayState = ({
  documentURLs = [],
  imageSelectedGateIds = [],
  nameSelectedGateIds = [],
  tags = [],
}: ResolveCreateSbtInfoDisplayStateArgs = {}): CreateSbtInfoDisplayState => ({
  shouldRenderDocumentUrlList: hasCreateSbtDisplayLength(documentURLs),
  shouldRenderImageLockHelp: hasCreateSbtDisplayLength(imageSelectedGateIds),
  shouldRenderNameLockHelp: hasCreateSbtDisplayLength(nameSelectedGateIds),
  shouldRenderTagPills: hasCreateSbtDisplayLength(tags),
});

export const resolveCreateSbtMintOptionsDisplayState = ({
  hideNetworkSelector = false,
  isLimited = false,
  isTimeLimited = false,
  predictableAddressActive = false,
  predictedAddressBusy = false,
}: ResolveCreateSbtMintOptionsDisplayStateArgs = {}): CreateSbtMintOptionsDisplayState => ({
  shouldRenderLimitedNumberInput: !!isLimited,
  shouldRenderNetworkReadonly: !!hideNetworkSelector,
  shouldRenderNetworkSelector: !hideNetworkSelector,
  shouldRenderPredictableAddressBusy: !!predictableAddressActive && !!predictedAddressBusy,
  shouldRenderPredictableAddressDetails: !!predictableAddressActive,
  shouldRenderTimeLimitedInput: !!isTimeLimited,
  shouldUseLimitedOptionActiveClass: !!isLimited,
  shouldUsePredictableAddressActiveClass: !!predictableAddressActive,
  shouldUseTimeLimitedOptionActiveClass: !!isTimeLimited,
});

export const resolveCreateSbtActionDisplayState = ({
  currentStep = 0,
  distributionOption = '',
  mintingFailed = false,
  sbtMinted = false,
  startedMinting = false,
}: ResolveCreateSbtActionDisplayStateArgs = {}): CreateSbtActionDisplayState => {
  const step = Number(currentStep || 0);
  return {
    shouldRenderGroupPasswordInput: String(distributionOption || '') === 'groupPassword',
    shouldRenderMintingFailureIcon: !!mintingFailed && step > 0,
    shouldRenderProgressIndicator: !!startedMinting,
    shouldRenderStartFreshButton: !!sbtMinted,
  };
};

export const buildCreateSbtRenderState = ({
  create2Salt = '',
  deferredDeployMode = false,
  deferredSurfaceBg = '',
  descriptionSelectedGateIds = [],
  distributionConfigs = [],
  distributionOption = '',
  docsSelectedGateIds = [],
  documentURLs = [],
  documentUrl = '',
  imageSelectedGateIds = [],
  isLimited = false,
  nameSelectedGateIds = [],
  normalizeDocumentUrlDraft = null,
  sbtDescription = '',
  sbtImageFile = null,
  sbtImageUrl = '',
  sbtName = '',
  tags = [],
  tagsSelectedGateIds = [],
}: BuildCreateSbtRenderStateArgs = {}): CreateSbtRenderState => {
  const normalizedDocumentUrlDraft =
    typeof normalizeDocumentUrlDraft === 'function' ? normalizeDocumentUrlDraft(documentUrl) : [];
  const hasDocumentUrlDraft = Array.isArray(normalizedDocumentUrlDraft)
    ? normalizedDocumentUrlDraft.length > 0
    : hasCreateSbtTextValue(normalizedDocumentUrlDraft);
  const isDeferredDeployMode = !!deferredDeployMode;
  const resolvedDistributionOption = String(distributionOption || '');
  const isPasswordDistribution =
    resolvedDistributionOption === 'hasPasswords' || resolvedDistributionOption === 'groupPassword';

  return {
    createActionLabel: isDeferredDeployMode ? 'Add to Session' : 'Create',
    distributionOptions: (Array.isArray(distributionConfigs) ? distributionConfigs : []).map((optionInput: unknown) => {
      const option = isCreateSbtRenderPlainObject(optionInput)
        ? (optionInput as CreateSbtDistributionOptionConfig)
        : {};
      return {
        ...option,
        selected: option.value === distributionOption,
        shouldUseActiveClass: option.value === distributionOption,
      };
    }),
    headerTitle: isDeferredDeployMode ? 'Add to Session' : 'Create',
    isLimitedWithPasswords: !!isLimited && isPasswordDistribution,
    isPasswordDistribution,
    isDirty:
      hasCreateSbtTextValue(sbtName) ||
      hasCreateSbtTextValue(sbtDescription) ||
      !!sbtImageFile ||
      hasCreateSbtTextValue(sbtImageUrl) ||
      hasDocumentUrlDraft ||
      hasCreateSbtLength(documentURLs) ||
      hasCreateSbtLength(nameSelectedGateIds) ||
      hasCreateSbtLength(descriptionSelectedGateIds) ||
      hasCreateSbtLength(tagsSelectedGateIds) ||
      hasCreateSbtLength(docsSelectedGateIds) ||
      hasCreateSbtLength(imageSelectedGateIds) ||
      hasCreateSbtTextValue(create2Salt) ||
      hasCreateSbtLength(tags),
    predictableAddressLocked: isDeferredDeployMode || resolvedDistributionOption === 'groupPassword',
    ...(isDeferredDeployMode
      ? { rootSurfaceStyle: { '--ce-create-group-surface-bg': String(deferredSurfaceBg || '') } }
      : {}),
  };
};

export const resolveCreateSbtPrimaryActionLabel = ({
  createActionLabel = 'Create',
  currentStep = 0,
  deferredDeployMode = false,
  mintedLabel = 'Minted',
  mintingLabel = 'Minting',
  sbtMinted = false,
}: ResolveCreateSbtPrimaryActionLabelArgs = {}): string => {
  const actionLabel = String(createActionLabel || '');
  const mintingText = String(mintingLabel || '');
  if (sbtMinted) return `${String(mintedLabel || '')}!`;
  if (currentStep === 0) return actionLabel;
  if (currentStep === 1) return 'Uploading Image...';
  if (currentStep === 2) return 'Uploading URI...';
  if (currentStep === 3) return deferredDeployMode ? 'Saving Draft...' : `${mintingText}...`;
  return actionLabel;
};

export const resolveCreateSbtPrimaryButtonState = ({
  sbtMinted = false,
  startedMinting = false,
}: ResolveCreateSbtPrimaryButtonStateArgs = {}): CreateSbtPrimaryButtonState => ({
  disabled: !!sbtMinted || !!startedMinting,
});

export const resolveCreateSbtClearFormButtonState = ({
  isDirty = false,
  sbtMinted = false,
}: ResolveCreateSbtClearFormButtonStateArgs = {}): CreateSbtClearFormButtonState => ({
  shouldShowClearFormButton: !!isDirty && !sbtMinted,
});

export const buildCreateSbtProgressIndicatorState = ({
  currentStep = 0,
  sbtMinted = false,
}: BuildCreateSbtProgressIndicatorStateArgs = {}): CreateSbtProgressIndicatorState => {
  const step = currentStep as number;
  return {
    imageUploadStep: {
      completed: step >= 1,
      iconState: step === 1 ? 'spinner' : step > 1 ? 'check' : 'attention',
      spin: step === 1,
    },
    tokenUriUploadStep: {
      completed: step >= 2,
      iconState: step === 2 ? 'spinner' : step > 2 ? 'check' : 'attention',
      spin: step === 2,
    },
    mintStep: {
      completed: step >= 3,
      iconState: step === 3 && !sbtMinted ? 'spinner' : step >= 3 ? 'check' : 'attention',
      spin: step === 3 && !sbtMinted,
    },
  };
};

export const buildCreateSbtProgressStepClassName = ({
  completed = false,
  completedClassName = '',
  pendingClassName = '',
}: BuildCreateSbtProgressStepClassNameArgs = {}): string =>
  String((completed ? completedClassName : pendingClassName) || '');

export const resolveCreateSbtSuccessDisplayState = ({
  distributionOption = '',
  openMintAutoJoinUrl = '',
  passwordList = [],
  sbtInviteLinks = [],
  sbtMinted = false,
  showJson = false,
  startedMinting = false,
  tokenURI = '',
}: ResolveCreateSbtSuccessDisplayStateArgs = {}): CreateSbtSuccessDisplayState => {
  const isMinted = !!sbtMinted;
  const option = String(distributionOption || '');
  const inviteLinkCount = Number((sbtInviteLinks as { length?: unknown })?.length || 0);
  return {
    shouldRenderContractAddress: !!startedMinting,
    shouldRenderGroupPasswordAutoJoin: option === 'groupPassword',
    shouldRenderInviteLinks: isMinted && option === 'hasPasswords' && inviteLinkCount > 0,
    shouldRenderJsonPanel: !!showJson && isMinted,
    shouldRenderOpenMintAutoJoin: !!openMintAutoJoinUrl,
    shouldRenderPasswordRecovery:
      isMinted && option !== 'hasPasswords' && Array.isArray(passwordList) && passwordList.length > 0,
    shouldRenderSuccessPanel: isMinted,
    shouldRenderTokenUriLink: !!tokenURI,
  };
};

export const resolveCreateSbtCopyActionDisplayState = ({
  copied = false,
  copiedLabel = '',
  defaultLabel = '',
}: ResolveCreateSbtCopyActionDisplayStateArgs = {}): CreateSbtCopyActionDisplayState => {
  const isCopied = !!copied;
  const fallbackLabel = String(defaultLabel || '');
  const copiedText = String(copiedLabel || fallbackLabel);
  return {
    label: isCopied ? copiedText : fallbackLabel,
    shouldRenderCopiedIcon: isCopied,
    shouldRenderDefaultIcon: !isCopied,
  };
};

export const resolveCreateSbtBookmarkActionDisplayState = ({
  bookmarkedColor = 'var(--ce-status-warning-text)',
  bookmarkedSbtsSet = null,
  sbtAddress = '',
}: ResolveCreateSbtBookmarkActionDisplayStateArgs = {}): CreateSbtBookmarkActionDisplayState => {
  const normalizedAddress = String(sbtAddress).toLowerCase();
  const isBookmarked = bookmarkedSbtsSet instanceof Set && bookmarkedSbtsSet.has(normalizedAddress);
  return {
    iconStyle: {
      color: isBookmarked ? String(bookmarkedColor || 'var(--ce-status-warning-text)') : undefined,
    },
    isBookmarked,
  };
};
