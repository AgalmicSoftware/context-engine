import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { isPublishUploadBootstrapReachabilityError } from '../../utilities/arweave/publishUploadAuth.js';
import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
import {
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateStateForResource,
  SPONSORED_GATE_STATES,
} from '../../utilities/web3/sponsoredAccess.js';
import { normalizePositiveChainId } from './createSbtGroupAuthoringChainHelpers';
import type { CreateSbtAuthoringChainOption } from './createSbtGroupAuthoringChainHelpers';
import { resolveCreateSbtEncryptedFieldGateValue } from './createSbtGroupMetadataLockHelpers';
export {
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtAuthoringContractRefs,
  contractRefMatchesChain,
  getConfiguredContractAddress,
  hasUsableCreateSbtFactoryForChain,
  normalizePositiveChainId,
  normalizeSessionContractRef,
  resolveCreateSbtAuthoringChainOptions,
  resolveCreateSbtAuthoringChainState,
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtPreferredAuthoringChainId,
  selectPreferredChainId,
  shouldHideCreateSbtNetworkSelector,
} from './createSbtGroupAuthoringChainHelpers';
export type {
  BuildCreateSbtAuthoringChainSyncPatchArgs,
  BuildCreateSbtAuthoringChainSyncStatePatchArgs,
  BuildCreateSbtAuthoringContractRefsArgs,
  CreateSbtAuthoringChainOption,
  CreateSbtAuthoringChainState,
  NormalizedSessionContractRef,
  ResolveCreateSbtAuthoringChainOptionsArgs,
  ResolveCreateSbtPreferredAuthoringChainIdArgs,
} from './createSbtGroupAuthoringChainHelpers';
export {
  buildCreateSbtAutoJoinUrl,
  buildSessionRoutePath,
  resolveCreateSbtEffectiveSessionSlug,
  resolveCreateSbtMetadataSessionSlug,
  resolveCreateSbtOpenMintAutoJoinUrl,
} from './createSbtGroupRouteHelpers';
export { buildCreateSbtFormCachePayload } from './createSbtGroupFormCachePayloadHelpers';
export type { CreateSbtFormCachePayload } from './createSbtGroupFormCachePayloadHelpers';
export {
  buildCreateSbtDefaultDistributionState,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtInitialState,
  buildCreateSbtResetFormState,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtRestoredPredictableAddressEnabled,
} from './createSbtGroupFormStateHelpers';
export type {
  BuildCreateSbtDefaultDistributionStateArgs,
  BuildCreateSbtInitialStateArgs,
  BuildCreateSbtResetFormStateArgs,
} from './createSbtGroupFormStateHelpers';
export {
  buildCreateSbtDeferredDraftCreate2Salt,
  buildCreateSbtInviteLinks,
  buildCreateSbtPasswordExportFile,
  generateCreateSbtInviteNonces,
  generateCreateSbtRandomHexString,
  resolveCreateSbtInviteCodeList,
  resolveCreateSbtPasswordGenerationCount,
  resolveCreateSbtPredictablePasswordListDecision,
} from './createSbtGroupPasswordHelpers';
export type { CreateSbtPasswordExportFile } from './createSbtGroupPasswordHelpers';
export {
  areMetadataLockGateMapsEqual,
  areStringArraysEqual,
  buildCreateSbtMetadataLockSelectionState,
  createEmptyMetadataLockGateIds,
  getCreateSbtValidGateIds,
  getMetadataFieldLockGateIds,
  METADATA_LOCK_FIELDS,
  normalizeCreateSbtMetadataLockGateIdsForValidGates,
  normalizeMetadataLockGateIds,
  resolveCreateSbtEncryptedFieldGateValue,
  resolveCreateSbtLegacyDescriptionLockGateIds,
  resolveCreateSbtMetadataFieldGateIds,
  resolveCreateSbtRestoredMetadataLockGateIds,
  writeCreateSbtEncryptedFieldGate,
} from './createSbtGroupMetadataLockHelpers';
export {
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImagePreviewState,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtSelectedImageFilePatch,
  getCanonicalCreateSbtMetadataImageUrl,
  getFetchableCreateSbtImageUrl,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtMetadataImageSource,
} from './createSbtGroupImageHelpers';
export {
  buildCreateSbtProgressIndicatorState,
  buildCreateSbtProgressStepClassName,
  buildCreateSbtRenderState,
  resolveCreateSbtActionDisplayState,
  resolveCreateSbtBookmarkActionDisplayState,
  resolveCreateSbtClearFormButtonState,
  resolveCreateSbtCopyActionDisplayState,
  resolveCreateSbtInfoDisplayState,
  resolveCreateSbtMintOptionsDisplayState,
  resolveCreateSbtPrimaryActionLabel,
  resolveCreateSbtPrimaryButtonState,
  resolveCreateSbtSuccessDisplayState,
} from './createSbtGroupRenderStateHelpers';
export {
  buildCreateSbtActiveClassName,
  buildCreateSbtActionLinkClassName,
  buildCreateSbtCollapseHeaderClassName,
  buildCreateSbtCollapseTogglePatch,
  buildCreateSbtInlineFieldLockClassName,
  buildCreateSbtTokenInfoMetaCardClassName,
  resolveCreateSbtActionIconStyle,
  resolveCreateSbtCollapseHeaderDisplayState,
  resolveCreateSbtFailureIconStyle,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtShareableTooltipIconStyle,
  resolveCreateSbtTooltipIconStyle,
} from './createSbtGroupDisplayHelpers';
export type {
  BuildCreateSbtActionLinkClassNameArgs,
  BuildCreateSbtActiveClassNameArgs,
  BuildCreateSbtCollapseHeaderClassNameArgs,
  BuildCreateSbtCollapseTogglePatchArgs,
  BuildCreateSbtInlineFieldLockClassNameArgs,
  BuildCreateSbtTokenInfoMetaCardClassNameArgs,
  CreateSbtCollapseHeaderDisplayState,
  CreateSbtHiddenQrDisplayState,
  ResolveCreateSbtCollapseHeaderDisplayStateArgs,
} from './createSbtGroupDisplayHelpers';
export {
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtBookmarkedSbtsSetPatch,
  buildCreateSbtCopiedLinkIndexPatch,
  buildCreateSbtCopySuccessPatch,
  buildCreateSbtCountdownStartPatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtDeferredSaveCompletePatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtEditResetPatch,
  buildCreateSbtErrorPatch,
  buildCreateSbtExportFormatPatch,
  buildCreateSbtGroupHashPatch,
  buildCreateSbtInputChangePatch,
  buildCreateSbtInviteLinksBackupPatch,
  buildCreateSbtMetadataLockFallbackPatch,
  buildCreateSbtMetadataLockGateIdsPatch,
  buildCreateSbtMetadataLockSelectionPatch,
  buildCreateSbtMintResetFailurePatch,
  buildCreateSbtMintStartPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtMintValidationFailurePatch,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtNumInviteLinksPatch,
  buildCreateSbtOpenLockKeyPatch,
  buildCreateSbtPasswordListPatch,
  buildCreateSbtPredictedAddressBusyPatch,
  buildCreateSbtPredictedAddressPatch,
  buildCreateSbtShareableUrlPatch,
  buildCreateSbtSymbolPatch,
  normalizeComparableAddress,
} from './createSbtGroupStatePatchHelpers';
export {
  buildCreateSbtAutoCreate2SaltSource,
  buildCreateSbtDeterministicSymbol,
  buildCreateSbtPredictableDeploySignature,
  resolveCreateSbtPredictedAddressCacheHit,
  resolveCreateSbtPredictedAddressDisplayText,
  resolveCreateSbtPredictableAddressActive,
  resolveCreateSbtPredictableDeployBaseState,
} from './createSbtGroupPredictableDeployHelpers';
export {
  buildCreateSbtCurrentTagInputPatch,
  buildCreateSbtDocumentIdHashList,
  buildCreateSbtDocumentUrlAdditionPatch,
  buildCreateSbtDocumentUrlRemovalPatch,
  buildCreateSbtMetadataPreviewTagList,
  buildCreateSbtRelevantDefaultTagSyncPatch,
  buildCreateSbtRelevantDefaultTagSyncState,
  buildCreateSbtTagAdditionState,
  buildCreateSbtTagRemovalState,
  buildCreateSbtTokenTagList,
  buildEffectiveCreateSbtDocumentUrls,
  buildUniqueTagList,
  normalizeCreateSbtDocumentUrlDraft,
  normalizeCreateSbtRestoredTags,
  parseDefaultSbtTags,
  removeCreateSbtDocumentUrlAtIndex,
  resolveCreateSbtDocumentUrlInputState,
  resolveCreateSbtTagInputState,
} from './createSbtGroupContentAuthoringHelpers';
export type {
  BuildCreateSbtDocumentUrlAdditionPatchArgs,
  BuildCreateSbtDocumentUrlRemovalPatchArgs,
  CreateSbtDocumentUrlInputState,
  CreateSbtRelevantDefaultTagSyncState,
  CreateSbtTagAdditionState,
  CreateSbtTagInputState,
  CreateSbtTagRemovalState,
  ResolveCreateSbtDocumentUrlInputStateArgs,
  ResolveCreateSbtTagInputStateArgs,
} from './createSbtGroupContentAuthoringHelpers';
export type {
  BuildCreateSbtAutoCreate2SaltSourceArgs,
  BuildCreateSbtDeterministicSymbolArgs,
  BuildCreateSbtPredictableDeploySignatureArgs,
  CreateSbtDigestFn,
  CreateSbtPredictableDeployBaseState,
  CreateSbtPredictedAddressCacheHit,
  ResolveCreateSbtPredictedAddressCacheHitArgs,
  ResolveCreateSbtPredictedAddressDisplayTextArgs,
  ResolveCreateSbtPredictableAddressActiveArgs,
  ResolveCreateSbtPredictableDeployBaseStateArgs,
} from './createSbtGroupPredictableDeployHelpers';

