import { sanitizeSbtPageMintedTokensOverride } from './sbtPageAutoMintHelpers';

type BuildNextFilteredHolderRowsArgs = {
  prevFilteredRows?: unknown;
  prevNetHolders?: unknown;
  nextNetHolders?: unknown;
  replaceRows?: boolean;
};
type SbtPageAddressSignatureMemoLike = {
  listRef?: unknown;
  listToken?: unknown;
  signature?: unknown;
};
type SbtPageAddressSignatureMemoState = {
  listRef: unknown[] | null;
  listToken: string;
  signature: string;
};
type BuildSbtPageAddressListSignatureMemoStateArgs = {
  buildAddressListSignature?: (list: unknown) => unknown;
  list?: unknown;
  memo?: SbtPageAddressSignatureMemoLike | null;
};
type SbtPageAddressListSignatureMemoStateResult = {
  memo: SbtPageAddressSignatureMemoState;
  signature: string;
};
type SbtPageNetHoldersMemoLike = {
  burnedRef?: unknown;
  burnedSignature?: unknown;
  mintedRef?: unknown;
  mintedSignature?: unknown;
  result?: unknown;
};
type SbtPageNetHoldersMemoState = {
  burnedRef: unknown[] | null;
  burnedSignature: string;
  mintedRef: unknown[] | null;
  mintedSignature: string;
  result: string[];
};
type BuildSbtPageNetHoldersMemoStateArgs = {
  buildHolderListSignature?: (list: unknown) => string;
  burnedAddresses?: unknown;
  computeNetHoldersList?: (mintsArr: unknown, burnsArr: unknown) => unknown;
  memo?: SbtPageNetHoldersMemoLike | null;
  mintedAddresses?: unknown;
};
type SbtPageNetHoldersMemoStateResult = {
  memo: SbtPageNetHoldersMemoState;
  netHolders: string[];
};
type SbtPageModalFilteredMintedUsersStateLike = Record<string, unknown> & {
  filteredMintedUsers?: unknown;
  filteredMintedUsersSignature?: unknown;
  loadingMintedFilter?: unknown;
};
type BuildSbtPageModalFilteredMintedUsersPatchArgs = {
  buildAddressListSignature?: (list: unknown) => string;
  filtered?: unknown;
  isHolderScanActive?: unknown;
  state?: SbtPageModalFilteredMintedUsersStateLike | null;
};
type SbtPageModalFilteredMintedUsersPatch = {
  filteredMintedUsers?: unknown[];
  filteredMintedUsersSignature?: string;
  loadingMintedFilter: false;
};
type PreservedHolderState = {
  mintedAddresses: string[];
  burnedAddresses: string[];
  burnDiscovered: boolean;
};
export type SbtPageHolderRefreshStateLike = Record<string, unknown> & {
  burnedAddresses?: unknown;
  countsLoaded?: unknown;
  filteredMintedUsers?: unknown;
  filteredMintedUsersSignature?: unknown;
  holdersMetaKey?: unknown;
  mintedAddresses?: unknown;
  mintedTokensOverride?: unknown;
  mintingAddressesFilterInitialized?: unknown;
  showModal?: unknown;
};
export type ReconcileSbtPageHolderRefreshStateArgs = {
  buildAddressListSignature?: ((list: unknown) => unknown) | null;
  buildNextFilteredHolderRows?: ((args: BuildNextFilteredHolderRowsArgs) => unknown) | null;
  nextBurnedAddresses?: unknown;
  nextCountsLoaded?: unknown;
  nextHoldersMetaKey?: unknown;
  nextMintedAddresses?: unknown;
  nextMintedTokensOverride?: unknown;
  prevState?: SbtPageHolderRefreshStateLike | null;
  userLower?: unknown;
};
export type ReconciledSbtPageHolderRefreshState = {
  burnedAddresses: unknown[];
  countsLoaded: boolean;
  filteredMintedUsers: unknown[];
  filteredMintedUsersSignature: string;
  mintedAddresses: unknown[];
  mintedTokensOverride: string | null;
  userHasSBT: boolean;
};
type AddressCountMap = Record<string, number>;
type SbtPageLoadInfoOptions = {
  forceEventFetch: boolean;
  preferCountsOnly: boolean;
};

const isSbtPageHolderRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeSbtPageCountMap = (value: unknown = null): AddressCountMap => {
  const out: AddressCountMap = {};
  Object.entries(isSbtPageHolderRecord(value) ? value : {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

export const expandSbtPageAddressListFromCountMap = (
  countMapIn: unknown = null,
  fallbackList: unknown = [],
): string[] => {
  const hasStructuredCountMap = !!countMapIn && typeof countMapIn === 'object' && !Array.isArray(countMapIn);
  if (!hasStructuredCountMap) {
    return (Array.isArray(fallbackList) ? fallbackList : []).map((addr) => String(addr || '').toLowerCase());
  }
  const normalized = normalizeSbtPageCountMap(countMapIn);
  if (!Object.keys(normalized).length && Array.isArray(fallbackList) && fallbackList.length > 0) {
    return fallbackList.map((addr) => String(addr || '').toLowerCase());
  }
  const expanded: string[] = [];
  Object.entries(normalized).forEach(([addr, count]) => {
    for (let i = 0; i < count; i += 1) {
      expanded.push(addr);
    }
  });
  return expanded;
};

export const buildSbtPageAddressOccurrenceMap = (list: unknown = []): Map<string, number> => {
  const counts = new Map<string, number>();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = String(entry || '').toLowerCase();
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });
  return counts;
};

export const computeSbtPageNetCounts = (mintsArr: unknown = [], burnsArr: unknown = []): Map<string, number> => {
  const counts = new Map<string, number>();
  (Array.isArray(mintsArr) ? mintsArr : []).forEach((a) => {
    const k = (a || '').toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  (Array.isArray(burnsArr) ? burnsArr : []).forEach((a) => {
    const k = (a || '').toLowerCase();
    counts.set(k, (counts.get(k) || 0) - 1);
  });
  return counts;
};

export const computeSbtPageNetHoldersList = (mintsArr: unknown = [], burnsArr: unknown = []): string[] => {
  const counts = computeSbtPageNetCounts(mintsArr, burnsArr);
  return Array.from(counts.entries())
    .filter(([, v]) => v > 0)
    .map(([k]) => k);
};

export const buildSbtPageHolderListSignature = (list: unknown = []): string => {
  const entries = Array.isArray(list) ? list : [];
  let hash = 2166136261;
  for (let i = 0; i < entries.length; i += 1) {
    const normalized = String(entries[i] || '').toLowerCase();
    for (let j = 0; j < normalized.length; j += 1) {
      hash ^= normalized.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 124;
    hash = Math.imul(hash, 16777619);
  }
  return `${entries.length}:${hash >>> 0}`;
};

export const buildSbtPageNetHoldersMemoState = ({
  buildHolderListSignature = buildSbtPageHolderListSignature,
  burnedAddresses = [],
  computeNetHoldersList = computeSbtPageNetHoldersList,
  memo = null,
  mintedAddresses = [],
}: BuildSbtPageNetHoldersMemoStateArgs = {}): SbtPageNetHoldersMemoStateResult => {
  const mintedRef = Array.isArray(mintedAddresses) ? mintedAddresses : [];
  const burnedRef = Array.isArray(burnedAddresses) ? burnedAddresses : [];
  const memoRecord = isSbtPageHolderRecord(memo) ? memo : {};
  const memoResult = Array.isArray(memoRecord.result) ? (memoRecord.result as string[]) : [];
  if (memoRecord.mintedRef === mintedRef && memoRecord.burnedRef === burnedRef) {
    return {
      memo: memoRecord as SbtPageNetHoldersMemoState,
      netHolders: memoResult,
    };
  }
  const mintedSignature = buildHolderListSignature(mintedRef);
  const burnedSignature = buildHolderListSignature(burnedRef);
  if (memoRecord.mintedSignature === mintedSignature && memoRecord.burnedSignature === burnedSignature) {
    return {
      memo: {
        ...(memoRecord as SbtPageNetHoldersMemoState),
        burnedRef,
        mintedRef,
        result: memoResult,
      },
      netHolders: memoResult,
    };
  }
  const nextResult = computeNetHoldersList(mintedRef, burnedRef);
  const netHolders = Array.isArray(nextResult) ? nextResult.map((entry) => String(entry || '')) : [];
  return {
    memo: {
      burnedRef,
      burnedSignature,
      mintedRef,
      mintedSignature,
      result: netHolders,
    },
    netHolders,
  };
};

export const buildSbtPageAddressListSignatureMemoState = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  list = [],
  memo = null,
}: BuildSbtPageAddressListSignatureMemoStateArgs = {}): SbtPageAddressListSignatureMemoStateResult => {
  const entries = Array.isArray(list) ? list : [];
  const listToken = entries.map((entry) => String(entry || '').toLowerCase()).join('|');
  const memoRecord = isSbtPageHolderRecord(memo) ? memo : {};
  if (
    memoRecord.listRef === entries &&
    memoRecord.listToken === listToken &&
    typeof memoRecord.signature === 'string'
  ) {
    return {
      memo: memoRecord as SbtPageAddressSignatureMemoState,
      signature: memoRecord.signature,
    };
  }
  const signature = String(buildAddressListSignature(entries) || `${entries.length}:0`);
  return {
    memo: {
      listRef: entries,
      listToken,
      signature,
    },
    signature,
  };
};

export const buildSbtPageModalFilteredMintedUsersPatch = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  filtered = [],
  isHolderScanActive = false,
  state = null,
}: BuildSbtPageModalFilteredMintedUsersPatchArgs = {}): SbtPageModalFilteredMintedUsersPatch | null => {
  const safeFiltered = Array.isArray(filtered) ? filtered : [];
  const currentState = isSbtPageHolderRecord(state) ? state : {};
  const currentFiltered = Array.isArray(currentState.filteredMintedUsers) ? currentState.filteredMintedUsers : [];
  const preserveDuringRefresh = safeFiltered.length === 0 && Boolean(isHolderScanActive) && currentFiltered.length > 0;
  if (preserveDuringRefresh) {
    return currentState.loadingMintedFilter ? { loadingMintedFilter: false } : null;
  }
  const nextSignature = buildAddressListSignature(safeFiltered);
  if (nextSignature !== currentState.filteredMintedUsersSignature) {
    return {
      filteredMintedUsers: safeFiltered,
      filteredMintedUsersSignature: nextSignature,
      loadingMintedFilter: false,
    };
  }
  return currentState.loadingMintedFilter ? { loadingMintedFilter: false } : null;
};

