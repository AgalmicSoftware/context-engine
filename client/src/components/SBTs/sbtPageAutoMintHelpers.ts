type SbtPageAutoMintAddressPropsLike = Record<string, unknown> & {
  SBTAddress?: unknown;
  loginComplete?: unknown;
  network?: { id?: unknown } | null;
  networkChainId?: unknown;
  sessionSlug?: unknown;
};
type SbtPageAutoMintAddressInfo = {
  lower: string;
  original: unknown;
};
type SbtPageSessionStorageLike = {
  getItem?: (key: string) => string | null;
};
type SbtPageUrlAutoMintState = {
  mintingStatus?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPagePropPasswordAutoMintArgs = {
  autoMintingMode?: unknown;
  mintingStatus?: unknown;
  sbtInfo?: unknown;
  sbtMintPassword?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPagePropListAutoMintArgs = {
  autoMintingMode?: unknown;
  hasAttemptedListMint?: unknown;
  loginComplete?: unknown;
  sbtMintPassword?: unknown;
};
type ResolveSbtPageUrlAutoMintIntentArgs = {
  chainId?: unknown;
  propsIn?: SbtPageAutoMintAddressPropsLike | null;
  searchRaw?: unknown;
  sessionSlug?: unknown;
  sessionStorageRef?: SbtPageSessionStorageLike | null;
  state?: SbtPageUrlAutoMintState | null;
  windowSearch?: unknown;
};
type DecodeSbtPageInviteInput = (normalizedInviteCode: string) => Record<string, unknown> | null | undefined;

export type AutoMintPair = {
  auto: boolean;
  gp: string | null;
  inv: string | null;
  sbt: string | null;
};
export type AutoMintPairsResult = {
  globalAuto: boolean;
  pairs: AutoMintPair[];
};
export type SbtPageDecodedInviteInput = Record<string, unknown> & {
  inviteCode: string;
  nonce?: unknown;
  signature?: unknown;
};
export type SbtPageUrlAutoMintIntent = {
  autoKey: string | null;
  currentSbtAddress: unknown;
  shouldAttemptAuto: boolean;
  targetCode: string | null;
  targetInvite: string | null;
  targetPassword: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const resolveSbtPageAutoMintAddress = (input: unknown): unknown | null => {
  if (Array.isArray(input)) {
    const found = input.find((entry) => isRecord(entry) && entry.sbtAddress !== undefined);
    return found ? found.sbtAddress : null;
  }
  if (isRecord(input) && input.sbtAddress !== undefined) return input.sbtAddress;
  return input || null;
};

const getSbtPageAutoMintAddressInfo = (propsIn: SbtPageAutoMintAddressPropsLike = {}): SbtPageAutoMintAddressInfo => {
  const original = resolveSbtPageAutoMintAddress(propsIn.SBTAddress) || '';
  return {
    original,
    lower: String(original || '').toLowerCase(),
  };
};

const normalizeAutoMintScopePart = (value: unknown, fallback: string): string => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized || fallback;
};

export const buildSbtPageAutoMintStorageKey = ({
  chainId = '',
  sbtAddress = '',
  sessionSlug = '',
}: {
  chainId?: unknown;
  sbtAddress?: unknown;
  sessionSlug?: unknown;
} = {}): string | null => {
  const address = String(sbtAddress || '')
    .trim()
    .toLowerCase();
  if (!address) return null;
  return [
    'autoMint',
    normalizeAutoMintScopePart(chainId, 'unknown-chain'),
    normalizeAutoMintScopePart(sessionSlug, 'general'),
    address,
    'success',
  ].join(':');
};

export const sanitizeSbtPageMintedTokensOverride = (value: unknown): string | null => {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
  return String(parsed);
};

export const normalizeSbtInviteCode = (raw: unknown): string => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('inv:')) return trimmed.slice(4).trim();
  if (lower.startsWith('invite:')) return trimmed.slice(7).trim();
  return trimmed;
};

const legacySbtRouteCredentialMemory = new Map<string, string>();

const getLegacySbtRouteCredentialKey = (sbtAddress: unknown): string =>
  String(sbtAddress || '')
    .trim()
    .toLowerCase();

export const resolveLegacySbtRouteCredential = ({
  routeCredential = null,
  sbtAddress = '',
}: {
  routeCredential?: unknown;
  sbtAddress?: unknown;
} = {}): string | null => {
  const key = getLegacySbtRouteCredentialKey(sbtAddress);
  if (!key) return null;
  const credential = String(routeCredential || '').trim();
  if (credential) {
    legacySbtRouteCredentialMemory.set(key, credential);
    return credential;
  }
  return legacySbtRouteCredentialMemory.get(key) || null;
};