const ENCRYPTION_GATE_COLORS = [
  'var(--ce-data-series-1)',
  'var(--ce-data-series-2)',
  'var(--ce-data-series-3)',
  'var(--ce-data-series-4)',
  'var(--ce-data-series-5)',
];

export type CreateSbtLitGateChainId = number | string | null;
export type CreateSbtGateBoundary = NonNullable<Parameters<typeof normalizeGateMode>[0]> &
  Record<string, unknown> & {
    badgeLabel?: unknown;
    chain?: unknown;
    chainId?: unknown;
    color?: unknown;
    displayLabel?: unknown;
    gateId?: unknown;
    id?: unknown;
    label?: unknown;
    litChain?: unknown;
    name?: unknown;
    requireAll?: unknown;
    resourceKey?: unknown;
    sbtAddress?: unknown;
    sbtAddresses?: unknown;
    secondaryLabel?: unknown;
    title?: unknown;
    type?: unknown;
  };
export type CreateSbtMetadataLockGate = CreateSbtGateBoundary & {
  badgeLabel: string;
  chainId: CreateSbtLitGateChainId;
  color: string;
  displayLabel: string;
  gateId: string;
  id: string;
  label: string;
  litChain: string;
  mode: ReturnType<typeof normalizeGateMode>;
  requireAll: boolean;
  resourceKey: string;
  sbtAddress: string;
  sbtAddresses: string[];
  secondaryLabel: string;
  type: unknown;
};
export type CreateSbtMetadataLockGateOption = {
  badgeLabel: string;
  chainId: CreateSbtLitGateChainId;
  color: string;
  displayLabel: string;
  gateId?: string;
  id: string;
  label: string;
  litChain: string;
  mode: ReturnType<typeof normalizeGateMode>;
  requireAll: boolean;
  resourceKey: string;
  sbtAddress: string;
  sbtAddresses: string[];
  secondaryLabel: string;
  sourceGateId?: string;
  sourceSessionSlug?: string;
  [key: string]: unknown;
};
export type CreateSbtLitAccessControlCondition = Record<string, unknown>;
export type CreateSbtMetadataLockRecipient = {
  accessControlConditions: CreateSbtLitAccessControlCondition[];
  chain: string;
};
export type CreateSbtResolvedLockGate = CreateSbtGateBoundary & {
  chainId: CreateSbtLitGateChainId;
  color: string;
  gateId: string;
  id: string;
  label: string;
  litChain: string;
  mode: ReturnType<typeof normalizeGateMode>;
  sbtAddress: string;
  sbtAddresses: string[];
  type: unknown;
};
export type CreateSbtGateObjectsAndRecipientsResult = {
  gates: CreateSbtResolvedLockGate[];
  recipients: CreateSbtMetadataLockRecipient[];
};
export type CreateSbtRecipientAccessControlState = {
  combinedAccessControlConditions: CreateSbtLitAccessControlCondition[];
  primaryAccessControlConditions: unknown;
  primaryChain: unknown;
  primaryRecipient: Record<string, unknown>;
};
export type CreateSbtEncryptedImageAsset = {
  storage: 'lit-arweave';
  txId: string;
};
export type CreateSbtMetadataFieldAccessDescriptor = {
  chainId: CreateSbtLitGateChainId;
  gateIds: string[];
  gates: CreateSbtMetadataLockGate[];
  litChain: string;
  sbtAddress: string;
  sbtAddresses: string[];
  type: 'sbt';
};
export type CreateSbtMetadataEncryptionEnvelope = {
  defaultGateId: string;
  enabled: true;
  gate: CreateSbtMetadataLockGate | null;
  gateIds: string[];
  gates: CreateSbtMetadataLockGate[];
  status: 'lit-v1';
  targets: Record<string, boolean>;
};
export type CreateSbtMetadataEncryptionPayload = {
  encryptedFieldGates: Record<string, string | string[]> | null;
  encryption: CreateSbtMetadataEncryptionEnvelope | null;
};
export type CreateSbtGateOptionsResult = {
  defaultGateId: string;
  gateMap: Record<string, CreateSbtMetadataLockGate>;
  gateOptions: CreateSbtMetadataLockGateOption[];
};
type ResolveCreateSbtErrorBannerStateArgs = {
  error?: unknown;
};
type CreateSbtErrorBannerState = {
  errorMessage: string;
  shouldRenderErrorBanner: boolean;
  style: Record<string, string | number>;
};
type BuildCreateSbtJsonPreviewDataArgs = {
  authoringChain?: CreateSbtAuthoringChainOption | null;
  autoJoinUrl?: unknown;
  network?: unknown;
  sbtAddress?: unknown;
  sbtDistribution?: Record<string, unknown>;
  sbtName?: unknown;
  shareableUrl?: unknown;
  tokenURI?: unknown;
};
type BuildCreateSbtGateOptionsFromConfigArgs = {
  chainIdFallback?: unknown;
  defaultGateId?: unknown;
  encryptionGates?: unknown[];
  sessionConfig?: Record<string, unknown> | null;
};
type BuildCreateSbtGateObjectsAndRecipientsArgs = {
  chainIdFallback?: unknown;
  gateIds?: unknown;
  gateMap?: Record<string, unknown>;
};
type RequireCreateSbtRecipientsForGateSelectionArgs = {
  gateIds?: unknown;
  gateLowerLabel?: unknown;
  gatesLowerLabel?: unknown;
  recipients?: unknown;
  scopeLabel?: unknown;
};
type BuildCreateSbtRecipientAccessControlStateArgs = {
  recipients?: unknown;
};
type BuildCreateSbtEncryptedImageAssetArgs = {
  uploadResult?: (Record<string, unknown> & { txId?: unknown }) | null;
};
type BuildCreateSbtFieldAccessDescriptorArgs = {
  chainIdFallback?: unknown;
  gateIds?: unknown;
  gateMap?: Record<string, unknown>;
};
type BuildCreateSbtMetadataEncryptionArgs = {
  chainIdFallback?: unknown;
  defaultGateId?: unknown;
  encryptedFieldGates?: unknown;
  gateMap?: Record<string, unknown>;
};
type BuildCreateSbtGateOptionsFromSessionSourcesArgs = {
  chainIdFallback?: unknown;
  preferredSessionSlug?: unknown;
  sessionSources?: unknown[];
};

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const getCreateSbtObjectEntries = (value: unknown): [string, unknown][] =>
  value !== null && typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : [];

