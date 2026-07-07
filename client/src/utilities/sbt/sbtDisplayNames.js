/**
 * @module sbtDisplayNames
 * @description SBT display name resolution — maps on-chain SBT contract addresses to
 *              human-readable labels via Arweave metadata lookup and local cache.
 *
 * Key exports: getSbtDisplayName, resolveSbtDisplayLabel, warmSbtDisplayNamesTargeted, hasSbtDisplayName, shortenSbtAddressText
 */
import { ethers } from 'ethers';
import contractScripts, {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../web3/contractScripts.js';
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
  shouldPersistSbtDisplayMetadata,
  shouldWriteSbtDisplayLabelMemoEntry,
} from './sbtDisplayNameContracts.js';

const NAME_LOOKUP_BASE_DELAY_MS = 30 * 1000;
const NAME_LOOKUP_MAX_DELAY_MS = 60 * 60 * 1000;
const NAME_LOOKUP_MAX_EXPONENT = 8;
const DISPLAY_LABEL_MEMO_TTL_MS = 5 * 60 * 1000;
const DISPLAY_LABEL_MEMO_MAX = 3000;
const RETRY_STATE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_STATE_MAX = 4000;
const ALLOW_DEMO_SESSION_FALLBACK = !USE_ONCHAIN_SESSION_REGISTRY;

const inflightByKey = new Map();
const retryStateByKey = new Map();
const displayLabelMemoByKey = new Map();
let didSubscribeToSbtCacheUpdates = false;

const sanitizeSlug = (value) => toStr(value).trim().toLowerCase();

const normalizeAddress = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    return ethers.utils.getAddress(raw);
  } catch (_) {
    return '';
  }
};

const isUnresolvedSessionConfig = (config) => !!config && typeof config === 'object' && config.__unresolved === true;

const getDisplaySessionConfig = (preferredSlug = '') => {
  const slug = sanitizeSlug(preferredSlug);
  const strictLookupConfig = getSessionConfigBySlugOrDefault(slug);
  if (strictLookupConfig && !isUnresolvedSessionConfig(strictLookupConfig)) {
    return strictLookupConfig;
  }
  if (!ALLOW_DEMO_SESSION_FALLBACK) {
    return strictLookupConfig || null;
  }
  const demoLookupConfig = getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
  return demoLookupConfig || strictLookupConfig || null;
};

const resolveExpectedChainId = ({ chainId = null, preferredSlug = '' } = {}) => {
  const directChainId = normalizeChainId(chainId);
  if (directChainId > 0) return directChainId;

  const slug = sanitizeSlug(preferredSlug);
  if (!slug) return 0;

  const cfg = getDisplaySessionConfig(slug) || {};
  return normalizeChainId(cfg?.networkChainId || cfg?.__registry?.chainId || 0);
};

const readBoolish = (raw, defaultValue = false) => {
  if (typeof raw === 'boolean') return raw;
  const value = toStr(raw).trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return defaultValue;
};

const getNameLookupDelayMs = (attempts) => {
  const safeAttempts = Number(attempts || 0);
  const exponent = Math.min(Math.max(safeAttempts - 1, 0), NAME_LOOKUP_MAX_EXPONENT);
  return Math.min(NAME_LOOKUP_BASE_DELAY_MS * 2 ** exponent, NAME_LOOKUP_MAX_DELAY_MS);
};

const getDisplayLabelMemoKey = buildSbtDisplayLabelMemoKey;

const readDisplayLabelMemoEntry = (memoKey) => {
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
  return entry.value || null;
};

const writeDisplayLabelMemoEntry = (memoKey, value) => {
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
  subscribeCacheUpdates((event) => {
    if (String(event?.namespace || '') !== 'sbtCache') return;
    displayLabelMemoByKey.clear();
  });
};

export const isSbtFieldLocked = isSbtMetadataFieldLocked;

export const getSbtMaskedFieldValue = () => SBT_MASKED_FIELD_VALUE;

export const getSbtDescriptionText = getSbtMetadataDescriptionText;

const getSbtDisplayNameValue = getSbtMetadataDisplayNameValue;

