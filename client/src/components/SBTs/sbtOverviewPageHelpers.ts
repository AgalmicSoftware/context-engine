import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';

export type SBTsPageUnknownRecord = Record<string, unknown>;
export type SBTsPageMaybeRecord = SBTsPageUnknownRecord | null;
export type SBTsPageSessionConfigLike = SBTsPageUnknownRecord & {
  slug?: unknown;
  adminAddress?: unknown;
  __registry?: SBTsPageUnknownRecord | null;
  sessionModeProfile?: unknown;
  groupCreationPolicy?: unknown;
  featured_SBTs_LIST?: unknown;
  ignored_SBTs_LIST?: unknown;
  autoFeatureSBTsBySessionSlug?: unknown;
  autoFeatureSBTsWithFeaturedSbtTags?: unknown;
};
export type SBTsPageFeaturedProgressLike = SBTsPageUnknownRecord & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  displayCurrentBlock?: unknown;
  liveCurrentBlock?: unknown;
  lastBlock?: unknown;
  scanInProgress?: unknown;
  deferred?: unknown;
};
export type SBTsPageFeaturedSbtMetadataLike = SBTsPageUnknownRecord & {
  image?: unknown;
  imageEncrypted?: unknown;
  imageLocked?: unknown;
  encryptedImage?: unknown;
  encryptedFields?: unknown;
  mintingEndTime?: unknown;
  hasPasswordMint?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  slug?: unknown;
  unlisted?: unknown;
};
export type SBTsPageFeaturedSbtLike = SBTsPageUnknownRecord & {
  sbtAddress?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  slug?: unknown;
  unlisted?: unknown;
  sbtInfo?: SBTsPageFeaturedSbtMetadataLike | null;
};
export type SBTsPageNormalizedFeaturedEntry = {
  address: string;
  lowerAddress: string;
  sessionSlug: string;
};
type BuildSBTsPageCacheFeaturedCardModelArgs = {
  defaultImage?: unknown;
  effectiveSessionSlug?: unknown;
  entry?: unknown;
  getDisplayName?: (sbtInfo: unknown) => unknown;
  getShortAddress?: (address: string, compact?: boolean) => unknown;
  index?: unknown;
  nowSeconds?: unknown;
  sbtLabel?: unknown;
};
type SBTsPageCacheFeaturedCardModel = {
  imageUrl: string;
  isMintingActive: boolean;
  isPasswordLocked: boolean;
  resolvedSessionSlug: string;
  sbt: SBTsPageFeaturedSbtLike | null;
  sbtAddress: string;
  sbtInfo: SBTsPageFeaturedSbtMetadataLike;
  sbtKey: string;
  sbtName: string;
  shortenedAddress: string;
};
type BuildSBTsPageFeaturedEntryModelArgs = {
  effectiveSessionSlug?: unknown;
  entry?: unknown;
  index?: unknown;
};
type SBTsPageFeaturedEntryModel = {
  resolvedSessionSlug: string;
  sbtAddress: unknown;
  sbtKey: string;
};
type SBTsPageSessionConfigReader = (slug: string) => unknown;
type SBTsPageDemoSessionConfigReader = (slug: string, options?: { allowDemoFallback?: boolean }) => unknown;
type ResolveSBTsPageDisplaySessionConfigArgs = {
  getDemoSessionConfigBySlug?: SBTsPageDemoSessionConfigReader | null;
  getSessionConfigBySlug?: SBTsPageSessionConfigReader | null;
  getSessionConfigBySlugOrDefault?: SBTsPageSessionConfigReader | null;
  slugIn?: unknown;
};
type ResolveSBTsPageDisplaySessionListsArgs = ResolveSBTsPageDisplaySessionConfigArgs & {
  sessionConfig?: unknown;
};
type SBTsPageCreateFormCacheChecker = (args: {
  clearInvalid: true;
  migrateLegacyToSessionKey: true;
  sessionSlug: string;
}) => boolean;
type ResolveSBTsPageInitialCreateGroupSessionSlugArgs = {
  activeSessionSlug?: unknown;
  sessionConfig?: SBTsPageSessionConfigLike | null;
  sessionSlug?: unknown;
};
type ResolveSBTsPageFeaturedSbtSessionSlugOptions = {
  requireExplicitSessionSlug?: unknown;
};
type BuildSBTsPageInitialStateArgs = ResolveSBTsPageInitialCreateGroupSessionSlugArgs & {
  hasCachedCreateSbtForm?: SBTsPageCreateFormCacheChecker | null;
};
type BuildSBTsPageBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};