export const getCreateSbtRecipientAccessControlConditions = (recipient: unknown): Record<string, unknown>[] => {
  const record = isPlainObject(recipient) ? recipient : {};
  return Array.isArray(record.accessControlConditions)
    ? (record.accessControlConditions as Record<string, unknown>[])
    : [];
};

export const asCreateSbtGateBoundary = (value: unknown): Record<string, unknown> => (isPlainObject(value) ? value : {});

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message =
    error !== null && (typeof error === 'object' || typeof error === 'function') && 'message' in error
      ? error.message
      : undefined;
  return error instanceof Error && error.message ? error.message : String(message || error || fallback);
};

export const resolveCreateSbtErrorBannerState = ({
  error = '',
}: ResolveCreateSbtErrorBannerStateArgs = {}): CreateSbtErrorBannerState => {
  const errorMessage = String(error ?? '');
  return {
    errorMessage,
    shouldRenderErrorBanner: !!error && errorMessage.trim() !== '',
    style: {
      margin: '10px 0 16px',
      padding: '10px 12px',
      border: '1px solid var(--ce-status-danger)',
      background: 'color-mix(in srgb, var(--ce-status-danger) 12%, var(--ce-document-surface))',
      color: 'var(--ce-status-danger-text)',
      borderRadius: 'var(--ce-radius-6)',
      fontWeight: 600,
    },
  };
};