export const buildSbtPageNextFilteredHolderRows = (
  {
    prevFilteredRows = [],
    prevNetHolders = [],
    nextNetHolders = [],
    replaceRows = false,
  }: BuildNextFilteredHolderRowsArgs = {},
  buildAddressListSignature: (list: unknown) => string = buildSbtPageHolderListSignature,
): string[] => {
  const prevFiltered = (Array.isArray(prevFilteredRows) ? prevFilteredRows : [])
    .map((entry) => String(entry || '').toLowerCase())
    .filter(Boolean);
  const nextRows = (Array.isArray(nextNetHolders) ? nextNetHolders : [])
    .map((entry) => String(entry || '').toLowerCase())
    .filter(Boolean);
  if (replaceRows) {
    const prevWasFullHolderSet = buildAddressListSignature(prevFiltered) === buildAddressListSignature(prevNetHolders);
    if (prevWasFullHolderSet) {
      return nextRows;
    }
  }
  const nextSet = new Set<string>(nextRows);
  return prevFiltered.filter((entry) => nextSet.has(entry));
};

export const mergeSbtPageBurnEvidenceIntoPreservedHolderState = (
  prevMinted: unknown = [],
  prevBurned: unknown = [],
  nextMinted: unknown = [],
  nextBurned: unknown = [],
): PreservedHolderState => {
  const preservedMinted = Array.isArray(prevMinted) ? prevMinted.map((entry) => String(entry || '').toLowerCase()) : [];
  const preservedBurned = Array.isArray(prevBurned) ? prevBurned.map((entry) => String(entry || '').toLowerCase()) : [];
  const nextMintedSafe = Array.isArray(nextMinted) ? nextMinted : [];
  const nextBurnedSafe = Array.isArray(nextBurned) ? nextBurned : [];
  const prevNetCounts = computeSbtPageNetCounts(preservedMinted, preservedBurned);
  const nextNetCounts = computeSbtPageNetCounts(nextMintedSafe, nextBurnedSafe);
  const prevBurnCounts = buildSbtPageAddressOccurrenceMap(preservedBurned);
  const nextBurnCounts = buildSbtPageAddressOccurrenceMap(nextBurnedSafe);
  let burnDiscovered = false;

  prevNetCounts.forEach((prevNetCount, addr) => {
    if (prevNetCount <= 0) return;
    const prevBurnCount = prevBurnCounts.get(addr) || 0;
    const nextBurnCount = nextBurnCounts.get(addr) || 0;
    const nextNetCount = nextNetCounts.get(addr) || 0;
    if (nextBurnCount <= prevBurnCount || nextNetCount >= prevNetCount) return;
    const burnDelta = nextBurnCount - prevBurnCount;
    for (let i = 0; i < burnDelta; i += 1) {
      preservedBurned.push(addr);
    }
    burnDiscovered = true;
  });

  return {
    mintedAddresses: preservedMinted,
    burnedAddresses: preservedBurned,
    burnDiscovered,
  };
};

