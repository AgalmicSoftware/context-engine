/**
 * @module sbtDisplayNames
 * @description SBT display name resolution — maps on-chain SBT contract addresses to
 *              human-readable labels via Arweave metadata lookup and local cache.
 *
 * Key exports: getSbtDisplayName, resolveSbtDisplayLabel, warmSbtDisplayNamesTargeted, hasSbtDisplayName, shortenSbtAddressText
 */
import { ethers } from 'ethers';
import contractScripts, { getDemoSessionConfigBySlug, getSessionConfigBySlugOrDefault } from '../web3/chainGateway.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  subscribeCacheUpdates,
  writeCache,
} from '../cache/cacheScripts.js';
import { ENABLE_TARGETED_SBT_METADATA_LOOKUP, USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import { toStr } from '../shared/primitives.js';
import {
  SBT_MASKED_FIELD_VALUE,
  buildSbtDisplayCacheEntry,
  buildSbtDisplayInflightLookupKey,
  buildSbtDisplayLabelMemoKey,
  buildSbtDisplayRetryStateKey,
  getSbtMetadataDescriptionText,
  getSbtMetadataDisplayNameValue,
  isSbtMetadataFieldLocked,
  normalizeSbtDisplayChainId as normalizeChainId,
  resolveSbtCacheEntryFromBucket as resolveEntryFromNetBucket,
  resolveSbtDisplayCacheWriteNetKey,
  resolveSbtDisplayNameFromCacheValue as resolveNameFromSbtCacheValue,
  resolveSbtDisplayRetryAllowed,
  resolveSbtMetadataLookupDecision,
  isSbtDisplayMetadataRecord,
  shouldPersistSbtDisplayMetadata,
  shouldWriteSbtDisplayLabelMemoEntry,
} from './sbtDisplayNameContracts.js';

type UnknownRecord = Record<string, unknown>;
type SessionConfigRecord = UnknownRecord & {
  __registry?: UnknownRecord;
  __unresolved?: unknown;
  networkChainId?: unknown;
  slug?: unknown;
};
type SbtCacheBucket = UnknownRecord & {
  sbtList: Record<string, unknown>;
};
type SbtDisplayMemoValue = UnknownRecord & {
  name?: unknown;
};
type SbtDisplayMemoEntry = {
  value?: unknown;
  ts?: number;
};
type SbtRetryStateEntry = {
  attempts?: number;
  nextRetryAt?: number;
  lastFailureAt?: number;
};
type ChainContextArgs = {
  chainId?: unknown;
  preferredSlug?: unknown;
};
type SbtMetadataLookupConfig = SessionConfigRecord & {
  networkChainId?: unknown;
};
type MetadataLookupArgs = ChainContextArgs & {
  metadataLookupConfig?: unknown;
};
type PersistSbtMetadataArgs = ChainContextArgs & {
  address?: unknown;
  metadata?: unknown;
};
type ResolveSbtDisplayLabelArgs = ChainContextArgs & {
  address?: unknown;
  sbtInfo?: unknown;
  fallback?: unknown;
};
type HydrateSbtDisplayNameArgs = ChainContextArgs & {
  address?: unknown;
  metadataLookupConfig?: unknown;
  writeBack?: boolean;
};
type WarmSbtDisplayNamesArgs = ChainContextArgs & {
  addresses?: unknown;
  metadataLookupConfig?: unknown;
  writeBack?: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const readRecord = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const asSessionConfigRecord = (value: unknown): SessionConfigRecord | null =>
  isRecord(value) ? (value as SessionConfigRecord) : null;

const asMutableSbtCache = (value: unknown): Record<string, SbtCacheBucket> =>
  isRecord(value) ? (value as Record<string, SbtCacheBucket>) : {};

const writeCacheValue = writeCache as (namespace: string, slug?: string, value?: unknown) => Promise<unknown>;

const NAME_LOOKUP_BASE_DELAY_MS = 30 * 1000;
const NAME_LOOKUP_MAX_DELAY_MS = 60 * 60 * 1000;
const NAME_LOOKUP_MAX_EXPONENT = 8;
const DISPLAY_LABEL_MEMO_TTL_MS = 5 * 60 * 1000;
const DISPLAY_LABEL_MEMO_MAX = 3000;
const RETRY_STATE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_STATE_MAX = 4000;
const ALLOW_DEMO_SESSION_FALLBACK = !USE_ONCHAIN_SESSION_REGISTRY;

const inflightByKey = new Map<string, Promise<SbtDisplayMemoValue | null>>();
const retryStateByKey = new Map<string, SbtRetryStateEntry>();
const displayLabelMemoByKey = new Map<string, SbtDisplayMemoEntry>();
let didSubscribeToSbtCacheUpdates = false;

const sanitizeSlug = (value: unknown) => toStr(value).trim().toLowerCase();

const normalizeAddress = (value: unknown) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    return ethers.utils.getAddress(raw);
  } catch (_) {
    return '';
  }
};