const ensureNetBucket = (cacheObj, netKey) => {
  const key = toStr(netKey).trim();
  if (!key) return null;

  if (!cacheObj[key] || typeof cacheObj[key] !== 'object') {
    cacheObj[key] = { sbtList: {} };
  }
  if (!cacheObj[key].sbtList || typeof cacheObj[key].sbtList !== 'object') {
    cacheObj[key].sbtList = {};
  }
  return cacheObj[key];
};

const getMetadataLookupConfig = ({ preferredSlug = '', metadataLookupConfig = null, chainId = null } = {}) => {
  if (metadataLookupConfig && typeof metadataLookupConfig === 'object') {
    const out = { ...metadataLookupConfig };
    if (!out.slug) out.slug = sanitizeSlug(preferredSlug || out.slug || '');
    if (!out.networkChainId && Number(chainId || 0) > 0) {
      out.networkChainId = Number(chainId);
    }
    return out;
  }

  const slug = sanitizeSlug(preferredSlug);
  const cfg = getDisplaySessionConfig(slug) || {};
  const out = {
    ...(cfg && typeof cfg === 'object' ? cfg : {}),
    slug,
  };

  const resolvedChainId = Number(chainId || out?.networkChainId || out?.__registry?.chainId || 0) || 0;

  if (resolvedChainId > 0) {
    out.networkChainId = resolvedChainId;
    if (!out.__registry || typeof out.__registry !== 'object') {
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

const canRetryNameLookup = (retryKey, now = Date.now()) => {
  pruneRetryStateCache(now);
  return resolveSbtDisplayRetryAllowed(retryStateByKey.get(retryKey), now);
};

const markNameLookupFailure = (retryKey, now = Date.now()) => {
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

const clearNameLookupFailure = (retryKey) => {
  retryStateByKey.delete(retryKey);
};

const persistSbtMetadataToCache = async ({
  address = '',
  preferredSlug = '',
  metadata = null,
  chainId = null,
} = {}) => {
  const checksum = normalizeAddress(address);
  if (!checksum || !shouldPersistSbtDisplayMetadata(metadata)) return false;

  const slug = sanitizeSlug(preferredSlug || metadata?.slug || '');
  const addressLower = checksum.toLowerCase();
  const cacheObj = (await readCache('sbtCache', slug)) || {};
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

  return !!(await writeCache('sbtCache', slug, cacheObj));
};

export const shortenSbtAddressText = (address) => {
  const raw = toStr(address).trim();
  if (!raw) return '';
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
};

export const getSbtDisplayName = (info) => getSbtDisplayNameValue(info);

export const hasSbtDisplayName = (info) => !!getSbtDisplayNameValue(info);

export const isTargetedSbtMetadataLookupEnabled = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP !== 'undefined') {
      return readBoolish(globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP, !!ENABLE_TARGETED_SBT_METADATA_LOOKUP);
    }
  } catch (e) {
    void e; /* fallback: runtime flag lookup. */
  }
  return !!ENABLE_TARGETED_SBT_METADATA_LOOKUP;
};

export const resolveSbtDisplayNameFromCaches = ({ address = '', preferredSlug = '', chainId = null } = {}) => {
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

  const entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
  for (const entry of entries) {
    const entrySlug = sanitizeSlug(entry?.slug || '');
    if (slug && entrySlug === slug) continue;

    const hit = resolveNameFromSbtCacheValue(entry?.value, addressLower, { expectedChainId });
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
} = {}) => {
  const checksum = normalizeAddress(address);
  if (!checksum) return '';

  const infoName = getSbtDisplayNameValue(sbtInfo);
  if (infoName) return infoName;
  const infoChainId = normalizeChainId(sbtInfo?.chainID || sbtInfo?.chainId || 0);
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
} = {}) => {
  ensureSbtDisplayNameCacheSubscription();
  const checksum = normalizeAddress(address);
  if (!checksum) return null;

  const slug = sanitizeSlug(preferredSlug || metadataLookupConfig?.slug || '');
  const resolvedChainId = resolveExpectedChainId({
    chainId: chainId || metadataLookupConfig?.networkChainId || 0,
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
          chainId: resolvedChainId || Number(metadata?.chainID || metadata?.chainId || 0) || 0,
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
      const metadataChainId = Number(metadata?.chainID || metadata?.chainId || 0) || 0;
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