export const resolveSBTsPageCacheFeaturedCardLinkStyle = (): Record<string, string> => ({
  minWidth: '240px',
  maxWidth: '240px',
  textDecoration: 'none',
  cursor: 'pointer',
});

export const isSBTsPageRecord = (value: unknown): value is SBTsPageUnknownRecord =>
  !!value && typeof value === 'object';

export const asSBTsPageSessionConfig = (value: unknown): SBTsPageSessionConfigLike | null =>
  isSBTsPageRecord(value) ? (value as SBTsPageSessionConfigLike) : null;

export const asSBTsPageFeaturedProgress = (value: unknown): SBTsPageFeaturedProgressLike | null =>
  isSBTsPageRecord(value) ? (value as SBTsPageFeaturedProgressLike) : null;

export const asSBTsPageFeaturedSbt = (value: unknown): SBTsPageFeaturedSbtLike | null =>
  isSBTsPageRecord(value) ? (value as SBTsPageFeaturedSbtLike) : null;

export const resolveSBTsPageInitialCreateGroupSessionSlug = ({
  activeSessionSlug = '',
  sessionConfig = null,
  sessionSlug = '',
}: ResolveSBTsPageInitialCreateGroupSessionSlugArgs = {}): string =>
  normalizeSessionSlug(sessionSlug || sessionConfig?.slug || activeSessionSlug || '');

export const buildSBTsPageInitialState = ({
  activeSessionSlug = '',
  hasCachedCreateSbtForm = null,
  sessionConfig = null,
  sessionSlug = '',
}: BuildSBTsPageInitialStateArgs = {}): {
  showCreateGroup: boolean;
  showSBTsList: boolean;
} => {
  const initialCreateGroupSessionSlug = resolveSBTsPageInitialCreateGroupSessionSlug({
    activeSessionSlug,
    sessionConfig,
    sessionSlug,
  });
  return {
    showSBTsList: false,
    showCreateGroup:
      typeof hasCachedCreateSbtForm === 'function'
        ? hasCachedCreateSbtForm({
            sessionSlug: initialCreateGroupSessionSlug,
            migrateLegacyToSessionKey: true,
            clearInvalid: true,
          })
        : false,
  };
};

export const buildSBTsPageBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: BuildSBTsPageBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = isSBTsPageRecord(state) ? state : {};
  return {
    [key]: !source[key],
  };
};

export const normalizeSBTsPageFeaturedCardImageUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^ipfs:\/\//i.test(raw)) return `https://ipfs.io/ipfs/${raw.replace(/^ipfs:\/\//i, '')}`;
  return normalizeArweaveUrl(raw, {
    contextLabel: 'sbt_page_featured_image',
  });
};

export const hasSBTsPageCacheFeaturedCardImageMetadata = (infoInput: unknown): boolean => {
  const info = asSBTsPageFeaturedSbt(infoInput) as SBTsPageFeaturedSbtMetadataLike | null;
  if (!info) return false;
  if (normalizeSBTsPageFeaturedCardImageUrl(info.image)) return true;
  return (
    info.imageLocked === true ||
    !!info.imageEncrypted ||
    !!info.encryptedImage ||
    !!(isSBTsPageRecord(info.encryptedFields) && info.encryptedFields.image)
  );
};