const isUnresolvedSessionConfig = (config) => !!config && typeof config === 'object' && config.__unresolved === true;

const getDisplaySessionConfig = (preferredSlug: unknown = ''): SessionConfigRecord | null => {
  const slug = sanitizeSlug(preferredSlug);
  const strictLookupConfig = asSessionConfigRecord(getSessionConfigBySlugOrDefault(slug));
  if (strictLookupConfig && !isUnresolvedSessionConfig(strictLookupConfig)) {
    return strictLookupConfig;
  }
  if (!ALLOW_DEMO_SESSION_FALLBACK) {
    return strictLookupConfig || null;
  }
  const demoLookupConfig = getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
  return demoLookupConfig || strictLookupConfig || null;
};

const resolveExpectedChainId = ({ chainId = null, preferredSlug = '' }: ChainContextArgs = {}) => {
  const directChainId = normalizeChainId(chainId);
  if (directChainId > 0) return directChainId;

  const slug = sanitizeSlug(preferredSlug);
  if (!slug) return 0;

  const cfg = getDisplaySessionConfig(slug) || {};
  return normalizeChainId(cfg?.networkChainId || cfg?.__registry?.chainId || 0);
};

const readBoolish = (raw: unknown, defaultValue = false) => {
  if (typeof raw === 'boolean') return raw;
  const value = toStr(raw).trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return defaultValue;
};

const getNameLookupDelayMs = (attempts: unknown) => {
  const safeAttempts = Number(attempts || 0);
  const exponent = Math.min(Math.max(safeAttempts - 1, 0), NAME_LOOKUP_MAX_EXPONENT);
  return Math.min(NAME_LOOKUP_BASE_DELAY_MS * 2 ** exponent, NAME_LOOKUP_MAX_DELAY_MS);
};

const getDisplayLabelMemoKey = buildSbtDisplayLabelMemoKey;

const readDisplayLabelMemoEntry = (memoKey: unknown) => {
  const key = toStr(memoKey).trim();
  if (!key) return null;
  const entry = displayLabelMemoByKey.get(key);
  if (!entry || typeof entry !== 'object') return null;
  const ageMs = Date.now() - Number(entry.ts || 0);
  if (!Number.isFinite(ageMs) || ageMs > DISPLAY_LABEL_MEMO_TTL_MS) {
    displayLabelMemoByKey.delete(key);
    return null;
  }
  displayLabelMemoByKey.delete(key);
  displayLabelMemoByKey.set(key, entry);
  return isRecord(entry.value) ? (entry.value as SbtDisplayMemoValue) : null;
};

const writeDisplayLabelMemoEntry = (memoKey: unknown, value: unknown) => {
  const key = toStr(memoKey).trim();
  if (!shouldWriteSbtDisplayLabelMemoEntry({ memoKey: key, value })) return;
  displayLabelMemoByKey.delete(key);
  displayLabelMemoByKey.set(key, { value, ts: Date.now() });
  while (displayLabelMemoByKey.size > DISPLAY_LABEL_MEMO_MAX) {
    const oldest = displayLabelMemoByKey.keys().next().value;
    if (!oldest) break;
    displayLabelMemoByKey.delete(oldest);
  }
};

const ensureSbtDisplayNameCacheSubscription = () => {
  if (didSubscribeToSbtCacheUpdates) return;
  didSubscribeToSbtCacheUpdates = true;
  subscribeCacheUpdates((event: unknown) => {
    if (String(readRecord(event, 'namespace') || '') !== 'sbtCache') return;
    displayLabelMemoByKey.clear();
  });
};

export const isSbtFieldLocked = isSbtMetadataFieldLocked;

export const getSbtMaskedFieldValue = () => SBT_MASKED_FIELD_VALUE;