export const shouldFallbackCreateSbtDeferredDraftUpload = (error: unknown): boolean => {
  const messageValue =
    error !== null && (typeof error === 'object' || typeof error === 'function') && 'message' in error
      ? error.message
      : error;
  const message = toStr(messageValue).trim().toLowerCase();
  if (!message) return false;
  return (
    isPublishUploadBootstrapReachabilityError(error) ||
    message.includes('worker url is missing') ||
    message.includes('connect a wallet to authenticate with the worker') ||
    message.includes('connect a wallet to sign admin requests') ||
    message.includes('failed to request worker nonce') ||
    message.includes('worker auth nonce route not supported') ||
    message.includes('worker auth login route not supported') ||
    message.includes('worker login failed') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message === 'invalid address' ||
    message === 'invalid address.'
  );
};

export const normalizeGateIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((id: unknown) => String(id || '').trim()).filter(Boolean);
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw ? [raw] : [];
};

export const normalizeGateText = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\[object\s+object\]$/i.test(text)) return '';
  return text;
};

export const resolveCreateSbtLockAudienceSessionName = (sessionConfig?: Record<string, unknown>): string => {
  const direct = normalizeGateText(sessionConfig?.sessionName || sessionConfig?.slug);
  return direct || 'session';
};

export const buildCreateSbtScopedLockGateId = (sessionSlug: unknown = '', gateId: unknown = ''): string => {
  const normalizedGateId = normalizeGateText(gateId);
  if (!normalizedGateId) return '';
  const normalizedSessionSlug = normalizeSessionSlug(sessionSlug || '');
  return `session:${normalizedSessionSlug || 'general'}::${normalizedGateId}`;
};

export const buildCreateSbtResourceKeyByGateId = (sessionConfig?: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  const registerGateId = (gateId: unknown, resourceKey: unknown) => {
    const normalizedGateId = normalizeGateText(gateId);
    const normalizedResourceKey = normalizeGateText(resourceKey);
    if (!normalizedGateId || !normalizedResourceKey) return;
    if (!out[normalizedGateId]) out[normalizedGateId] = normalizedResourceKey;
  };

  const sponsored = isPlainObject(sessionConfig?.sponsored) ? sessionConfig.sponsored : {};
  const resources = isPlainObject(sponsored.resources) ? sponsored.resources : {};
  Object.entries(resources).forEach(([resourceKey, resourceCfg]) => {
    const normalizedResourceCfg = isPlainObject(resourceCfg) ? resourceCfg : {};
    const gateIds = [
      ...(Array.isArray(normalizedResourceCfg.gateIds) ? normalizedResourceCfg.gateIds : []),
      normalizedResourceCfg.gateId,
    ];
    gateIds.forEach((gateId: unknown) => registerGateId(gateId, resourceKey));
  });

  ['default', 'ai', 'arweave', 'docUrls', 'questionResponses', 'surveyResponses'].forEach((resourceKey) => {
    const state = resolveSponsoredGateStateForResource(sessionConfig, resourceKey);
    if (state?.status !== SPONSORED_GATE_STATES.RESTRICTED || !state?.gate) return;
    registerGateId(state.gate?.gateId || state.gate?.id, resourceKey);
  });

  return out;
};

export const stableGateColor = (gateId: unknown): string => {
  const str = String(gateId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return ENCRYPTION_GATE_COLORS[hash % ENCRYPTION_GATE_COLORS.length];
};

export const normalizeAddressList = (values?: unknown[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value: unknown) => {
    const address = String(value || '').trim();
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  });
  return out;
};

