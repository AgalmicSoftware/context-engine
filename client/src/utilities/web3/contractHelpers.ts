/*
 * @module contractHelpers
 * @description Read-only provider helpers and shared contract utility methods extracted from contractScripts.
 *              Keeps RPC/block-window logic isolated from session, survey, and SBT domain methods.
 *
 * Key exports: createContractHelperMethods
 */

import { ethers, utils } from 'ethers';
import { resolveContractBlockWithCache } from '../cache/contractBlockCache.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import {
  clearSponsoredBootstrapFaucetGrantToken,
  readSponsoredBootstrapFundingContext,
} from '../session/sponsoredBootstrapFunding.js';
import { extractChainId } from './chainIdResolution.js';

type SessionConfigLike = {
  slug?: string;
  chainId?: number | string | null;
  networkChainId?: number | string | null;
  registryChainId?: number | string | null;
  sessionId?: string | null;
  contracts?: {
    surveys?: {
      chainId?: number | string | null;
      address?: string | null;
      [key: string]: unknown;
    };
    sbtFactory?: {
      chainId?: number | string | null;
      address?: string | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  blockLimits?: {
    start?: unknown;
    end?: unknown;
    [key: string]: unknown;
  };
  __registry?: {
    chainId?: number | string | null;
    registryChainId?: number | string | null;
    sessionId?: string | null;
    sessionIdHex?: string | null;
    [key: string]: unknown;
  };
  __forceLatestBlock?: boolean;
  [key: string]: unknown;
};

type GroupKeyOrCfg = SessionConfigLike | string | null | undefined;

type RpcMetaLike = {
  preferredUrls?: Array<string | null | undefined>;
  providerMode?: string | null;
  providerLabel?: string | null;
  skipGlobalPreferred?: boolean;
  [key: string]: unknown;
};

type ReadProviderLike = {
  getBlockNumber?: () => Promise<number>;
  getGasPrice?: () => Promise<ethers.BigNumber>;
  getBlock?: (blockNumber: number | string) => Promise<ethers.providers.Block>;
  getLogs?: (filter: ethers.providers.Filter) => Promise<ethers.providers.Log[]>;
  getBalance?: (address: string) => Promise<ethers.BigNumber>;
  __CE_RPC_META?: RpcMetaLike;
  [key: string]: unknown;
};

type AsyncCacheSlot<T> = {
  value: T | null;
  promise: Promise<T> | null;
  ts: number;
};

type LatestBlockCache = Map<string, { block: number; timestamp: number }> & {
  value?: number | null;
  promise?: Promise<number> | null;
  ts?: number;
  _map?: Record<string, AsyncCacheSlot<number>>;
  [key: string]: unknown;
};

type GasPriceCache = Map<string, ethers.BigNumber> & {
  value?: ethers.BigNumber | null;
  promise?: Promise<ethers.BigNumber> | null;
  ts?: number;
  _map?: Record<string, AsyncCacheSlot<ethers.BigNumber>>;
  [key: string]: unknown;
};

type ContractsLogger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type FundingError = Error & {
  stage?: string;
  status?: number;
  reason?: unknown;
  details?: unknown;
};

type ScopeDecisionLike = {
  allowed?: boolean;
  [key: string]: unknown;
};

type RequestContext = {
  account?: string;
  providerLike?: string;
  chainId?: number | string | null;
  networkChainId?: number | string | null;
  [key: string]: unknown;
};

type SendTestnetFundsOptions = {
  context?: RequestContext | null;
  amountEth?: string | number | null;
  amount?: string | number | null;
  sbtAddress?: string | null;
  hashedPassword?: string | null;
  groupPasswordHash?: string | null;
  signature?: string | null;
  [key: string]: unknown;
};

type LatestBlockOptions = {
  contractKey?: string | null;
  force?: boolean;
  _resolvedCfg?: unknown;
  [key: string]: unknown;
};

type RelevantBlockWindowOptions = {
  contractKey?: string | null;
  __forceLatestBlock?: boolean;
  _resolvedCfg?: unknown;
  [key: string]: unknown;
};

type ProviderScopeCacheKeyArgs = {
  provider?: ReadProviderLike | null;
  groupKeyOrCfg?: GroupKeyOrCfg;
  chainId?: number | string | null;
  contractKey?: string;
};

type BlockWindow = {
  fromBlock: number;
  toBlock: number;
};

type FaucetRequestBody = {
  action: 'request_test_eth';
  to: string;
  [key: string]: unknown;
};

type StoreState = {
  profile?: {
    account?: string;
    provider?: string;
    network?: {
      id?: number | string | null;
      chainId?: number | string | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  sessionState?: {
    activeSessionSlug?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type StoreLike = {
  getState?: () => StoreState;
  [key: string]: unknown;
};

type ContractHelperDeps = {
  resolveSession: (groupKeyOrCfg: GroupKeyOrCfg) => SessionConfigLike;
  latestBlockCache: LatestBlockCache;
  gasPriceCache: GasPriceCache;
  BLOCK_CACHE_MS: number;
  getReadProviderForGroup: (groupKeyOrCfg: GroupKeyOrCfg, opts?: { contractKey?: string }) => ReadProviderLike;
  shouldLog: (category: string, level?: string) => boolean;
  rpcLog: (...args: unknown[]) => void;
  callWithRetry: <T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>,
  ) => Promise<T>;
  MAX_CACHE_SIZE: number;
  isLogsRangeTooLargeError: (error: unknown) => boolean;
  contractsLog: ContractsLogger;
  getReadProviderForChain: ((chainId: number | string | undefined) => ReadProviderLike) | null | undefined;
  normalizeSessionSlug: (slug: string) => string;
  shouldBypassSessionScopeWindow: (groupKeyOrCfg: GroupKeyOrCfg, cfg: SessionConfigLike | null | undefined) => boolean;
  getScopeDecisionForSlug: (slug: string) => ScopeDecisionLike;
  logScopeWindowSkipOnce: (decision: ScopeDecisionLike) => void;
  parsePositiveBlockNumber: (value: unknown) => number | null | undefined;
  resolveSessionStartFromRegistry: (args: {
    cfg: SessionConfigLike | null | undefined;
    slug: string;
  }) => Promise<number | null | undefined>;
  DEFAULT_CHAIN_ID: number;
  store: StoreLike;
  getSessionConfigBySlug: (slug: string) => SessionConfigLike | null | undefined;
  refreshSessionRegistryFieldsCache?:
    | ((args: {
        chainId?: number | string | null;
        slug?: string | null;
        sessionId?: string | null;
        providerLike?: unknown;
        fieldKeys?: string[];
        bootstrapRpc?: boolean;
      }) => Promise<SessionConfigLike | null | undefined>)
    | null;
  getCorsProxyUrlOrThrow: (args: {
    sessionConfig?: SessionConfigLike | null;
    sessionSlug?: string;
    context?: RequestContext;
    allowDemoFallback?: boolean;
  }) => Promise<string>;
  fetchWorkerWithAuth: (
    url: string,
    init?: RequestInit,
    opts?: {
      sessionSlug?: string;
      context?: RequestContext;
      workerUrl?: string;
      allowDemoFallback?: boolean;
    },
  ) => Promise<Response>;
  fetchImpl?: typeof fetch;
};

type ContractHelperMethods = {
  getLatestBlockNumber: (
    providerName?: string,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: LatestBlockOptions | null,
  ) => Promise<number>;
  getGasPrice: (groupKeyOrCfg?: GroupKeyOrCfg) => Promise<ethers.BigNumber>;
  getBlockWithCaching: (
    this: ContractHelperMethods,
    providerPassedIn: { getBlock: (blockNumber: number | string) => Promise<ethers.providers.Block> },
    blockNumber: number | string,
    providerName?: string,
    chainKey?: string,
  ) => Promise<ethers.providers.Block>;
  fetchLogsSmart: (
    this: ContractHelperMethods,
    filter: ethers.providers.Filter,
    fromBlock: number,
    toBlock: number,
    depth?: number,
    maxDepth?: number,
    groupKeyOrCfg?: GroupKeyOrCfg,
  ) => Promise<ethers.providers.Log[]>;
  getNativeBalance: (address: string, groupKeyOrCfg?: GroupKeyOrCfg) => Promise<ethers.BigNumber>;
  getRelevantBlockWindowForFilter: (
    this: ContractHelperMethods,
    groupKeyOrCfg: GroupKeyOrCfg,
    opts?: RelevantBlockWindowOptions | null,
  ) => Promise<BlockWindow>;
  sendTestnetFunds: (
    recipientAddress: string,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: SendTestnetFundsOptions | null,
  ) => Promise<Record<string, unknown>>;
  getGasPriceToDisplay: (this: ContractHelperMethods, groupKeyOrCfg?: GroupKeyOrCfg) => Promise<string>;
};

const normalizeFundingErrorMessage = (error: unknown): string =>
  String((error as FundingError)?.message || error || '')
    .trim()
    .toLowerCase();

const createFundingError = (message: string, extra: Partial<FundingError> = {}): FundingError =>
  Object.assign(new Error(message), extra);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asSessionConfigLike = (value: unknown): SessionConfigLike | null =>
  isRecord(value) ? (value as SessionConfigLike) : null;

const readJsonRecord = async (response: Response): Promise<Record<string, unknown>> => {
  const value = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
};

const isMissingLocalFaucetKeyFundingError = (error: unknown): boolean => {
  const fundingError = error as FundingError;
  const stage = String(fundingError?.stage || '')
    .trim()
    .toLowerCase();
  const status = Number(fundingError?.status || 0);
  const message = normalizeFundingErrorMessage(error);
  return stage === 'faucet-request' && status === 401 && message.includes('faucetprivatekey is missing');
};

const isRetryableSponsoredBootstrapFundingError = (error: unknown): boolean => {
  const fundingError = error as FundingError;
  const stage = String(fundingError?.stage || '')
    .trim()
    .toLowerCase();
  const status = Number(fundingError?.status || 0);
  if (status === 404) return true;

  const message = normalizeFundingErrorMessage(error);
  if (isMissingLocalFaucetKeyFundingError(error)) return true;
  if (stage === 'worker-url-resolution') {
    return (
      message.includes('worker url unavailable') ||
      message.includes('worker url is not configured') ||
      message.includes('not deployable yet')
    );
  }
  return (
    message.includes('worker url unavailable') ||
    message.includes('worker url is not configured') ||
    message.includes('not deployable yet') ||
    message.includes('session not found') ||
    message.includes('faucetprivatekey is missing')
  );
};

const isRetryableWorkerUrlResolutionFundingError = (error: unknown): boolean => {
  const fundingError = error as FundingError;
  const stage = String(fundingError?.stage || '')
    .trim()
    .toLowerCase();
  if (stage !== 'worker-url-resolution') return false;
  const message = normalizeFundingErrorMessage(error);
  return (
    message.includes('worker url unavailable') ||
    message.includes('worker url is not configured') ||
    message.includes('not deployable yet')
  );
};

export function createContractHelperMethods(deps: ContractHelperDeps): ContractHelperMethods {
  const {
    resolveSession,
    latestBlockCache,
    gasPriceCache,
    BLOCK_CACHE_MS,
    getReadProviderForGroup,
    shouldLog,
    rpcLog,
    callWithRetry,
    MAX_CACHE_SIZE,
    isLogsRangeTooLargeError,
    contractsLog,
    getReadProviderForChain,
    normalizeSessionSlug,
    shouldBypassSessionScopeWindow,
    getScopeDecisionForSlug,
    logScopeWindowSkipOnce,
    parsePositiveBlockNumber,
    resolveSessionStartFromRegistry,
    DEFAULT_CHAIN_ID,
    store,
    getSessionConfigBySlug,
    refreshSessionRegistryFieldsCache = null,
    getCorsProxyUrlOrThrow,
    fetchWorkerWithAuth,
    fetchImpl = (...args: Parameters<typeof fetch>) => fetch(...args),
  } = deps;

  void DEFAULT_CHAIN_ID;
  void getReadProviderForChain;

  const resolveChainIdForRead = (cfg: SessionConfigLike | null | undefined, contractKey: string = ''): number =>
    extractChainId(cfg, { contractKey, strict: true });

  const buildProviderScopeCacheKey = ({
    provider,
    groupKeyOrCfg,
    chainId,
    contractKey = '',
  }: ProviderScopeCacheKeyArgs = {}): string => {
    const providerMeta = provider && typeof provider === 'object' ? provider.__CE_RPC_META : null;
    const preferredUrls = Array.isArray(providerMeta?.preferredUrls)
      ? providerMeta.preferredUrls
          .map((url: string | null | undefined) => String(url || '').trim())
          .filter((url: string) => Boolean(url))
          .join(',')
      : '';
    const fallbackGroupKey = ((): string => {
      if (typeof groupKeyOrCfg === 'string') {
        const str = String(groupKeyOrCfg || '').trim();
        return str || 'general';
      }
      if (groupKeyOrCfg && typeof groupKeyOrCfg === 'object') {
        const str = String(groupKeyOrCfg.slug || '').trim();
        return str || 'general';
      }
      return 'general';
    })();
    return [
      String(chainId || 'default'),
      String(contractKey || 'default').trim() || 'default',
      String(providerMeta?.providerMode || 'mode-default').trim() || 'mode-default',
      String(providerMeta?.providerLabel || 'provider-default').trim() || 'provider-default',
      preferredUrls || `group:${fallbackGroupKey}`,
      providerMeta?.skipGlobalPreferred ? 'skip-global' : 'with-global',
    ].join('|');
  };

  const methods: ContractHelperMethods = {
    async getLatestBlockNumber(
      providerName: string = 'none',
      groupKeyOrCfg: GroupKeyOrCfg = null,
      opts: LatestBlockOptions | null = null,
    ): Promise<number> {
      void providerName;
      const cfg =
        asSessionConfigLike(opts?._resolvedCfg) || resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const contractKey = String(opts?.contractKey || '').trim();
      const chId = resolveChainIdForRead(cfg, contractKey);
      const force = !!(opts && opts.force === true);
      const provider = getReadProviderForGroup(
        groupKeyOrCfg,
        contractKey ? { contractKey } : undefined,
      ) as ReadProviderLike;

      const key = buildProviderScopeCacheKey({
        provider,
        groupKeyOrCfg,
        chainId: chId,
        contractKey,
      });
      const cacheMap = latestBlockCache._map || (latestBlockCache._map = {});
      const slot = cacheMap[key] || (cacheMap[key] = { value: null, promise: null, ts: 0 });

      const now = Date.now();
      if (!force && now - slot.ts < BLOCK_CACHE_MS && slot.value !== null) {
        return slot.value;
      }

      if (slot.promise) return slot.promise;

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getLatestBlockNumber',
          chainId: chId || null,
          groupKeyOrCfg,
          note: 'cached getBlockNumber()',
        });
      }

      if (!provider || typeof provider.getBlockNumber !== 'function') {
        throw new Error('getLatestBlockNumber: Cannot obtain a valid provider with getBlockNumber method.');
      }

      const groupKey =
        (typeof groupKeyOrCfg === 'string' && groupKeyOrCfg) ||
        (groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg.slug) ||
        null;
      slot.promise = callWithRetry(() => provider.getBlockNumber!(), 'getBlockNumber', {
        op: 'getBlockNumber',
        chainId: chId || null,
        groupKey,
      });

      return slot.promise
        .then((bn: number) => {
          slot.value = bn;
          slot.promise = null;
          slot.ts = Date.now();
          return bn;
        })
        .catch((error: unknown) => {
          const prev = slot.value;
          slot.promise = null;
          if (prev !== null && prev !== undefined) {
            slot.ts = Date.now();
            return prev;
          }
          slot.value = null;
          slot.ts = 0;
          throw error;
        });
    },

    async getGasPrice(groupKeyOrCfg: GroupKeyOrCfg = null): Promise<ethers.BigNumber> {
      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = resolveChainIdForRead(cfg, '');
      const provider = getReadProviderForGroup(groupKeyOrCfg) as ReadProviderLike;

      const key = buildProviderScopeCacheKey({
        provider,
        groupKeyOrCfg,
        chainId: chId,
      });
      const cacheMap = gasPriceCache._map || (gasPriceCache._map = {});
      const slot = cacheMap[key] || (cacheMap[key] = { value: null, promise: null, ts: 0 });

      const now = Date.now();
      if (now - slot.ts < BLOCK_CACHE_MS && slot.value !== null) {
        return slot.value;
      }

      if (slot.promise) return slot.promise;

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getGasPrice',
          chainId: chId || null,
          groupKeyOrCfg,
          note: 'cached getGasPrice()',
        });
      }

      const groupKey =
        (typeof groupKeyOrCfg === 'string' && groupKeyOrCfg) ||
        (groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg.slug) ||
        null;
      slot.promise = callWithRetry(() => provider.getGasPrice!(), 'getGasPrice', {
        op: 'getGasPrice',
        chainId: chId || null,
        groupKey,
      })
        .then((bn: ethers.BigNumber) => {
          slot.value = bn;
          slot.promise = null;
          slot.ts = Date.now();
          return bn;
        })
        .catch((error: unknown) => {
          slot.value = null;
          slot.promise = null;
          slot.ts = 0;
          throw error;
        });

      return slot.promise;
    },

    async getBlockWithCaching(
      this: ContractHelperMethods,
      providerPassedIn: { getBlock: (blockNumber: number | string) => Promise<ethers.providers.Block> },
      blockNumber: number | string,
      providerName: string = 'none',
      chainKey: string = 'default',
    ): Promise<ethers.providers.Block> {
      void providerName;
      const blockCache = this._blockCache!;
      const key = `${String(chainKey)}_${String(blockNumber)}`;
      if (blockCache[key] && Date.now() - blockCache[key].timestamp < BLOCK_CACHE_MS) {
        return blockCache[key].block;
      }

      const block = await callWithRetry(() => providerPassedIn.getBlock(blockNumber), `getBlock(${blockNumber})`);
      const now = Date.now();
      Object.keys(blockCache).forEach((cacheKey: string) => {
        if (now - (blockCache[cacheKey]?.timestamp || 0) >= BLOCK_CACHE_MS) {
          delete blockCache[cacheKey];
        }
      });

      blockCache[key] = { block, timestamp: now };

      const keys = Object.keys(blockCache);
      if (keys.length > MAX_CACHE_SIZE) {
        keys.sort((a: string, b: string) => (blockCache[a]?.timestamp || 0) - (blockCache[b]?.timestamp || 0));
        for (let i = 0; i < keys.length - MAX_CACHE_SIZE; i += 1) {
          delete blockCache[keys[i]];
        }
      }
      return block;
    },

    async fetchLogsSmart(
      this: ContractHelperMethods,
      filter: ethers.providers.Filter,
      fromBlock: number,
      toBlock: number,
      depth: number = 0,
      maxDepth: number = 20,
      groupKeyOrCfg: GroupKeyOrCfg = '',
    ): Promise<ethers.providers.Log[]> {
      if (fromBlock > toBlock) return [];
      const rangeName = `logs[${fromBlock}-${toBlock}]`;
      const providerForLogs = getReadProviderForGroup(groupKeyOrCfg) as ReadProviderLike;

      try {
        return await callWithRetry(
          () => providerForLogs.getLogs!({ ...filter, fromBlock, toBlock }),
          `getLogs ${rangeName}`,
          {
            op: 'getLogs',
            fromBlock,
            toBlock,
            groupKey:
              (typeof groupKeyOrCfg === 'string' && groupKeyOrCfg) ||
              (groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg.slug) ||
              null,
          },
        );
      } catch (error: unknown) {
        if (isLogsRangeTooLargeError(error) && depth < maxDepth) {
          const mid = Math.floor((fromBlock + toBlock) / 2);
          const [left, right] = await Promise.all([
            this.fetchLogsSmart(filter, fromBlock, mid, depth + 1, maxDepth, groupKeyOrCfg),
            this.fetchLogsSmart(filter, mid + 1, toBlock, depth + 1, maxDepth, groupKeyOrCfg),
          ]);
          return [...left, ...right];
        }
        throw error;
      }
    },

    async getNativeBalance(address: string, groupKeyOrCfg: GroupKeyOrCfg = null): Promise<ethers.BigNumber> {
      if (!address || !ethers.utils.isAddress(address)) {
        contractsLog.warn('[getNativeBalance] invalid address supplied:', address);
        return ethers.BigNumber.from(0);
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, { strict: true });

      const provider = getReadProviderForGroup(groupKeyOrCfg) as ReadProviderLike;

      rpcLog('RPC Call:', {
        function: 'getNativeBalance',
        method: 'provider.getBalance',
        chainId: chId || null,
        groupKeyOrCfg,
        params: { address },
      });

      return callWithRetry(() => provider.getBalance!(address), 'provider.getBalance (getNativeBalance)');
    },

    async getRelevantBlockWindowForFilter(
      this: ContractHelperMethods,
      groupKeyOrCfg: GroupKeyOrCfg,
      opts: RelevantBlockWindowOptions | null = null,
    ): Promise<BlockWindow> {
      const cfg = asSessionConfigLike(opts?._resolvedCfg) || resolveSession(groupKeyOrCfg || '');
      const slug = normalizeSessionSlug(cfg?.slug || '');
      const contractKey = String(opts?.contractKey || '').trim();
      const forceLatestBlock = !!(
        (groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg.__forceLatestBlock === true) ||
        (opts && typeof opts === 'object' && opts.__forceLatestBlock === true)
      );
      const bypassScopeWindow = shouldBypassSessionScopeWindow(groupKeyOrCfg, cfg);
      if (!bypassScopeWindow) {
        const scopeDecision = getScopeDecisionForSlug(slug);
        if (!scopeDecision.allowed) {
          logScopeWindowSkipOnce(scopeDecision);
          return { fromBlock: 1, toBlock: 0 };
        }
      }

      const lim = cfg && cfg.blockLimits;
      const hasOwn = (obj: Record<string, unknown> | null | undefined, key: string): boolean =>
        !!obj && Object.prototype.hasOwnProperty.call(obj, key);
      const resolveRequiredStart = async (): Promise<number> => {
        const slugLabel = slug || 'general';
        const hasStartField = hasOwn(lim, 'start');
        const rawStart = hasStartField ? lim?.start : undefined;
        const rawStartNum = parsePositiveBlockNumber(rawStart);
        if (rawStartNum) return rawStartNum;

        const fallbackStart = await resolveSessionStartFromRegistry({ cfg, slug });
        if (fallbackStart) {
          try {
            if (cfg && typeof cfg === 'object') {
              cfg.blockLimits = {
                ...(cfg.blockLimits || {}),
                start: fallbackStart,
              };
            }
          } catch (e: unknown) {
            contractsLog.warn('contractHelpers: fallback', e);
          }
          contractsLog.warn('[blockLimits] Recovered missing blockLimits.start from SessionRegistry.SessionCreated.', {
            slug: slugLabel,
            chainId: extractChainId(cfg) || null,
            start: fallbackStart,
          });
          return fallbackStart;
        }

        throw new Error(
          `[blockLimits] Missing or invalid required blockLimits.start for session "${slugLabel}". ` +
            'Set a positive start block in SessionConfig.',
        );
      };

      const start = await resolveRequiredStart();

      try {
        const latest = await this.getLatestBlockNumber('none', groupKeyOrCfg, {
          ...(forceLatestBlock ? { force: true } : {}),
          ...(contractKey ? { contractKey } : {}),
          _resolvedCfg: cfg,
        });

        const end = lim && lim.end != null ? Number(lim.end) : null;

        let fromBlock = Math.max(0, Math.floor(start));
        let toBlock = end != null && Number.isFinite(end) ? Math.min(latest, Math.floor(end)) : latest;
        if (toBlock < fromBlock) toBlock = fromBlock;

        return { fromBlock, toBlock };
      } catch (error: any) {
        contractsLog.warn('[blockLimits] Failed to fetch latest block; falling back to start block only.', {
          slug: slug || 'general',
          start,
          error: error?.message || String(error),
        });
        return { fromBlock: start, toBlock: start };
      }
    },

    async sendTestnetFunds(
      recipientAddress: string,
      groupKeyOrCfg: GroupKeyOrCfg = null,
      opts: SendTestnetFundsOptions | null = null,
    ): Promise<Record<string, unknown>> {
      try {
        if (!recipientAddress || !ethers.utils.isAddress(recipientAddress)) {
          throw new Error('Invalid recipient address');
        }

        const activeSlug = ((): string => {
          try {
            const sessionState = store?.getState?.()?.sessionState || {};
            return sessionState?.activeSessionSlug || sessionState?.activeSessionSlug || '';
          } catch {
            return '';
          }
        })();
        const requestedSessionSlug = normalizeSessionSlug(
          typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : groupKeyOrCfg?.slug || activeSlug || '',
        );
        const cfg =
          typeof groupKeyOrCfg === 'object' && groupKeyOrCfg
            ? groupKeyOrCfg
            : getSessionConfigBySlug(requestedSessionSlug || '');
        const resolvedSessionSlug = normalizeSessionSlug(cfg?.slug || requestedSessionSlug || '');

        const requestOptions: SendTestnetFundsOptions = opts && typeof opts === 'object' ? opts : {};
        const contextOverride =
          requestOptions.context && typeof requestOptions.context === 'object' && !Array.isArray(requestOptions.context)
            ? requestOptions.context
            : {};
        const state = store?.getState?.() as StoreState | undefined;
        const profile = state?.profile || {};
        const network = profile.network || {};
        const overrideChainId = contextOverride.chainId ?? contextOverride.networkChainId ?? null;
        const sessionChainId = cfg?.networkChainId ?? cfg?.chainId ?? cfg?.registryChainId ?? null;
        const context: RequestContext = {
          account: contextOverride.account || profile.account || '',
          providerLike: contextOverride.providerLike || profile.provider || 'wagmi',
          chainId: overrideChainId || sessionChainId || network.id || network.chainId || null,
        };
        const requestBody: FaucetRequestBody = {
          action: 'request_test_eth',
          to: recipientAddress,
        };
        ['amountEth', 'amount', 'sbtAddress', 'hashedPassword', 'groupPasswordHash', 'signature'].forEach(
          (key: string) => {
            if (
              requestOptions[key] !== undefined &&
              requestOptions[key] !== null &&
              String(requestOptions[key]).trim() !== ''
            ) {
              requestBody[key] = requestOptions[key];
            }
          },
        );
        const requestWithWorker = async ({
          sessionSlug,
          sessionConfig,
          workerUrlOverride,
        }: {
          sessionSlug?: string | null;
          sessionConfig?: SessionConfigLike | null;
          workerUrlOverride?: string | null;
        } = {}): Promise<Record<string, unknown>> => {
          const resolvedSessionSlugForRequest = normalizeSessionSlug(sessionSlug || '');
          let corsWorkerUrl = workerUrlOverride || '';
          if (!corsWorkerUrl) {
            try {
              corsWorkerUrl = await getCorsProxyUrlOrThrow({
                sessionConfig,
                sessionSlug: resolvedSessionSlugForRequest,
                context,
                allowDemoFallback: defaultStrictAllowDemoFallback(),
              });
            } catch (error: any) {
              throw createFundingError(error?.message || 'Worker URL unavailable for requested session', {
                stage: 'worker-url-resolution',
              });
            }
          }
          const baseUrl = String(corsWorkerUrl || '').replace(/\/+$/, '');

          const res = await fetchWorkerWithAuth(
            baseUrl,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            },
            {
              sessionSlug: resolvedSessionSlugForRequest,
              context,
              workerUrl: baseUrl,
              allowDemoFallback: defaultStrictAllowDemoFallback(),
            },
          );

          const data = await readJsonRecord(res);
          if (!res.ok) {
            throw createFundingError(String(data?.error || `Faucet request failed (${res.status})`), {
              stage: 'faucet-request',
              status: Number(res.status || 0) || 0,
              reason: data?.reason || '',
              details: data?.details || null,
            });
          }
          return data;
        };
        const refreshSessionFieldsForFunding = async (): Promise<SessionConfigLike | null> => {
          if (!resolvedSessionSlug || typeof refreshSessionRegistryFieldsCache !== 'function') return null;
          const refreshChainId =
            sessionChainId ||
            cfg?.__registry?.registryChainId ||
            cfg?.__registry?.chainId ||
            cfg?.networkChainId ||
            context.chainId ||
            null;
          try {
            const refreshed = await refreshSessionRegistryFieldsCache({
              chainId: refreshChainId,
              slug: resolvedSessionSlug,
              sessionId: cfg?.sessionId || cfg?.__registry?.sessionId || cfg?.__registry?.sessionIdHex || null,
              providerLike: context.providerLike,
            });
            return refreshed || getSessionConfigBySlug(resolvedSessionSlug) || null;
          } catch (refreshError: any) {
            contractsLog.warn('[faucet] Failed to refresh session registry fields before funding retry.', {
              slug: resolvedSessionSlug,
              error: refreshError?.message || String(refreshError),
            });
            return null;
          }
        };
        const sponsoredBootstrapFundingContext = readSponsoredBootstrapFundingContext();
        const bootstrapSessionSlug = normalizeSessionSlug(sponsoredBootstrapFundingContext?.sessionSlug || '');
        const bootstrapWorkerUrl = sponsoredBootstrapFundingContext?.workerUrl || '';
        const bootstrapTargetSessionSlug = normalizeSessionSlug(
          sponsoredBootstrapFundingContext?.targetSessionSlug || '',
        );
        const bootstrapFaucetGrantToken = String(sponsoredBootstrapFundingContext?.faucetGrantToken || '').trim();

        const requestWithSponsoredFaucetGrant = async ({
          workerUrl,
          faucetGrantToken,
        }: {
          workerUrl?: string | null;
          faucetGrantToken?: string | null;
        } = {}): Promise<Record<string, unknown>> => {
          const baseUrl = String(workerUrl || '')
            .trim()
            .replace(/\/+$/, '');
          if (!baseUrl || !faucetGrantToken) {
            throw new Error('Sponsored faucet bootstrap grant is unavailable.');
          }
          const res = await fetchImpl(`${baseUrl}/sponsored/redeem-faucet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              faucetGrantToken,
              to: recipientAddress,
            }),
          });
          const data = await readJsonRecord(res);
          if (!res.ok) {
            if (Number(res.status || 0) === 404) {
              clearSponsoredBootstrapFaucetGrantToken();
            }
            throw createFundingError(String(data?.error || `Faucet request failed (${res.status})`), {
              stage: 'faucet-request',
              status: Number(res.status || 0) || 0,
              reason: data?.reason || '',
              details: data?.details || null,
            });
          }
          clearSponsoredBootstrapFaucetGrantToken();
          return data;
        };

        try {
          return await requestWithWorker({
            sessionSlug: resolvedSessionSlug,
            sessionConfig: cfg,
          });
        } catch (primaryError: any) {
          let fundingErrorForFallback = primaryError;
          if (isRetryableWorkerUrlResolutionFundingError(primaryError)) {
            const refreshedConfig = await refreshSessionFieldsForFunding();
            if (refreshedConfig) {
              try {
                return await requestWithWorker({
                  sessionSlug: resolvedSessionSlug,
                  sessionConfig: refreshedConfig,
                });
              } catch (retryError: any) {
                fundingErrorForFallback = retryError;
                if (!isRetryableSponsoredBootstrapFundingError(retryError)) {
                  throw retryError;
                }
              }
            }
          }
          const shouldRetryWithSponsoredBootstrap =
            (bootstrapSessionSlug || bootstrapWorkerUrl) &&
            bootstrapTargetSessionSlug === resolvedSessionSlug &&
            (bootstrapSessionSlug !== resolvedSessionSlug || !!bootstrapWorkerUrl) &&
            isRetryableSponsoredBootstrapFundingError(fundingErrorForFallback);
          if (!shouldRetryWithSponsoredBootstrap) {
            throw fundingErrorForFallback;
          }
          if (isMissingLocalFaucetKeyFundingError(fundingErrorForFallback)) {
            // Bootstrap faucet grants are single-use; once consumed, later
            // requests must come from the deployed session's own faucet key.
            if (bootstrapFaucetGrantToken && bootstrapWorkerUrl) {
              try {
                return await requestWithSponsoredFaucetGrant({
                  workerUrl: bootstrapWorkerUrl,
                  faucetGrantToken: bootstrapFaucetGrantToken,
                });
              } catch (grantError: any) {
                if (Number(grantError?.status || 0) === 404) {
                  throw fundingErrorForFallback;
                }
                throw grantError;
              }
            }
            throw fundingErrorForFallback;
          }
          if (bootstrapFaucetGrantToken && bootstrapWorkerUrl) {
            try {
              return await requestWithSponsoredFaucetGrant({
                workerUrl: bootstrapWorkerUrl,
                faucetGrantToken: bootstrapFaucetGrantToken,
              });
            } catch (grantError: any) {
              if (Number(grantError?.status || 0) !== 404) {
                throw grantError;
              }
            }
          }
          const bootstrapConfig = bootstrapSessionSlug ? getSessionConfigBySlug(bootstrapSessionSlug) : null;
          return await requestWithWorker({
            sessionSlug: bootstrapSessionSlug,
            sessionConfig: bootstrapConfig,
            workerUrlOverride: bootstrapWorkerUrl,
          });
        }
      } catch (error: any) {
        throw createFundingError(`Failed to request test ETH: ${error?.message || String(error)}`, {
          stage: error?.stage || '',
          status: Number(error?.status || 0) || 0,
          reason: error?.reason || '',
          details: error?.details || null,
        });
      }
    },

    async getGasPriceToDisplay(this: ContractHelperMethods, groupKeyOrCfg: GroupKeyOrCfg = null): Promise<string> {
      const gasPriceBN = await this.getGasPrice(groupKeyOrCfg);
      return utils.formatUnits(gasPriceBN, 'gwei');
    },
  };

  return methods;
}
