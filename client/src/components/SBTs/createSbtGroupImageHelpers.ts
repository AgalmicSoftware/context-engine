import { normalizeArweaveUrl, parseArweaveTxId } from '../../utilities/arweave/arweaveUrls.js';

type BuildCreateSbtImagePreviewStateArgs = {
  imageChooserStatusText?: string;
  imageChooserStatusTone?: CreateSbtImageStatusTone;
  imageLoadError?: unknown;
  sbtImageFile?: unknown;
  sbtImageUrl?: unknown;
  useImageUrl?: unknown;
};
type ResolveCreateSbtMetadataImageSourceArgs = {
  defaultImageUrl?: unknown;
  getCanonicalMetadataImageUrl?: ((value: unknown) => string) | null;
  sbtImageUrl?: unknown;
  useImageUrl?: unknown;
};
type BuildCreateSbtImageUploadMethodPatchArgs = {
  useImageUrl?: unknown;
};
type BuildCreateSbtImageFilePatchArgs = {
  clearLockedAsset?: unknown;
  file?: unknown;
};
type BuildCreateSbtImageLoadErrorPatchArgs = {
  clearFile?: unknown;
  clearLockedAsset?: unknown;
};
type BuildCreateSbtImageFileClearPatchArgs = {
  clearLockedAsset?: unknown;
};
type BuildCreateSbtSelectedImageFilePatchArgs = {
  file?: unknown;
  sbtImageUrl?: unknown;
  statusText?: unknown;
  statusTone?: CreateSbtImageStatusTone;
  useImageUrl?: unknown;
};
type BuildCreateSbtImageChooserStatusPatchArgs = {
  statusText?: unknown;
  statusTone?: CreateSbtImageStatusTone;
};
type CreateSbtImageStatusTone = 'default' | 'error' | 'loading';
type CreateSbtImagePreviewState = {
  effectiveImageStatusText: string;
  effectiveImageStatusTone: CreateSbtImageStatusTone;
  hasImagePreview: boolean;
  hasPendingImagePreview: boolean;
  previewFile: Blob | null;
  showImagePreviewError: boolean;
};

export const buildCreateSbtImageUploadMethodPatch = ({
  useImageUrl = false,
}: BuildCreateSbtImageUploadMethodPatchArgs = {}): Record<string, unknown> => ({
  useImageUrl: !!useImageUrl,
  sbtImageFile: null,
  sbtImageUrl: '',
  imageLoadError: false,
  imageChooserStatusText: '',
  imageChooserStatusTone: 'default',
  lockedImageAsset: null,
});

export const buildCreateSbtImageResetPatch = (): Record<string, unknown> => ({
  ...buildCreateSbtImageUploadMethodPatch({ useImageUrl: false }),
});

export const buildCreateSbtImageFilePatch = ({
  clearLockedAsset = false,
  file = null,
}: BuildCreateSbtImageFilePatchArgs = {}): Record<string, unknown> => ({
  sbtImageFile: file,
  imageLoadError: false,
  ...(clearLockedAsset === true ? { lockedImageAsset: null } : {}),
});

export const buildCreateSbtImageLoadErrorPatch = ({
  clearFile = true,
  clearLockedAsset = false,
}: BuildCreateSbtImageLoadErrorPatchArgs = {}): Record<string, unknown> => ({
  imageLoadError: true,
  ...(clearFile === true ? { sbtImageFile: null } : {}),
  ...(clearLockedAsset === true ? { lockedImageAsset: null } : {}),
});

export const buildCreateSbtImageLoadReadyPatch = (): Record<string, unknown> => ({
  imageLoadError: false,
});

export const buildCreateSbtImageFileClearPatch = ({
  clearLockedAsset = false,
}: BuildCreateSbtImageFileClearPatchArgs = {}): Record<string, unknown> => ({
  sbtImageFile: null,
  ...(clearLockedAsset === true ? { lockedImageAsset: null } : {}),
});