export const getCreateSbtBurnAuthEnum = (burnAuth: unknown): number => {
  switch (burnAuth) {
    case 'AdminOnly':
      return 0;
    case 'OwnerOnly':
      return 1;
    case 'Both':
      return 2;
    case 'Neither':
      return 3;
    default:
      throw new Error(`Unsupported burnAuth value: ${burnAuth}`);
  }
};

export const buildCreateSbtJsonPreviewData = ({
  authoringChain = null,
  autoJoinUrl = '',
  network = '',
  sbtAddress = '',
  sbtDistribution = {},
  sbtName = '',
  shareableUrl = '',
  tokenURI = '',
}: BuildCreateSbtJsonPreviewDataArgs = {}): Record<string, unknown> => ({
  sbtName,
  sbtAddress,
  tokenURI: normalizeArweaveUrl(tokenURI),
  network: authoringChain?.name || (typeof network === 'string' ? network : ''),
  distribution: sbtDistribution.distributionOption,
  autoJoinUrl,
  shareableUrl,
});

export const normalizeCreateSbtLitGateChainIdFallback = (value: unknown): CreateSbtLitGateChainId => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return value.trim() || null;
  return null;
};

export const resolveCreateSbtLitGateChainId = (value: unknown, fallback: unknown): CreateSbtLitGateChainId =>
  Number(value || fallback || 0) || normalizeCreateSbtLitGateChainIdFallback(fallback);

export const sanitizeCreateSbtGateForMetadata = (
  gateInput: unknown = {},
  chainIdFallback: unknown = null,
): CreateSbtMetadataLockGate | null => {
  const gate = asCreateSbtGateBoundary(gateInput) as CreateSbtGateBoundary;
  const gateId = normalizeGateText(gate.gateId || gate.id);
  const sbtAddresses = normalizeAddressList([
    ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
    gate.sbtAddress,
  ]);
  if (!gateId || !sbtAddresses.length) return null;

  const chainId = resolveCreateSbtLitGateChainId(gate.chainId, chainIdFallback);
  const litChain = resolveLitChain({ chainId, litChain: gate.litChain || gate.chain });
  const mode = normalizeGateMode(gate);

  return {
    type: gate.type || 'sbt',
    gateId,
    id: gateId,
    label: normalizeGateText(gate.label || gate.name || gate.title || gate.displayLabel || gateId) || gateId,
    displayLabel: normalizeGateText(gate.displayLabel || gate.label || gateId) || gateId,
    badgeLabel: normalizeGateText(gate.badgeLabel || gate.label || gate.name || gateId) || gateId,
    secondaryLabel: normalizeGateText(gate.secondaryLabel || ''),
    resourceKey: normalizeGateText(gate.resourceKey || ''),
    color: normalizeGateText(gate.color) || stableGateColor(gateId),
    mode,
    requireAll: gate.requireAll === true || mode === 'all',
    sbtAddresses,
    sbtAddress: sbtAddresses[0] || '',
    chainId,
    litChain,
  };
};

export const buildCreateSbtGateObjectsAndRecipients = ({
  gateIds = [],
  gateMap = {},
  chainIdFallback = null,
}: BuildCreateSbtGateObjectsAndRecipientsArgs = {}): CreateSbtGateObjectsAndRecipientsResult => {
  const validGateIds = Object.keys(gateMap || {});
  const validGateSet = new Set<string>(validGateIds);
  const knownGateIds = normalizeGateIds(gateIds).filter((gateId) => validGateSet.has(gateId));
  const gates: CreateSbtResolvedLockGate[] = [];
  const recipients: CreateSbtMetadataLockRecipient[] = [];
  const dedupe = new Set<string>();

  knownGateIds.forEach((gateId) => {
    const rawGateInput = gateMap[gateId];
    if (!rawGateInput) return;
    const rawGate = asCreateSbtGateBoundary(rawGateInput) as CreateSbtGateBoundary;

    const chainId = resolveCreateSbtLitGateChainId(rawGate.chainId, chainIdFallback);
    const litChain = resolveLitChain({ chainId, litChain: rawGate.litChain });
    const sbtAddresses = normalizeAddressList([
      ...(Array.isArray(rawGate.sbtAddresses) ? rawGate.sbtAddresses : []),
      rawGate.sbtAddress,
    ]);
    if (!sbtAddresses.length) return;

    const mode = normalizeGateMode(rawGate);
    const label = normalizeGateText(rawGate.label || rawGate.name || gateId) || gateId;
    const color = normalizeGateText(rawGate.color) || stableGateColor(gateId);

    gates.push({
      ...rawGate,
      type: rawGate.type || 'sbt',
      gateId,
      id: gateId,
      sbtAddresses,
      sbtAddress: sbtAddresses[0] || '',
      chainId,
      litChain,
      mode,
      label,
      color,
    });

    const accessControlConditions = buildSbtAccessControlConditions({
      sbtAddresses,
      chainId,
      litChain,
      mode,
    }) as CreateSbtLitAccessControlCondition[] | null;
    if (!accessControlConditions) return;

    const recipient: CreateSbtMetadataLockRecipient = { accessControlConditions, chain: litChain };
    const sig = JSON.stringify({ accessControlConditions, chain: litChain });
    if (dedupe.has(sig)) return;
    dedupe.add(sig);
    recipients.push(recipient);
  });

  return { gates, recipients };
};

