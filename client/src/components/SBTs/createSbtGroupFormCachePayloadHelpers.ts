import { normalizeCreateSbtDocumentUrlDraft } from './createSbtGroupContentAuthoringHelpers';
import { normalizeMetadataLockGateIds } from './createSbtGroupMetadataLockHelpers';

export type CreateSbtFormCachePayload = Record<string, unknown> & {
  _imageDataUrl?: string;
  sbtDistribution: Record<string, unknown>;
};

export const buildCreateSbtFormCachePayload = ({
  state = {},
  selectedAuthoringChainId = null,
  effectiveSessionSlug = '',
}: {
  state?: Record<string, unknown>;
  selectedAuthoringChainId?: unknown;
  effectiveSessionSlug?: unknown;
} = {}): CreateSbtFormCachePayload => {
  const {
    sbtName,
    sbtDescription,
    sbtImageUrl,
    useImageUrl,
    sbtDistribution,
    tags,
    documentIDHashes,
    documentURLs,
    documentUrl,
    groupPassword,
    numInviteLinks,
    exportFormat,
    metadataLockGateIds,
    create2Salt,
    predictableAddressEnabled,
    deferredCreate2Salt,
    autoAppliedDefaultTags,
    dismissedDefaultTags,
  } = state;

  const safeDist: Record<string, unknown> = { ...Object(sbtDistribution || {}) };
  const rawMintingEndTime = safeDist.mintingEndTime;
  safeDist.mintingEndTime = rawMintingEndTime
    ? new Date(rawMintingEndTime as string | number | Date).toISOString()
    : null;
  safeDist.network = selectedAuthoringChainId || 'not connected';

  return {
    sbtName: ((sbtName as string) || '').trim(),
    sbtDescription: ((sbtDescription as string) || '').trim(),
    sbtImageUrl,
    useImageUrl,
    sbtDistribution: safeDist,
    tags,
    documentIDHashes,
    documentURLs,
    documentUrl: normalizeCreateSbtDocumentUrlDraft(documentUrl),
    groupPassword,
    metadataLockGateIds: normalizeMetadataLockGateIds(metadataLockGateIds),
    predictableAddressEnabled: !!predictableAddressEnabled,
    autoAppliedDefaultTags: Array.isArray(autoAppliedDefaultTags) ? autoAppliedDefaultTags : [],
    dismissedDefaultTags: Array.isArray(dismissedDefaultTags) ? dismissedDefaultTags : [],
    numInviteLinks,
    exportFormat,
    create2Salt,
    deferredCreate2Salt,
    _sessionSlug: effectiveSessionSlug || '',
  };
};
