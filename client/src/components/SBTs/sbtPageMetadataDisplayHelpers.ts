type ResolveSbtPageRelevantInfoListsArgs = {
  sbtInfo?: unknown;
};
type ResolveSbtPageRelevantInfoDisplayStateArgs = {
  documentIDHashes?: unknown;
  documentURLs?: unknown;
  tags?: unknown;
};
type SbtPageRelevantInfoLists = {
  documentIDHashes: string[];
  documentURLs: string[];
  tags: string[];
};
type SbtPageRelevantInfoDisplayState = {
  shouldRenderDocumentIdHashes: boolean;
  shouldRenderDocumentUrls: boolean;
  shouldRenderTags: boolean;
};

const SBT_PAGE_BURN_AUTH_LABELS = ['Admin Only', 'Owner Only', 'Both', 'Neither'];
const SBT_PAGE_BURN_AUTH_INDEX_BY_NAME: Record<string, number> = {
  AdminOnly: 0,
  OwnerOnly: 1,
  Both: 2,
  Neither: 3,
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry: unknown) => String(entry ?? '')) : [];

export const toSbtPageDocumentUrlList = (...values: unknown[]): string[] => {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out.push(trimmed);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out.push(String(value));
      return;
    }
    if (!isRecord(value)) return;
    const nested = [
      value.url,
      value.href,
      value.link,
      value.documentURL,
      value.documentUrl,
      value.docURL,
      value.docUrl,
      value.value,
    ].find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    if (typeof nested === 'string') out.push(nested.trim());
  };
  values.forEach(visit);
  return out;
};

export const resolveSbtPageBurnAuthLabel = (burnAuth: unknown): string => {
  const burnIdx =
    typeof burnAuth === 'string'
      ? (SBT_PAGE_BURN_AUTH_INDEX_BY_NAME[burnAuth] ?? undefined)
      : burnAuth != null
        ? Number(burnAuth)
        : undefined;
  const normalizedBurnIdx = Number.isInteger(burnIdx) ? Number(burnIdx) : -1;
  return normalizedBurnIdx >= 0 && normalizedBurnIdx < SBT_PAGE_BURN_AUTH_LABELS.length
    ? SBT_PAGE_BURN_AUTH_LABELS[normalizedBurnIdx]
    : '?';
};

export const resolveSbtPageMaxTokensDisplay = (maxTokens: unknown): string =>
  maxTokens === '0' ? '∞' : maxTokens != null ? String(maxTokens) : '-';

export const resolveSbtPageAdminCreatorAddresses = (
  sbtInfoInput: unknown,
): {
  adminAddress: unknown;
  creatorAddress: unknown;
} => {
  const sbtInfo = isRecord(sbtInfoInput) ? sbtInfoInput : {};
  const adminAddress = sbtInfo.admin || sbtInfo.admin_ || sbtInfo.deployer || '';
  const creatorAddress = sbtInfo.creator || adminAddress || sbtInfo.deployer || sbtInfo.admin_ || '';
  return { adminAddress, creatorAddress };
};

export const resolveSbtPageRelevantInfoLists = ({
  sbtInfo = null,
}: ResolveSbtPageRelevantInfoListsArgs = {}): SbtPageRelevantInfoLists => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  return {
    documentIDHashes: toStringList(info.documentIDHashes),
    documentURLs: toSbtPageDocumentUrlList(
      info.documentURLs,
      info.documentUrls,
      info.documentURL,
      info.documentUrl,
      info.docURLs,
      info.docUrls,
      info.docURL,
      info.docUrl,
      info.documents,
    ),
    tags: toStringList(info.tags),
  };
};

export const resolveSbtPageRelevantInfoDisplayState = ({
  documentIDHashes = [],
  documentURLs = [],
  tags = [],
}: ResolveSbtPageRelevantInfoDisplayStateArgs = {}): SbtPageRelevantInfoDisplayState => ({
  shouldRenderDocumentIdHashes: Array.isArray(documentIDHashes) && documentIDHashes.length > 0,
  shouldRenderDocumentUrls: Array.isArray(documentURLs) && documentURLs.length > 0,
  shouldRenderTags: Array.isArray(tags) && tags.length > 0,
});