export const requireCreateSbtRecipientsForGateSelection = ({
  gateIds = [],
  gateLowerLabel = 'gate',
  gatesLowerLabel = 'gates',
  recipients = [],
  scopeLabel = 'content',
}: RequireCreateSbtRecipientsForGateSelectionArgs = {}): void => {
  const selectedGateIds = normalizeGateIds(gateIds);
  if (!selectedGateIds.length) return;
  if (Array.isArray(recipients) && recipients.length > 0) return;
  throw new Error(
    `Selected lock ${selectedGateIds.length === 1 ? gateLowerLabel : gatesLowerLabel} (${selectedGateIds.join(', ')}) for ${scopeLabel || 'content'} do not resolve to valid Lit recipients.`,
  );
};

export const buildCreateSbtRecipientAccessControlState = ({
  recipients = [],
}: BuildCreateSbtRecipientAccessControlStateArgs = {}): CreateSbtRecipientAccessControlState => {
  const normalizedRecipients = Array.isArray(recipients) ? recipients : [];
  const combinedAccessControlConditions: CreateSbtLitAccessControlCondition[] = [];
  normalizedRecipients.forEach((recipient) => {
    const conditions = getCreateSbtRecipientAccessControlConditions(recipient);
    if (!conditions.length) return;
    if (combinedAccessControlConditions.length > 0) {
      combinedAccessControlConditions.push({ operator: 'or' });
    }
    combinedAccessControlConditions.push(...conditions);
  });
  const primaryRecipient = isPlainObject(normalizedRecipients[0]) ? normalizedRecipients[0] : {};

  return {
    combinedAccessControlConditions,
    primaryRecipient,
    primaryAccessControlConditions: primaryRecipient.accessControlConditions,
    primaryChain: primaryRecipient.chain || null,
  };
};

export const buildCreateSbtEncryptedImageAsset = ({
  uploadResult = {},
}: BuildCreateSbtEncryptedImageAssetArgs = {}): CreateSbtEncryptedImageAsset | null => {
  const txId = normalizeGateText(uploadResult?.txId || '');
  if (!txId) return null;
  return {
    storage: 'lit-arweave',
    txId,
  };
};

export const buildCreateSbtPreviewEncryptedImageAsset = (
  lockedFieldMask: unknown = '[encrypted]',
): CreateSbtEncryptedImageAsset => ({
  storage: 'lit-arweave',
  txId: String(lockedFieldMask || ''),
});

export const buildCreateSbtFieldAccessDescriptor = ({
  gateIds = [],
  gateMap = {},
  chainIdFallback = null,
}: BuildCreateSbtFieldAccessDescriptorArgs = {}): CreateSbtMetadataFieldAccessDescriptor | null => {
  const validGateSet = new Set(Object.keys(gateMap || {}));
  const selectedGateIds = normalizeGateIds(gateIds).filter((gateId) => validGateSet.has(gateId));
  if (!selectedGateIds.length) return null;

  const gates = selectedGateIds
    .map((gateId) => sanitizeCreateSbtGateForMetadata(gateMap[gateId], chainIdFallback))
    .filter((gate): gate is CreateSbtMetadataLockGate => gate !== null);
  if (!gates.length) return null;

  const sbtAddresses = normalizeAddressList(
    gates.flatMap((gate) => (Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : [])),
  );
  const primaryGate = gates[0] || null;
  const resolvedChainId = resolveCreateSbtLitGateChainId(primaryGate?.chainId, chainIdFallback);

  return {
    type: 'sbt',
    gateIds: selectedGateIds,
    gates,
    sbtAddresses,
    sbtAddress: sbtAddresses[0] || '',
    chainId: resolvedChainId,
    litChain: primaryGate?.litChain || resolveLitChain({ chainId: resolvedChainId }),
  };
};

export const buildCreateSbtMetadataEncryption = ({
  encryptedFieldGates = {},
  gateMap = {},
  chainIdFallback = null,
  defaultGateId = '',
}: BuildCreateSbtMetadataEncryptionArgs = {}): CreateSbtMetadataEncryptionPayload => {
  const normalizedFieldGates: Record<string, string | string[]> = {};
  const metadataGateMap: Record<string, CreateSbtMetadataLockGate> = {};
  const targets: Record<string, boolean> = {};

  getCreateSbtObjectEntries(encryptedFieldGates).forEach(([fieldKey, rawGateIds]) => {
    const fieldGateValue = resolveCreateSbtEncryptedFieldGateValue({
      selectedGateIds: rawGateIds,
      validGateIds: Object.keys(gateMap || {}),
    });
    if (!fieldGateValue) return;

    const selectedGateIds = Array.isArray(fieldGateValue) ? fieldGateValue : [fieldGateValue];
    normalizedFieldGates[fieldKey] = fieldGateValue;
    targets[fieldKey] = true;

    selectedGateIds.forEach((gateId) => {
      const sanitized = sanitizeCreateSbtGateForMetadata(gateMap[gateId], chainIdFallback);
      if (!sanitized) return;
      metadataGateMap[gateId] = sanitized;
    });
  });

  const gates = Object.values(metadataGateMap);
  const gateIds = gates.map((gate) => gate.gateId).filter(Boolean);
  const resolvedDefaultGateId = normalizeGateText(defaultGateId);
  return {
    encryptedFieldGates: Object.keys(normalizedFieldGates).length ? normalizedFieldGates : null,
    encryption:
      gates.length > 0 && Object.keys(targets).length > 0
        ? {
            enabled: true,
            status: 'lit-v1',
            defaultGateId: gateIds.includes(resolvedDefaultGateId) ? resolvedDefaultGateId : gateIds[0] || '',
            gateIds,
            gate: gates[0] || null,
            gates,
            targets,
          }
        : null,
  };
};