export const buildCreateSbtSelectedImageFilePatch = ({
  file = null,
  sbtImageUrl = '',
  statusText = '',
  statusTone = 'default',
  useImageUrl = false,
}: BuildCreateSbtSelectedImageFilePatchArgs = {}): Record<string, unknown> => {
  const text = String(statusText ?? '');
  return {
    useImageUrl: !!useImageUrl,
    sbtImageFile: file,
    sbtImageUrl: String(sbtImageUrl ?? ''),
    imageLoadError: false,
    imageChooserStatusText: text,
    imageChooserStatusTone: text ? statusTone : 'default',
    lockedImageAsset: null,
  };
};

export const buildCreateSbtImageChooserStatusPatch = ({
  statusText = '',
  statusTone = 'default',
}: BuildCreateSbtImageChooserStatusPatchArgs = {}): Record<string, unknown> => ({
  imageChooserStatusText: String(statusText ?? ''),
  imageChooserStatusTone: statusTone,
});

export const resolveCreateSbtMemoizedImageDataUrl = ({
  imageFile = null,
  memoizedImageDataUrl = null,
  memoizedImageFileRef = null,
}: {
  imageFile?: unknown;
  memoizedImageDataUrl?: unknown;
  memoizedImageFileRef?: unknown;
} = {}): string | null =>
  imageFile && imageFile === memoizedImageFileRef && typeof memoizedImageDataUrl === 'string' && memoizedImageDataUrl
    ? memoizedImageDataUrl
    : null;

export const resolveCreateSbtMetadataImageSource = ({
  defaultImageUrl = '',
  getCanonicalMetadataImageUrl = null,
  sbtImageUrl = '',
  useImageUrl = false,
}: ResolveCreateSbtMetadataImageSourceArgs = {}): string => {
  const normalizeImage =
    typeof getCanonicalMetadataImageUrl === 'function'
      ? getCanonicalMetadataImageUrl
      : (value: unknown) => String(value || '');
  const explicit = normalizeImage(sbtImageUrl);
  if (useImageUrl && explicit) return explicit;
  if (explicit) return explicit;
  return normalizeImage(defaultImageUrl);
};

export const getFetchableCreateSbtImageUrl = (value: unknown): string => {
  const normalizedValue = normalizeArweaveUrl(String(value || '').trim());
  if (!normalizedValue) return '';
  try {
    const urlObj = new URL(normalizedValue);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' ? normalizedValue : '';
  } catch (_) {
    return '';
  }
};

export const getCanonicalCreateSbtMetadataImageUrl = (value: unknown): string => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return '';
  const txId = parseArweaveTxId(trimmedValue);
  if (txId && txId === trimmedValue) {
    return `ar://${txId}`;
  }
  return trimmedValue;
};

export const buildCreateSbtImagePreviewState = ({
  imageChooserStatusText = '',
  imageChooserStatusTone = 'default',
  imageLoadError = false,
  sbtImageFile = null,
  sbtImageUrl = '',
  useImageUrl = false,
}: BuildCreateSbtImagePreviewStateArgs = {}): CreateSbtImagePreviewState => {
  const trimmedImageUrl = String(sbtImageUrl || '').trim();
  const hasImagePreview = !!(sbtImageFile && !imageLoadError);
  const hasPendingImagePreview = Boolean(
    useImageUrl && trimmedImageUrl.length > 0 && !hasImagePreview && !imageLoadError,
  );
  const showImagePreviewError = Boolean(useImageUrl && trimmedImageUrl.length > 0 && imageLoadError);
  const effectiveImageStatusText =
    imageChooserStatusText ||
    (hasPendingImagePreview ? 'Loading preview...' : showImagePreviewError ? 'Image preview unavailable.' : '');
  const effectiveImageStatusTone = imageChooserStatusText
    ? imageChooserStatusTone
    : hasPendingImagePreview
      ? 'loading'
      : showImagePreviewError
        ? 'error'
        : 'default';

  return {
    effectiveImageStatusText,
    effectiveImageStatusTone,
    hasImagePreview,
    hasPendingImagePreview,
    previewFile: hasImagePreview ? (sbtImageFile as Blob) : null,
    showImagePreviewError,
  };
};