export const getSbtDescriptionText = getSbtMetadataDescriptionText;

const getSbtDisplayNameValue = getSbtMetadataDisplayNameValue;

const ensureNetBucket = (cacheObj: Record<string, SbtCacheBucket>, netKey: unknown): SbtCacheBucket | null => {
  const key = toStr(netKey).trim();
  if (!key) return null;

  if (!isRecord(cacheObj[key])) {
    cacheObj[key] = { sbtList: {} };
  }
  const bucket = cacheObj[key];
  if (!isRecord(bucket.sbtList)) {
    bucket.sbtList = {};
  }
  return bucket;
};

const getMetadataLookupConfig = ({
  preferredSlug = '',
  metadataLookupConfig = null,
  chainId = null,
}: MetadataLookupArgs = {}): SbtMetadataLookupConfig => {
  if (isRecord(metadataLookupConfig)) {
    const out: SbtMetadataLookupConfig = { ...metadataLookupConfig };
    if (!out.slug) out.slug = sanitizeSlug(preferredSlug || out.slug || '');
    if (!out.networkChainId && Number(chainId || 0) > 0) {
      out.networkChainId = Number(chainId);
    }
    return out;
  }

  const slug = sanitizeSlug(preferredSlug);
  const cfg = getDisplaySessionConfig(slug);
  const out: SbtMetadataLookupConfig = {
    ...(cfg || {}),
    slug,
  };

  const resolvedChainId = Number(chainId || out?.networkChainId || out?.__registry?.chainId || 0) || 0;

  if (resolvedChainId > 0) {
    out.networkChainId = resolvedChainId;
    if (!isRecord(out.__registry)) {
      out.__registry = { chainId: resolvedChainId };
    } else if (!Number(out.__registry.chainId || 0)) {
      out.__registry = { ...out.__registry, chainId: resolvedChainId };
    }
  }

  return out;
};

const getRetryStateKey = buildSbtDisplayRetryStateKey;

const pruneRetryStateCache = (now = Date.now()) => {
  const staleBefore = now - RETRY_STATE_TTL_MS;
  retryStateByKey.forEach((entry, key) => {
    const lastFailureAt = Number(entry?.lastFailureAt || 0);
    const nextRetryAt = Number(entry?.nextRetryAt || 0);
    const isStale =
      Number.isFinite(lastFailureAt) &&
      lastFailureAt <= staleBefore &&
      (!Number.isFinite(nextRetryAt) || nextRetryAt <= now);
    if (isStale) retryStateByKey.delete(key);
  });
  while (retryStateByKey.size > RETRY_STATE_MAX) {
    const oldest = retryStateByKey.keys().next().value;
    if (!oldest) break;
    retryStateByKey.delete(oldest);
  }
};

const canRetryNameLookup = (retryKey: string, now = Date.now()) => {
  pruneRetryStateCache(now);
  return resolveSbtDisplayRetryAllowed(retryStateByKey.get(retryKey), now);
};

const markNameLookupFailure = (retryKey: string, now = Date.now()) => {
  pruneRetryStateCache(now);
  const prevAttempts = Number(retryStateByKey.get(retryKey)?.attempts || 0) || 0;
  const attempts = prevAttempts + 1;
  const delayMs = getNameLookupDelayMs(attempts);
  retryStateByKey.set(retryKey, {
    attempts,
    nextRetryAt: now + delayMs,
    lastFailureAt: now,
  });
  pruneRetryStateCache(now);
};

const clearNameLookupFailure = (retryKey: string) => {
  retryStateByKey.delete(retryKey);
};

const persistSbtMetadataToCache = async ({
  address = '',
  preferredSlug = '',
  metadata = null,
  chainId = null,
}: PersistSbtMetadataArgs = {}) => {
  const checksum = normalizeAddress(address);
  if (!checksum || !isSbtDisplayMetadataRecord(metadata) || !shouldPersistSbtDisplayMetadata(metadata)) return false;

  const slug = sanitizeSlug(preferredSlug || metadata?.slug || '');
  const addressLower = checksum.toLowerCase();
  const cacheObj = asMutableSbtCache(await readCache('sbtCache', slug));
  const netKey = resolveSbtDisplayCacheWriteNetKey({
    cacheObj,
    addressLower,
    chainId,
    info: metadata,
  });

  if (!netKey) return false;

  const bucket = ensureNetBucket(cacheObj, netKey);
  if (!bucket) return false;

  const existingEntry = resolveEntryFromNetBucket(bucket, addressLower) || {};
  bucket.sbtList[addressLower] = buildSbtDisplayCacheEntry({
    existingEntry,
    checksum,
    metadata,
    slug,
  });

  return !!(await writeCacheValue('sbtCache', slug, cacheObj));
};