const CREATE_SBT_AUTHORING_GATE_RESOURCE_LABELS: Record<string, string> = Object.freeze({
  default: 'default',
  ai: 'ai',
  arweave: 'arweave',
  docUrls: 'docs',
  questionResponses: 'questions',
  surveyResponses: 'survey',
});

export const buildCreateSbtGateOptionsFromConfig = ({
  sessionConfig = {},
  encryptionGates = [],
  defaultGateId = '',
  chainIdFallback = null,
}: BuildCreateSbtGateOptionsFromConfigArgs = {}): CreateSbtGateOptionsResult => {
  const normalizedSessionConfig = isPlainObject(sessionConfig) ? sessionConfig : {};
  const gateMap: Record<string, CreateSbtMetadataLockGate> = {};
  const sessionLabel = resolveCreateSbtLockAudienceSessionName(normalizedSessionConfig);
  const resourceKeyByGateId = buildCreateSbtResourceKeyByGateId(normalizedSessionConfig);
  const registerGate = (rawGateInput: unknown = {}, preferredGateId: unknown = '') => {
    const rawGate = asCreateSbtGateBoundary(rawGateInput) as CreateSbtGateBoundary;
    const gateId = normalizeGateText(preferredGateId || rawGate.gateId || rawGate.id);
    if (!gateId) return;

    const sbtAddressesFromHelper = getGateSbtAddresses(rawGate);
    const sbtAddresses = sbtAddressesFromHelper.length
      ? sbtAddressesFromHelper
      : normalizeAddressList([
          ...(Array.isArray(rawGate.sbtAddresses) ? rawGate.sbtAddresses : []),
          rawGate.sbtAddress,
        ]);
    if (!sbtAddresses.length) return;

    const chainId = resolveCreateSbtLitGateChainId(rawGate.chainId, chainIdFallback);
    const litChain = resolveLitChain({ chainId, litChain: rawGate.litChain || rawGate.chain });
    const resourceKey = normalizeGateText(rawGate.resourceKey || rawGate.secondaryLabel || resourceKeyByGateId[gateId]);
    const resourceLabel = CREATE_SBT_AUTHORING_GATE_RESOURCE_LABELS[resourceKey] || resourceKey;

    gateMap[gateId] = {
      ...rawGate,
      type: rawGate.type || 'sbt',
      gateId,
      id: gateId,
      resourceKey,
      secondaryLabel: resourceLabel || '',
      label: sessionLabel,
      displayLabel: sessionLabel,
      badgeLabel: sessionLabel,
      color: normalizeGateText(rawGate.color) || stableGateColor(gateId),
      mode: normalizeGateMode(rawGate),
      requireAll: rawGate.requireAll === true || normalizeGateMode(rawGate) === 'all',
      sbtAddresses,
      sbtAddress: sbtAddresses[0] || '',
      chainId,
      litChain,
    };
  };

  if (Array.isArray(encryptionGates) && encryptionGates.length > 0) {
    encryptionGates.forEach((gate) => {
      const normalizedGate = asCreateSbtGateBoundary(gate) as CreateSbtGateBoundary;
      registerGate(normalizedGate, normalizedGate.id || normalizedGate.gateId);
    });
  } else {
    const sponsored = isPlainObject(normalizedSessionConfig.sponsored) ? normalizedSessionConfig.sponsored : {};
    const sponsoredGates = isPlainObject(sponsored.gates) ? sponsored.gates : {};
    Object.entries(sponsoredGates).forEach(([gateId, gate]) => registerGate(gate, gateId));

    const defaultGateState = resolveSponsoredGateStateForResource(normalizedSessionConfig, 'default');
    if (defaultGateState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultGateState?.gate) {
      registerGate(defaultGateState.gate, defaultGateState.gate?.gateId || defaultGateId || 'default');
    }
  }

  const gateEntries = Object.values(gateMap).sort((a, b) =>
    String(a.resourceKey || a.gateId || '').localeCompare(String(b.resourceKey || b.gateId || '')),
  );
  const gateIds = gateEntries.map((gate) => gate.gateId).filter(Boolean);
  const requestedDefaultGateId = normalizeGateText(defaultGateId);
  const sponsored = isPlainObject(normalizedSessionConfig.sponsored) ? normalizedSessionConfig.sponsored : {};
  const lit = isPlainObject(normalizedSessionConfig.lit) ? normalizedSessionConfig.lit : {};
  const configuredDefaultGateId = normalizeGateText(sponsored.defaultGateId || lit.defaultGateId);
  const resolvedDefaultGateId =
    [requestedDefaultGateId, configuredDefaultGateId, gateEntries[0]?.gateId].find(
      (gateId) => gateId && gateIds.includes(gateId),
    ) ||
    gateEntries[0]?.gateId ||
    '';
  const selectedGate = gateEntries.find((gate) => gate.gateId === resolvedDefaultGateId) || gateEntries[0] || null;
  // SBT metadata authoring intentionally collapses session-derived resource gates
  // to the canonical default gate instead of exposing per-resource lock picking.
  const gateOptions = selectedGate
    ? [
        {
          id: selectedGate.gateId,
          label: sessionLabel,
          displayLabel: sessionLabel,
          badgeLabel: sessionLabel,
          secondaryLabel: '',
          color: selectedGate.color,
          mode: selectedGate.mode,
          requireAll: selectedGate.requireAll === true,
          sbtAddresses: selectedGate.sbtAddresses,
          sbtAddress: selectedGate.sbtAddress,
          chainId: selectedGate.chainId,
          litChain: selectedGate.litChain,
          resourceKey: selectedGate.resourceKey || '',
        },
      ]
    : [];

  return {
    gateMap,
    gateOptions,
    defaultGateId: resolvedDefaultGateId,
  };
};

