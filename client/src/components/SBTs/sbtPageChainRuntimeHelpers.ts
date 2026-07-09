type BlockExplorerNetworkLike = Record<string, unknown> & {
  blockExplorers?: {
    default?: {
      url?: string;
    };
  };
};
type SbtPageChainIdNetworkLike = {
  id?: unknown;
};
type SbtPageSessionChainIdReader = (slug: string) => unknown;
type SbtPageBlockTimeReader = (chainId: unknown) => number;
type ResolveSbtPageActiveChainIdArgs = {
  getSessionChainId?: SbtPageSessionChainIdReader;
  propNetwork?: SbtPageChainIdNetworkLike | null;
  sbtInfo?: Record<string, unknown> | null;
  sessionSlug?: unknown;
  stateNetwork?: SbtPageChainIdNetworkLike | null;
};
type ResolveSbtPageRecoveryCacheChainIdArgs = ResolveSbtPageActiveChainIdArgs & {
  propSBTAddress?: unknown;
};
type ResolveSbtPageActiveBlockTimeMsArgs = {
  activeChainId?: unknown;
  getChainBlockTimeMs?: SbtPageBlockTimeReader;
  multiplier?: unknown;
};
type BuildSbtPageClaimCountdownTickPatchArgs = {
  remainingMs?: unknown;
};
type BuildSbtPageClaimCountdownCompletePatchArgs = {
  waitMs?: unknown;
};

const isSbtPageChainRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readSbtPagePositiveNumber = (value: unknown): number | null => {
  const n = Number(value || 0);
  return n > 0 ? n : null;
};

export const getBlockExplorerBaseUrl = (network: unknown): string => {
  const networkRecord = isSbtPageChainRecord(network) ? (network as BlockExplorerNetworkLike) : null;
  return String(networkRecord?.blockExplorers?.default?.url || '').replace(/\/+$/, '');
};

export const buildSbtPageExplorerUrl = ({
  network = null,
  value = '',
  kind = 'address',
  fallbackBaseUrl = 'https://sepolia.etherscan.io',
}: {
  network?: unknown;
  value?: unknown;
  kind?: 'address' | 'tx';
  fallbackBaseUrl?: string;
} = {}): string => {
  const baseUrl = getBlockExplorerBaseUrl(network) || fallbackBaseUrl;
  const path = kind === 'tx' ? 'tx' : 'address';
  return `${baseUrl}/${path}/${value}`;
};

export const buildSbtPageDetailsPayload = ({
  sbtInfo = {},
  address = '',
}: {
  sbtInfo?: unknown;
  address?: unknown;
} = {}): Record<string, unknown> => ({
  ...Object(sbtInfo || {}),
  address,
});

export const resolveSbtChainId = (input: unknown): number | null => {
  const readChainId = (value: unknown): number | null => {
    const record = isSbtPageChainRecord(value) ? value : {};
    const chainId = Number(record.chainId || record.chainID || 0);
    return chainId > 0 ? chainId : null;
  };

  if (Array.isArray(input)) {
    const found = input.find((entry) => readChainId(entry));
    return readChainId(found);
  }

  if (isSbtPageChainRecord(input)) {
    return readChainId(input);
  }

  return null;
};

export const resolveSbtPageActiveChainId = ({
  getSessionChainId,
  propNetwork = null,
  sbtInfo = null,
  sessionSlug = '',
  stateNetwork = null,
}: ResolveSbtPageActiveChainIdArgs = {}): number | null => {
  const networkChainId = readSbtPagePositiveNumber(stateNetwork?.id || propNetwork?.id);
  if (networkChainId) return networkChainId;

  const info = isSbtPageChainRecord(sbtInfo) ? sbtInfo : {};
  const sbtChainId = readSbtPagePositiveNumber(info.chainID || info.chainId);
  if (sbtChainId) return sbtChainId;

  const sessionChainId = readSbtPagePositiveNumber(
    typeof getSessionChainId === 'function' ? getSessionChainId(String(sessionSlug || '')) : null,
  );
  return sessionChainId || null;
};

export const resolveSbtPageRecoveryCacheChainId = ({
  getSessionChainId,
  propNetwork = null,
  propSBTAddress = null,
  sbtInfo = null,
  sessionSlug = '',
  stateNetwork = null,
}: ResolveSbtPageRecoveryCacheChainIdArgs = {}): number | null => {
  const info = isSbtPageChainRecord(sbtInfo) ? sbtInfo : {};
  const sbtChainId = readSbtPagePositiveNumber(info.chainID || info.chainId);
  if (sbtChainId) return sbtChainId;

  const propChainId = resolveSbtChainId(propSBTAddress);
  if ((propChainId ?? 0) > 0) return propChainId;

  const sessionChainId = readSbtPagePositiveNumber(
    typeof getSessionChainId === 'function' ? getSessionChainId(String(sessionSlug || '')) : null,
  );
  if (sessionChainId) return sessionChainId;

  const networkChainId = readSbtPagePositiveNumber(stateNetwork?.id || propNetwork?.id);
  return networkChainId || null;
};

export const resolveSbtPageActiveBlockTimeMs = ({
  activeChainId = null,
  getChainBlockTimeMs,
  multiplier = 1,
}: ResolveSbtPageActiveBlockTimeMsArgs = {}): number => {
  const factor = Number(multiplier || 1);
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const blockTimeMs = typeof getChainBlockTimeMs === 'function' ? getChainBlockTimeMs(activeChainId) : 0;
  return Math.round(blockTimeMs * safeFactor);
};

export const resolveSbtPageCountdownDisplaySeconds = (remainingMs: unknown): number =>
  Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));

export const buildSbtPageClaimCountdownTickPatch = ({
  remainingMs = 0,
}: BuildSbtPageClaimCountdownTickPatchArgs = {}): Record<string, unknown> => ({
  claimCountdown: resolveSbtPageCountdownDisplaySeconds(remainingMs),
});

export const buildSbtPageClaimCountdownCompletePatch = ({
  waitMs = 0,
}: BuildSbtPageClaimCountdownCompletePatchArgs = {}): Record<string, unknown> => ({
  mintStep: 2,
  claimCountdown: resolveSbtPageCountdownDisplaySeconds(waitMs),
});
