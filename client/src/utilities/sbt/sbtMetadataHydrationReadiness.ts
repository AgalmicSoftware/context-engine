export type SbtCoreMetadataPredicate = (info: unknown) => boolean;

const hasText = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';

const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

export const hasListVisibleSbtTokenUriMetadata = (info: unknown): boolean => {
  if (!info || typeof info !== 'object') return false;
  const sbtInfo = info as Record<string, unknown>;
  if (sbtInfo.tokenUriMetadataFetched === true) return true;
  const encryptedFields =
    sbtInfo.encryptedFields && typeof sbtInfo.encryptedFields === 'object'
      ? (sbtInfo.encryptedFields as Record<string, unknown>)
      : {};
  return (
    hasText(sbtInfo.description) ||
    hasText(sbtInfo.image) ||
    hasText(sbtInfo.descriptionEncrypted) ||
    hasText(sbtInfo.encryptedDescription) ||
    hasText(sbtInfo.imageEncrypted) ||
    hasText(sbtInfo.encryptedImage) ||
    hasText(encryptedFields.description) ||
    hasText(encryptedFields.image) ||
    hasItems(sbtInfo.tags) ||
    hasItems(sbtInfo.documentURLs) ||
    hasItems(sbtInfo.documentUrls) ||
    hasItems(sbtInfo.docURLs) ||
    hasItems(sbtInfo.documents)
  );
};

export const needsSbtListMetadataHydration = (info: unknown, hasCoreMetadata: SbtCoreMetadataPredicate): boolean =>
  !hasCoreMetadata(info) || !hasListVisibleSbtTokenUriMetadata(info);