export const shortenSbtAddressText = (address: unknown) => {
  const raw = toStr(address).trim();
  if (!raw) return '';
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
};

export const getSbtDisplayName = (info: unknown) => getSbtDisplayNameValue(info);

export const hasSbtDisplayName = (info: unknown) => !!getSbtDisplayNameValue(info);

export const isTargetedSbtMetadataLookupEnabled = () => {
  try {
    const runtimeFlags = globalThis as typeof globalThis & { ENABLE_TARGETED_SBT_METADATA_LOOKUP?: unknown };
    if (typeof runtimeFlags.ENABLE_TARGETED_SBT_METADATA_LOOKUP !== 'undefined') {
      return readBoolish(runtimeFlags.ENABLE_TARGETED_SBT_METADATA_LOOKUP, !!ENABLE_TARGETED_SBT_METADATA_LOOKUP);
    }
  } catch (e) {
    void e; /* fallback: runtime flag lookup. */
  }
  return !!ENABLE_TARGETED_SBT_METADATA_LOOKUP;
};

export const resolveSbtDisplayNameFromCaches = ({
  address = '',
  preferredSlug = '',
  chainId = null,
}: ChainContextArgs & { address?: unknown } = {}) => {
  ensureSbtDisplayNameCacheSubscription();
  const checksum = normalizeAddress(address);
  if (!checksum) return null;

  const addressLower = checksum.toLowerCase();
  const slug = sanitizeSlug(preferredSlug);
  const expectedChainId = resolveExpectedChainId({ chainId, preferredSlug: slug });
  const memoKey = getDisplayLabelMemoKey({
    addressLower,
    preferredSlug: slug,
    chainId: expectedChainId,
  });
  const memoHit = readDisplayLabelMemoEntry(memoKey);
  if (memoHit?.name) return memoHit;

  if (slug) {
    const slugCache = peekCacheSync('sbtCache', slug, { clone: false });
    const inSlug = resolveNameFromSbtCacheValue(slugCache, addressLower, { expectedChainId });
    if (inSlug?.name) {
      const resolved = {
        address: checksum,
        slug,
        source: 'preferred-slug-cache',
        ...inSlug,
      };
      writeDisplayLabelMemoEntry(memoKey, resolved);
      return resolved;
    }
  }

  if (expectedChainId <= 0) return null;

  const rawEntries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  for (const entry of entries) {
    const entrySlug = sanitizeSlug(readRecord(entry, 'slug') || '');
    if (slug && entrySlug === slug) continue;

    const hit = resolveNameFromSbtCacheValue(readRecord(entry, 'value'), addressLower, { expectedChainId });
    if (!hit?.name) continue;

    const resolved = {
      address: checksum,
      slug: entrySlug,
      source: 'cross-slug-cache',
      ...hit,
    };
    writeDisplayLabelMemoEntry(memoKey, resolved);
    return resolved;
  }

  return null;
};

export const resolveSbtDisplayLabel = ({
  address = '',
  sbtInfo = null,
  preferredSlug = '',
  chainId = null,
  fallback = 'short',
}: ResolveSbtDisplayLabelArgs = {}) => {
  const checksum = normalizeAddress(address);
  if (!checksum) return '';

  const infoName = getSbtDisplayNameValue(sbtInfo);
  if (infoName) return infoName;
  const infoChainId = normalizeChainId(readRecord(sbtInfo, 'chainID') || readRecord(sbtInfo, 'chainId') || 0);
  const expectedChainId = normalizeChainId(chainId) || infoChainId;

  const cacheHit = resolveSbtDisplayNameFromCaches({
    address: checksum,
    preferredSlug,
    chainId: expectedChainId,
  });
  if (cacheHit?.name) return cacheHit.name;

  if (fallback === 'address') return checksum;
  return shortenSbtAddressText(checksum);
};