export const buildCreateSbtGateOptionsFromSessionSources = ({
  sessionSources = [],
  preferredSessionSlug = '',
  chainIdFallback = null,
}: BuildCreateSbtGateOptionsFromSessionSourcesArgs = {}): CreateSbtGateOptionsResult => {
  const gateMap: Record<string, CreateSbtMetadataLockGate> = {};
  const gateOptions: CreateSbtMetadataLockGate[] = [];
  const normalizedPreferredSessionSlug = normalizeSessionSlug(preferredSessionSlug || '');

  (Array.isArray(sessionSources) ? sessionSources : []).forEach((sourceInput) => {
    const source = isPlainObject(sourceInput) ? sourceInput : {};
    const sessionConfig = isPlainObject(source.sessionConfig) ? source.sessionConfig : null;
    if (!sessionConfig) return;

    const sessionSlug = normalizeSessionSlug(source.sessionSlug || sessionConfig.slug || '');
    const resolvedChainIdFallback =
      normalizePositiveChainId(source.chainIdFallback || sessionConfig.networkChainId || chainIdFallback) ||
      normalizeCreateSbtLitGateChainIdFallback(chainIdFallback);
    const scopedGateSet = buildCreateSbtGateOptionsFromConfig({
      sessionConfig,
      encryptionGates: Array.isArray(source.encryptionGates) ? source.encryptionGates : [],
      defaultGateId: source.defaultGateId || '',
      chainIdFallback: resolvedChainIdFallback,
    });

    (Array.isArray(scopedGateSet.gateOptions) ? scopedGateSet.gateOptions : []).forEach((option) => {
      const rawGateId = normalizeGateText(option.id || option.gateId);
      if (!rawGateId) return;

      const scopedId = buildCreateSbtScopedLockGateId(sessionSlug, rawGateId);
      if (!scopedId || gateMap[scopedId]) return;

      const sourceGate = scopedGateSet.gateMap[rawGateId] || option;
      const sbtAddresses = normalizeAddressList([
        ...(Array.isArray(option.sbtAddresses) ? option.sbtAddresses : []),
        ...(Array.isArray(sourceGate.sbtAddresses) ? sourceGate.sbtAddresses : []),
        option.sbtAddress,
        sourceGate.sbtAddress,
      ]);
      const chainId =
        normalizePositiveChainId(option.chainId || sourceGate.chainId || resolvedChainIdFallback) ||
        resolvedChainIdFallback;
      const litChain =
        normalizeGateText(option.litChain || sourceGate.litChain || option.chain || sourceGate.chain) ||
        resolveLitChain({ chainId });

      const modeSource = option.mode ? option : sourceGate;
      const scopedGate: CreateSbtMetadataLockGate = {
        ...sourceGate,
        gateId: scopedId,
        id: scopedId,
        sourceGateId: rawGateId,
        sourceSessionSlug: sessionSlug,
        label:
          normalizeGateText(option.label || sourceGate.label) || resolveCreateSbtLockAudienceSessionName(sessionConfig),
        displayLabel:
          normalizeGateText(option.displayLabel || option.label || sourceGate.displayLabel || sourceGate.label) ||
          resolveCreateSbtLockAudienceSessionName(sessionConfig),
        badgeLabel:
          normalizeGateText(
            option.badgeLabel || option.displayLabel || option.label || sourceGate.badgeLabel || sourceGate.label,
          ) || resolveCreateSbtLockAudienceSessionName(sessionConfig),
        secondaryLabel: normalizeGateText(option.secondaryLabel || sourceGate.secondaryLabel || ''),
        color: normalizeGateText(option.color || sourceGate.color) || stableGateColor(scopedId),
        mode: normalizeGateMode(modeSource),
        requireAll:
          option.requireAll === true || sourceGate.requireAll === true || normalizeGateMode(modeSource) === 'all',
        sbtAddresses,
        sbtAddress: sbtAddresses[0] || '',
        chainId,
        litChain,
        resourceKey: normalizeGateText(option.resourceKey || sourceGate.resourceKey || ''),
      };

      gateMap[scopedId] = scopedGate;
      gateOptions.push(scopedGate);
    });
  });

  const preferredGateId =
    gateOptions.find((gate) => normalizeSessionSlug(gate.sourceSessionSlug || '') === normalizedPreferredSessionSlug)
      ?.id || '';

  return {
    gateMap,
    gateOptions,
    defaultGateId: preferredGateId || gateOptions[0]?.id || '',
  };
};