export const clearLegacySbtRouteCredential = (sbtAddress: unknown): void => {
  const key = getLegacySbtRouteCredentialKey(sbtAddress);
  if (key) legacySbtRouteCredentialMemory.delete(key);
};

export const buildLegacySbtRouteCredentialCleanPath = (hrefRaw: unknown = ''): string | null => {
  try {
    const url = new URL(String(hrefRaw || ''));
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const sbtRouteIndex = pathSegments.findIndex((segment) => segment === 'sbt' || segment === 'group');
    if (sbtRouteIndex < 0 || pathSegments.length <= sbtRouteIndex + 2) return null;
    const cleanSegments = pathSegments.slice(0, sbtRouteIndex + 2);
    const query = url.searchParams.toString();
    return `/${cleanSegments.join('/')}${query ? `?${query}` : ''}${url.hash || ''}`;
  } catch (_) {
    return null;
  }
};

export const decodeSbtPageInviteInput = (
  raw: unknown,
  decodeInvite: DecodeSbtPageInviteInput,
): SbtPageDecodedInviteInput | null => {
  const normalized = normalizeSbtInviteCode(raw);
  if (!normalized || typeof decodeInvite !== 'function') return null;
  const payload = decodeInvite(normalized);
  if (!payload) return null;
  return { ...payload, inviteCode: normalized };
};

export const hasSbtPageAutoMintFlag = (searchRaw: unknown = ''): boolean => {
  try {
    const qs = String(searchRaw || '').replace(/^\?/, '');
    const params = new URLSearchParams(qs);
    if (params.get('auto') === '1') return true;
    for (const key of params.keys()) {
      if (/^auto\d+$/.test(key) && params.get(key) === '1') return true;
    }
    return false;
  } catch (_) {
    return false;
  }
};

export const buildSbtPageAutoMintCleanPath = (hrefRaw: unknown = ''): string | null => {
  try {
    const url = new URL(String(hrefRaw || ''));
    const params = url.searchParams;
    const hasAutoFlag = hasSbtPageAutoMintFlag(params.toString());
    const hasCredential = Array.from(params.keys()).some((key) => /^(gp|inv|password)\d*$/.test(key.toLowerCase()));
    if (!hasAutoFlag && !hasCredential) return null;

    if (hasAutoFlag) {
      params.delete('auto');
      params.delete('sbt');
    }
    Array.from(params.keys()).forEach((key) => {
      if (/^(gp|inv|password)\d*$/.test(key.toLowerCase())) params.delete(key);
      if (hasAutoFlag && /^(sbt|auto)\d+$/.test(key.toLowerCase())) params.delete(key);
    });

    const qs = params.toString();
    return url.pathname + (qs ? `?${qs}` : '');
  } catch (_) {
    return null;
  }
};

export const clearSbtPageAutoMintUrlIntent = (onError?: (error: unknown) => void): void => {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const cleanUrl = buildSbtPageAutoMintCleanPath(window.location.href);
    if (cleanUrl) window.history.replaceState(null, '', cleanUrl);
  } catch (error) {
    onError?.(error);
  }
};

export const collectAutoMintPairsFromSearchParams = (
  searchParams: URLSearchParams | string | null = null,
): AutoMintPairsResult => {
  const sp = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const globalAuto = sp.get('auto') === '1';
  const pairs: AutoMintPair[] = [];

  if (sp.has('sbt')) {
    pairs.push({
      sbt: sp.get('sbt'),
      gp: sp.get('gp'),
      inv: sp.get('inv'),
      auto: globalAuto,
    });
  }

  for (const key of sp.keys()) {
    const match = key.match(/^sbt(\d+)$/);
    if (!match) continue;
    const idx = match[1];
    const sbtVal = sp.get(key);
    if (!sbtVal) continue;
    pairs.push({
      sbt: sbtVal,
      gp: sp.get(`gp${idx}`),
      inv: sp.get(`inv${idx}`),
      auto: globalAuto || sp.get(`auto${idx}`) === '1',
    });
  }

  return { pairs, globalAuto };
};