export const hydrateSbtDisplayNameTargeted = async ({
  address = '',
  preferredSlug = '',
  metadataLookupConfig = null,
  chainId = null,
  writeBack = true,
}: HydrateSbtDisplayNameArgs = {}) => {
  ensureSbtDisplayNameCacheSubscription();
  const checksum = normalizeAddress(address);
  if (!checksum) return null;

  const slug = sanitizeSlug(preferredSlug || readRecord(metadataLookupConfig, 'slug') || '');
  const resolvedChainId = resolveExpectedChainId({
    chainId: chainId || readRecord(metadataLookupConfig, 'networkChainId') || 0,
    preferredSlug: slug,
  });

  const cacheHit = resolveSbtDisplayNameFromCaches({
    address: checksum,
    preferredSlug: slug,
    chainId: resolvedChainId,
  });
  if (cacheHit?.name) return cacheHit;

  if (!isTargetedSbtMetadataLookupEnabled()) return null;

  const addressLower = checksum.toLowerCase();
  const memoKey = getDisplayLabelMemoKey({
    addressLower,
    preferredSlug: slug,
    chainId: resolvedChainId,
  });
  const retryKey = getRetryStateKey({
    addressLower,
    slug,
    chainId: resolvedChainId,
  });

  if (!canRetryNameLookup(retryKey)) return null;

  const inFlightKey = buildSbtDisplayInflightLookupKey(retryKey);
  if (inflightByKey.has(inFlightKey)) {
    return inflightByKey.get(inFlightKey);
  }

  const task = (async () => {
    try {
      const cfg = getMetadataLookupConfig({
        preferredSlug: slug,
        metadataLookupConfig,
        chainId: resolvedChainId,
      });

      const metadata = await contractScripts.getSbtMetadata('none', checksum, cfg);
      if (!shouldPersistSbtDisplayMetadata(metadata)) {
        markNameLookupFailure(retryKey);
        return null;
      }

      if (writeBack) {
        await persistSbtMetadataToCache({
          address: checksum,
          preferredSlug: slug,
          metadata,
          chainId:
            resolvedChainId || Number(readRecord(metadata, 'chainID') || readRecord(metadata, 'chainId') || 0) || 0,
        });
      }

      const metadataDecision = resolveSbtMetadataLookupDecision(metadata);
      if (!metadataDecision.shouldUseResult) {
        markNameLookupFailure(retryKey);
        return null;
      }

      clearNameLookupFailure(retryKey);
      const name = metadataDecision.name;

      const resolved = {
        address: checksum,
        slug,
        source: 'targeted-lookup',
        name,
        info: metadata,
      };
      const metadataChainId = Number(readRecord(metadata, 'chainID') || readRecord(metadata, 'chainId') || 0) || 0;
      const memoChainId = normalizeChainId(resolvedChainId || metadataChainId);
      const targetedMemoKey = getDisplayLabelMemoKey({
        addressLower,
        preferredSlug: slug,
        chainId: memoChainId,
      });
      writeDisplayLabelMemoEntry(targetedMemoKey, resolved);
      if (memoKey !== targetedMemoKey) {
        writeDisplayLabelMemoEntry(memoKey, resolved);
      }
      return resolved;
    } catch (_) {
      markNameLookupFailure(retryKey);
      return null;
    } finally {
      inflightByKey.delete(inFlightKey);
    }
  })();

  inflightByKey.set(inFlightKey, task);
  return task;
};

export const warmSbtDisplayNamesTargeted = async ({
  addresses = [],
  preferredSlug = '',
  metadataLookupConfig = null,
  chainId = null,
  writeBack = true,
} = {}) => {
  const unique = Array.from(
    new Set((Array.isArray(addresses) ? addresses : []).map((value) => normalizeAddress(value)).filter(Boolean)),
  );

  const results = await Promise.all(
    unique.map((address) =>
      hydrateSbtDisplayNameTargeted({
        address,
        preferredSlug,
        metadataLookupConfig,
        chainId,
        writeBack,
      }),
    ),
  );

  return results.filter(Boolean);
};

export const __test__resetSbtDisplayNameLookups = () => {
  inflightByKey.clear();
  retryStateByKey.clear();
  displayLabelMemoByKey.clear();
};

export const __test__getSbtDisplayNameLookupStats = () => ({
  inflightSize: inflightByKey.size,
  retrySize: retryStateByKey.size,
  memoSize: displayLabelMemoByKey.size,
});