export const buildSBTsPageCacheFeaturedCardModel = ({
  defaultImage = '',
  effectiveSessionSlug = '',
  entry = {},
  getDisplayName = () => '',
  getShortAddress = (address: string) => address,
  index = 0,
  nowSeconds = Math.floor(Date.now() / 1000),
  sbtLabel = 'SBT',
}: BuildSBTsPageCacheFeaturedCardModelArgs = {}): SBTsPageCacheFeaturedCardModel => {
  const entryRecord = isSBTsPageRecord(entry) ? entry : {};
  const sbt = asSBTsPageFeaturedSbt(entryRecord.sbt) || null;
  const sbtInfo = (asSBTsPageFeaturedSbt(sbt?.sbtInfo) || {}) as SBTsPageFeaturedSbtMetadataLike;
  const sbtAddress = String(entryRecord.address || '').trim();
  const resolvedSessionSlug = normalizeSessionSlug(entryRecord.sessionSlug || effectiveSessionSlug || '');
  const sbtKey = `${resolvedSessionSlug || 'general'}:${String(sbtAddress || '').toLowerCase() || index}`;
  const imageUrl = normalizeSBTsPageFeaturedCardImageUrl(sbtInfo?.image) || String(defaultImage || '');
  const sbtName = String(getDisplayName(sbtInfo) || `Unnamed ${sbtLabel}`);
  const shortenedAddress = String(getShortAddress(sbtAddress, false) || '');
  const mintingEndTime = Number(sbtInfo?.mintingEndTime || 0);
  const resolvedNowSeconds = Number(nowSeconds || 0);
  return {
    imageUrl,
    isMintingActive: mintingEndTime === 0 || mintingEndTime > resolvedNowSeconds,
    isPasswordLocked: !!sbtInfo?.hasPasswordMint,
    resolvedSessionSlug,
    sbt,
    sbtAddress,
    sbtInfo,
    sbtKey,
    sbtName,
    shortenedAddress,
  };
};

export const buildSBTsPageFeaturedEntryModel = ({
  effectiveSessionSlug = '',
  entry = {},
  index = 0,
}: BuildSBTsPageFeaturedEntryModelArgs = {}): SBTsPageFeaturedEntryModel => {
  const entryRecord = isSBTsPageRecord(entry) ? entry : {};
  const sbtAddress = entryRecord.address;
  const resolvedSessionSlug = normalizeSessionSlug(entryRecord.sessionSlug || effectiveSessionSlug || '');
  const sbtKey = `${resolvedSessionSlug || 'general'}:${String(sbtAddress || '').toLowerCase() || index}`;
  return {
    resolvedSessionSlug,
    sbtAddress,
    sbtKey,
  };
};

export const resolveSBTsPageDisplaySessionConfig = ({
  getDemoSessionConfigBySlug = null,
  getSessionConfigBySlug = null,
  getSessionConfigBySlugOrDefault = null,
  slugIn = '',
}: ResolveSBTsPageDisplaySessionConfigArgs = {}): SBTsPageSessionConfigLike | null => {
  const slug = normalizeSessionSlug(slugIn || '');
  if (!slug) {
    return asSBTsPageSessionConfig(
      getSessionConfigBySlugOrDefault?.('') || getDemoSessionConfigBySlug?.('', { allowDemoFallback: true }) || null,
    );
  }
  return asSBTsPageSessionConfig(
    getSessionConfigBySlug?.(slug) || getDemoSessionConfigBySlug?.(slug, { allowDemoFallback: true }) || null,
  );
};

export const resolveSBTsPageDisplaySessionLists = ({
  sessionConfig,
  ...configArgs
}: ResolveSBTsPageDisplaySessionListsArgs = {}): {
  featured_SBTs_LIST: unknown[];
  ignored_SBTs_LIST: unknown[];
} => {
  const resolvedSessionConfig =
    asSBTsPageSessionConfig(sessionConfig) || resolveSBTsPageDisplaySessionConfig(configArgs) || {};
  return {
    featured_SBTs_LIST: Array.isArray(resolvedSessionConfig?.featured_SBTs_LIST)
      ? resolvedSessionConfig.featured_SBTs_LIST
      : [],
    ignored_SBTs_LIST: Array.isArray(resolvedSessionConfig?.ignored_SBTs_LIST)
      ? resolvedSessionConfig.ignored_SBTs_LIST
      : [],
  };
};

export const dedupeSBTsPageAddressListCaseInsensitive = (list: unknown): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  (Array.isArray(list) ? list : []).forEach((addr) => {
    const raw = String(addr || '').trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(raw);
  });
  return out;
};