export const resolveSbtPageUrlAutoMintIntent = ({
  chainId = null,
  propsIn = {},
  searchRaw = null,
  sessionSlug = null,
  sessionStorageRef = null,
  state = {},
  windowSearch = '',
}: ResolveSbtPageUrlAutoMintIntentArgs = {}): SbtPageUrlAutoMintIntent | null => {
  const { original: currentSbtAddress, lower: currentSbtAddrLower } = getSbtPageAutoMintAddressInfo(propsIn || {});
  if (!currentSbtAddress) return null;

  const qs =
    typeof searchRaw === 'string' ? searchRaw.replace(/^\?/, '') : String(windowSearch || '').replace(/^\?/, '');
  if (!qs) return null;

  const sp = new URLSearchParams(qs);
  const { pairs, globalAuto } = collectAutoMintPairsFromSearchParams(sp);
  const matchedPair = pairs.find((pair) => (pair.sbt || '').toLowerCase() === currentSbtAddrLower);

  let targetInvite: string | null = null;
  let targetPassword: string | null = null;
  let shouldAutoMint = false;

  if (matchedPair) {
    targetInvite = matchedPair.inv || null;
    targetPassword = matchedPair.gp || null;
    shouldAutoMint = matchedPair.auto;
  } else if (pairs.length === 0) {
    const legacyInv = sp.get('inv');
    const legacyGp = sp.get('gp');
    if (legacyInv && !sp.has('sbt')) {
      targetInvite = legacyInv;
      shouldAutoMint = globalAuto;
    } else if (legacyGp && !sp.has('sbt')) {
      targetPassword = legacyGp;
      shouldAutoMint = globalAuto;
    } else if (globalAuto) {
      shouldAutoMint = true;
    }
  }

  const targetCode = targetInvite || targetPassword;
  const resolvedChainId = chainId ?? propsIn?.network?.id ?? propsIn?.networkChainId ?? '';
  const resolvedSessionSlug = sessionSlug ?? propsIn?.sessionSlug ?? '';
  const autoKey = buildSbtPageAutoMintStorageKey({
    chainId: resolvedChainId,
    sessionSlug: resolvedSessionSlug,
    sbtAddress: currentSbtAddrLower,
  });
  const alreadyTried = !!(autoKey && sessionStorageRef?.getItem && sessionStorageRef.getItem(autoKey) === 'done');

  return {
    currentSbtAddress,
    targetInvite,
    targetPassword,
    targetCode,
    shouldAttemptAuto: Boolean(
      shouldAutoMint &&
      propsIn?.loginComplete &&
      !state?.userHasSBT &&
      state?.mintingStatus === 'idle' &&
      !alreadyTried,
    ),
    autoKey,
  };
};

export const createSbtPageAutoMintIntentRuntime = () => {
  let rememberedSearch = '';
  return {
    clear: (sbtAddress: unknown): void => {
      rememberedSearch = '';
      clearLegacySbtRouteCredential(sbtAddress);
    },
    resolve: ({
      searchRaw = null,
      windowSearch = '',
      ...input
    }: ResolveSbtPageUrlAutoMintIntentArgs = {}): SbtPageUrlAutoMintIntent | null => {
      const browserSearch = String(windowSearch || '');
      const effectiveSearch =
        typeof searchRaw === 'string'
          ? searchRaw
          : hasSbtPageAutoMintFlag(browserSearch)
            ? browserSearch
            : rememberedSearch || browserSearch;
      const intent = resolveSbtPageUrlAutoMintIntent({
        ...input,
        searchRaw: effectiveSearch,
        windowSearch: '',
      });
      if (intent && hasSbtPageAutoMintFlag(effectiveSearch)) rememberedSearch = effectiveSearch;
      return intent;
    },
  };
};

export const shouldRunSbtPagePropPasswordAutoMint = ({
  autoMintingMode = false,
  mintingStatus = '',
  sbtInfo = null,
  sbtMintPassword = null,
  userHasSBT = false,
}: ResolveSbtPagePropPasswordAutoMintArgs = {}): boolean =>
  !!autoMintingMode && typeof sbtMintPassword === 'string' && !userHasSBT && mintingStatus === 'idle' && !!sbtInfo;

export const shouldRunSbtPagePropListAutoMint = ({
  autoMintingMode = false,
  hasAttemptedListMint = false,
  loginComplete = false,
  sbtMintPassword = null,
}: ResolveSbtPagePropListAutoMintArgs = {}): boolean =>
  !!loginComplete && !!autoMintingMode && Array.isArray(sbtMintPassword) && !hasAttemptedListMint;