export const normalizeSbtPageLoadInfoOptions = (optionsOrForce: unknown = false): SbtPageLoadInfoOptions => {
  if (optionsOrForce && typeof optionsOrForce === 'object' && !Array.isArray(optionsOrForce)) {
    const options = optionsOrForce as Record<string, unknown>;
    return {
      forceEventFetch: options.forceEventFetch === true || options.force === true,
      preferCountsOnly: options.preferCountsOnly === true || options.countsOnly === true,
    };
  }
  return {
    forceEventFetch: optionsOrForce === true,
    preferCountsOnly: false,
  };
};

export const reconcileSbtPageHolderRefreshState = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  buildNextFilteredHolderRows = buildSbtPageNextFilteredHolderRows,
  nextBurnedAddresses = [],
  nextCountsLoaded = false,
  nextHoldersMetaKey = '',
  nextMintedAddresses = [],
  nextMintedTokensOverride = null,
  prevState = null,
  userLower = '',
}: ReconcileSbtPageHolderRefreshStateArgs = {}): ReconciledSbtPageHolderRefreshState => {
  const prev = isSbtPageHolderRecord(prevState) ? prevState : {};
  const prevMinted = Array.isArray(prev.mintedAddresses) ? prev.mintedAddresses : [];
  const prevBurned = Array.isArray(prev.burnedAddresses) ? prev.burnedAddresses : [];
  const nextMinted = Array.isArray(nextMintedAddresses) ? nextMintedAddresses : [];
  const nextBurned = Array.isArray(nextBurnedAddresses) ? nextBurnedAddresses : [];
  const nextCountsLoadedFlag = nextCountsLoaded === true;
  const sameHoldersKey =
    !!nextHoldersMetaKey && !!prev.holdersMetaKey && String(prev.holdersMetaKey) === String(nextHoldersMetaKey);
  const prevNetHolders = computeSbtPageNetHoldersList(prevMinted, prevBurned);
  const nextNetHolders = computeSbtPageNetHoldersList(nextMinted, nextBurned);
  const hasResolvedReplacement = nextCountsLoadedFlag && nextNetHolders.length > 0;
  const shouldPreserveExisting = sameHoldersKey && prevNetHolders.length > 0 && !hasResolvedReplacement;
  const shouldManageVisibleRows =
    prev.showModal === true ||
    prev.mintingAddressesFilterInitialized === true ||
    (Array.isArray(prev.filteredMintedUsers) && prev.filteredMintedUsers.length > 0);
  const resolveNextRows =
    typeof buildNextFilteredHolderRows === 'function'
      ? buildNextFilteredHolderRows
      : buildSbtPageNextFilteredHolderRows;
  const resolveSignature =
    typeof buildAddressListSignature === 'function' ? buildAddressListSignature : buildSbtPageHolderListSignature;

  let mintedAddresses = nextMinted;
  let burnedAddresses = nextBurned;
  let filteredMintedUsers: unknown[] = Array.isArray(prev.filteredMintedUsers) ? prev.filteredMintedUsers : [];

  if (shouldPreserveExisting) {
    const merged = mergeSbtPageBurnEvidenceIntoPreservedHolderState(prevMinted, prevBurned, nextMinted, nextBurned);
    mintedAddresses = merged.mintedAddresses;
    burnedAddresses = merged.burnedAddresses;
    if (shouldManageVisibleRows && merged.burnDiscovered) {
      const nextVisibleHolders = computeSbtPageNetHoldersList(mintedAddresses, burnedAddresses);
      const nextRows = resolveNextRows({
        prevFilteredRows: filteredMintedUsers,
        prevNetHolders,
        nextNetHolders: nextVisibleHolders,
        replaceRows: false,
      });
      filteredMintedUsers = Array.isArray(nextRows) ? nextRows : [];
    }
  } else if (shouldManageVisibleRows) {
    const nextRows = resolveNextRows({
      prevFilteredRows: filteredMintedUsers,
      prevNetHolders,
      nextNetHolders,
      replaceRows: true,
    });
    filteredMintedUsers = Array.isArray(nextRows) ? nextRows : [];
  }

  const effectiveNetCounts = computeSbtPageNetCounts(mintedAddresses, burnedAddresses);
  const prevMintedTokensOverride = sanitizeSbtPageMintedTokensOverride(prev.mintedTokensOverride);
  const incomingMintedTokensOverride = sanitizeSbtPageMintedTokensOverride(nextMintedTokensOverride);
  const userKey = String(userLower || '').toLowerCase();
  const shouldKeepPrevApproximation = !nextCountsLoadedFlag || nextNetHolders.length > 0;
  const signature = shouldManageVisibleRows
    ? String(resolveSignature(filteredMintedUsers) || '')
    : typeof prev.filteredMintedUsersSignature === 'string'
      ? prev.filteredMintedUsersSignature
      : String(resolveSignature(filteredMintedUsers) || '');

  return {
    mintedAddresses,
    burnedAddresses,
    countsLoaded: shouldPreserveExisting ? prev.countsLoaded === true || nextCountsLoadedFlag : nextCountsLoadedFlag,
    mintedTokensOverride: shouldPreserveExisting
      ? incomingMintedTokensOverride != null
        ? incomingMintedTokensOverride
        : prevMintedTokensOverride
      : incomingMintedTokensOverride != null
        ? incomingMintedTokensOverride
        : shouldKeepPrevApproximation
          ? prevMintedTokensOverride
          : null,
    userHasSBT: userKey ? (effectiveNetCounts.get(userKey) || 0) > 0 : false,
    filteredMintedUsers,
    filteredMintedUsersSignature: signature,
  };
};