export const dedupeSBTsPageSessionSlugList = (list: unknown): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  (Array.isArray(list) ? list : []).forEach((slug) => {
    const normalized = normalizeSessionSlug(slug || '');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export const buildSBTsPageFeaturedProgressSignature = (
  progressBySlug: Record<string, SBTsPageFeaturedProgressLike | unknown> = {},
  slugs: unknown[] = [],
): string =>
  dedupeSBTsPageSessionSlugList(slugs)
    .map((slug) => {
      const progress = asSBTsPageFeaturedProgress(progressBySlug?.[slug]);
      if (!progress) return `${slug}:idle`;
      return [
        slug,
        Number(progress.currentBlock || 0),
        Number(progress.latestBlock || 0),
        Number(progress.displayCurrentBlock || 0),
        Number(progress.liveCurrentBlock || 0),
        Number(progress.lastBlock || 0),
        progress.scanInProgress ? '1' : '0',
        progress.deferred ? '1' : '0',
      ].join(':');
    })
    .join('|');

export const resolveSBTsPageAutoFeatureBySessionSlug = (metadata: SBTsPageMaybeRecord = null): unknown =>
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags;

export const isSBTsPageSessionAutoFeatureEnabled = (sessionConfig: SBTsPageSessionConfigLike | null = null): boolean =>
  resolveSBTsPageAutoFeatureBySessionSlug(sessionConfig) !== false;

export const hasSBTsPageOwn = (obj: unknown, key: string): obj is SBTsPageUnknownRecord =>
  isSBTsPageRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);

export const hasSBTsPageAuthoritativeSessionSlug = (obj: unknown): boolean => {
  if (!hasSBTsPageOwn(obj, 'sessionSlug')) return false;
  const hasExplicitFlag = hasSBTsPageOwn(obj, 'sessionSlugExplicit');
  return obj.sessionSlugExplicit === true || !hasExplicitFlag;
};

export const hasSBTsPageExplicitSessionSlug = (obj: unknown): boolean =>
  hasSBTsPageOwn(obj, 'sessionSlug') && (obj as SBTsPageUnknownRecord).sessionSlugExplicit === true;

export const resolveSBTsPageFeaturedSbtSessionSlug = (
  sbt: unknown,
  { requireExplicitSessionSlug = false }: ResolveSBTsPageFeaturedSbtSessionSlugOptions = {},
): string | null => {
  const sbtRecord = asSBTsPageFeaturedSbt(sbt);
  if (!sbtRecord) return null;
  const info = asSBTsPageFeaturedSbt(sbtRecord.sbtInfo) || {};

  if (requireExplicitSessionSlug) {
    if (hasSBTsPageExplicitSessionSlug(info)) {
      return normalizeSessionSlug(info?.sessionSlug || '');
    }
    if (hasSBTsPageExplicitSessionSlug(sbtRecord)) {
      return normalizeSessionSlug(sbtRecord?.sessionSlug || '');
    }
    return null;
  }

  if (hasSBTsPageAuthoritativeSessionSlug(info)) {
    return normalizeSessionSlug(info?.sessionSlug || '');
  }
  if (hasSBTsPageAuthoritativeSessionSlug(sbtRecord)) {
    return normalizeSessionSlug(sbtRecord?.sessionSlug || '');
  }

  // Auto-feature must respect metadata authority boundaries, not cache/source buckets.
  const legacyRaw = info?.slug;
  if (legacyRaw != null && String(legacyRaw).trim() !== '') {
    return normalizeSessionSlug(legacyRaw);
  }

  return null;
};

export const normalizeSBTsPageFeaturedEntries = (featuredEntries: unknown): SBTsPageNormalizedFeaturedEntry[] =>
  (Array.isArray(featuredEntries) ? featuredEntries : [])
    .map((rawEntry) => {
      const entry = isSBTsPageRecord(rawEntry) ? rawEntry : {};
      const address = String(entry?.address || '').trim();
      return {
        address,
        lowerAddress: address.toLowerCase(),
        sessionSlug: normalizeSessionSlug(entry?.sessionSlug || ''),
      };
    })
    .filter((entry) => entry.address && entry.lowerAddress);

export const resolveSBTsPageReferrerSessionSlug = (referrer: unknown): string => {
  const match = String(referrer || '').match(/\/session\/([^/?#]+)/i);
  return match && match[1] ? normalizeSessionSlug(match[1].trim()) : '';
};
