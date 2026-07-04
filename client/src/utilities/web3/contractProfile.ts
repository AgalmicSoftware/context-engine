/*
 * @module contractProfile
 * @description SBT universe discovery and profile/activity wrappers extracted from contractScripts.
 *              These methods are high-context but mostly read-only, so they live separately from the core contract entry point.
 *
 * Key exports: createContractProfileMethods
 */

import { ethers } from 'ethers';
import { extractChainId, extractChainIdOrUndefined } from './chainIdResolution.js';

type GroupKeyOrCfg = any;

type ContractsLogger = {
  log: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type SessionAddresses = {
  sbtFactory?: {
    address?: string | null;
    chainId?: number | string | null;
    [key: string]: any;
  };
  [key: string]: any;
};

type LatestBlockCache = {
  _map?: Record<string, any>;
  [key: string]: any;
};

type BlockWindow = {
  fromBlock: number;
  toBlock: number;
};

type DiscoveredAddressesPayload = {
  addresses: string[];
  scanTo: number | null;
  fromBlock: number;
  toBlock: number;
};

type SbtDiscoveryOptions = {
  force?: boolean;
  fromBlock?: unknown;
  toBlock?: unknown;
  onProgress?: ((payload: any) => void) | null;
  onDiscoveredAddresses?: ((payload: DiscoveredAddressesPayload) => void) | null;
  [key: string]: any;
};

type UserSbtLookupOptions = {
  fromBlock?: number | string | null;
  toBlock?: number | string | null;
  ignoreScope?: boolean;
  [key: string]: any;
};

type SbtLookupMetaOptions = {
  returnMeta?: boolean;
  ignoreScope?: boolean;
  [key: string]: any;
};

type UserActivityOptions = {
  returnMeta?: boolean;
  ignoreScope?: boolean;
  includeSurveyActivity?: boolean;
  includeQuestionActivity?: boolean;
  [key: string]: any;
};

type UserSbtNetHoldings = {
  addresses: string[];
};

type SbtListItem = {
  sbtAddress: string;
  sbtInfo?: any;
};

type SurveyActivityEntry = {
  id: any;
  data: any;
};

type QuestionActivityEntry = {
  id: any;
  data: any;
};

type SurveyResponseActivityEntry = {
  surveyId: any;
  response: any;
  responder: string;
};

type QuestionResponseActivityEntry = {
  questionId: string;
  response: any;
  responder: string;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
  timestamp: number;
};

type UserActivity = {
  sbts: SbtListItem[];
  createdSurveys: SurveyActivityEntry[];
  createdQuestions: QuestionActivityEntry[];
  surveyResponses: SurveyResponseActivityEntry[];
  questionResponses: QuestionResponseActivityEntry[];
};

type MetaResult<T> = {
  data: T;
  hadError: boolean;
  error?: string;
};

type MemoEntry<T> = {
  ts: number;
  value: T;
};

type MemoizedFields<T> = {
  _memo?: Partial<Record<string, MemoEntry<T>>>;
  _inflight?: Partial<Record<string, Promise<T>>>;
  _runVersion?: Partial<Record<string, number>>;
};

type GetAllSbtAddressesCachedMethod = ((
  this: ContractProfileMethods,
  providerName: any,
  groupKeyOrCfg?: GroupKeyOrCfg,
  options?: SbtDiscoveryOptions | null
) => Promise<string[]>) & MemoizedFields<string[]>;

type GetUserSbtNetHoldingsMethod = ((
  this: ContractProfileMethods,
  providerName: any,
  userAddress: string,
  options?: UserSbtLookupOptions | null,
  groupKeyOrCfg?: GroupKeyOrCfg
) => Promise<UserSbtNetHoldings>) & MemoizedFields<UserSbtNetHoldings>;

type GetUserSBTsMinimalMethod = ((
  this: ContractProfileMethods,
  providerName: any,
  userAddress: string,
  withMetadata?: boolean,
  groupKeyOrCfg?: GroupKeyOrCfg,
  options?: UserSbtLookupOptions | null
) => Promise<SbtListItem[]>) & MemoizedFields<SbtListItem[]>;

type ContractProfileDeps = {
  resolveSession: (groupKeyOrCfg: GroupKeyOrCfg) => any;
  getReadProviderForGroup: (
    groupKeyOrCfg: GroupKeyOrCfg,
    opts?: { contractKey?: string; skipGlobalPreferred?: boolean }
  ) => any;
  CUSTOM_SBT_ABI: any;
  callWithRetry: <T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ) => Promise<T>;
  rpcLog: (...args: unknown[]) => void;
  isNonexistentTokenError: (error: unknown) => boolean;
  contractsLog: ContractsLogger;
  getSessionAddresses: (cfg: any) => SessionAddresses;
  buildSbtScopeMemoTag: (groupKeyOrCfg: GroupKeyOrCfg, cfg?: any) => string;
  bumpSbtMemoRunVersion: (holder: MemoizedFields<any>, memoKey: string) => number;
  isLatestSbtMemoRun: (holder: MemoizedFields<any>, memoKey: string, runVersion: number) => boolean;
  SBT_FACTORY_ABI: any;
  shouldLog: (category: string, level?: string) => boolean;
  fetchLogsSmartWithProvider: (
    provider: any,
    filter: any,
    fromBlock: number,
    toBlock: number,
    depth?: number,
    maxDepth?: number,
    opts?: any
  ) => Promise<any[]>;
  resolveSessionNameValue: (value: any) => string | null | undefined;
  normalizeSessionSlug: (slug: string) => string;
  normalizeSbtSessionLinkFields: (info: any, fallbackSessionSlug: string) => any;
  normalizeSessionNameFields: (info: any, fallbackSessionName: string) => any;
  latestBlockCache: LatestBlockCache;
};

type ContractProfileMethods = {
  getSBTTokenIdByOwner: (
    providerName: any,
    SBTAddress: string,
    ownerAddress: string,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<string | null>;
  getOwnerByTokenId: (
    providerName: any,
    SBTAddress: string,
    tokenId: any,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<any | null>;
  getAllSbtAddressesCached: GetAllSbtAddressesCachedMethod;
  getUserSbtNetHoldings: GetUserSbtNetHoldingsMethod;
  getUserSBTsMinimal: GetUserSBTsMinimalMethod;
  getSBTsForUser: (
    this: ContractProfileMethods,
    address: string,
    slug: any,
    fromBlock?: number,
    opts?: SbtLookupMetaOptions | null
  ) => Promise<SbtListItem[] | MetaResult<SbtListItem[]>>;
  getUserActivity: (
    this: ContractProfileMethods,
    address: string,
    slug: any,
    fromBlock?: number,
    opts?: UserActivityOptions | null
  ) => Promise<UserActivity | MetaResult<UserActivity>>;
  getRelevantBlockWindowForFilter?: (
    this: ContractProfileMethods,
    groupKeyOrCfg: GroupKeyOrCfg,
    opts?: any
  ) => Promise<BlockWindow>;
  getSbtMetadata?: (
    this: ContractProfileMethods,
    providerName: any,
    sbtAddress: string,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<any>;
  getSurveysCreatedByAddress?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    fromBlock?: number,
    toBlock?: any,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<any[]>;
  getSurveyDataById?: (
    this: ContractProfileMethods,
    providerName: any,
    surveyId: any,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: any
  ) => Promise<any>;
  getSurveyResponsesByAddress?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    fromBlock?: number,
    toBlock?: any,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<any[]>;
  getSurveyResponse?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    surveyId: any,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: any
  ) => Promise<any>;
  getQuestionsCreatedByAddress?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    fromBlock?: number,
    toBlock?: any,
    groupKeyOrCfg?: GroupKeyOrCfg
  ) => Promise<any[]>;
  getQuestionData?: (
    this: ContractProfileMethods,
    providerName: any,
    questionId: any,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: any
  ) => Promise<any>;
  getQuestionResponsesByAddress?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    fromBlock?: number,
    toBlock?: any,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: any
  ) => Promise<any[]>;
  getResponse?: (
    this: ContractProfileMethods,
    providerName: any,
    address: string,
    questionId: any,
    groupKeyOrCfg?: GroupKeyOrCfg,
    opts?: any
  ) => Promise<any>;
  [key: string]: any;
};

const requireContractProfileMethod = <T extends (...args: any[]) => any>(
  method: T | undefined,
  methodName: string
): T => {
  if (typeof method !== 'function') {
    throw new Error(`contractProfile: missing sibling method ${methodName}`);
  }
  return method;
};

const SBT_READ_PROVIDER_OPTIONS = Object.freeze({ contractKey: 'sbtFactory' as const });
const SBT_LOG_READ_PROVIDER_OPTIONS = Object.freeze({
  contractKey: 'sbtFactory' as const,
  skipGlobalPreferred: true,
});

export function createContractProfileMethods(deps: ContractProfileDeps): ContractProfileMethods {
  const {
    resolveSession,
    getReadProviderForGroup,
    CUSTOM_SBT_ABI,
    callWithRetry,
    rpcLog,
    isNonexistentTokenError,
    contractsLog,
    getSessionAddresses,
    buildSbtScopeMemoTag,
    bumpSbtMemoRunVersion,
    isLatestSbtMemoRun,
    SBT_FACTORY_ABI,
    shouldLog,
    fetchLogsSmartWithProvider,
    resolveSessionNameValue,
    normalizeSessionSlug,
    normalizeSbtSessionLinkFields,
    normalizeSessionNameFields,
    latestBlockCache,
  } = deps;

  const methods: ContractProfileMethods = {
    async getSBTTokenIdByOwner(
      providerName: any,
      SBTAddress: string,
      ownerAddress: string,
      groupKeyOrCfg: GroupKeyOrCfg = null
    ): Promise<string | null> {
      const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider);
      try {
        rpcLog('RPC Call:', {
          function: 'getSBTTokenIdByOwner',
          method: 'CustomSBT.getTokenIdByOwner',
          params: { ownerAddress },
        });
        const tokenId: any = await callWithRetry(
          () => CustomSBT.getTokenIdByOwner(ownerAddress),
          'CustomSBT.getTokenIdByOwner'
        );
        void providerName;
        return tokenId.toString();
      } catch {
        return null;
      }
    },

    async getOwnerByTokenId(
      providerName: any,
      SBTAddress: string,
      tokenId: any,
      groupKeyOrCfg: GroupKeyOrCfg = null
    ): Promise<any | null> {
      const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider);
      try {
        rpcLog('RPC Call:', {
          function: 'getOwnerByTokenId',
          method: 'CustomSBT.ownerOf',
          params: { tokenId },
        });
        void providerName;
        return await callWithRetry(() => CustomSBT.ownerOf(tokenId), 'CustomSBT.ownerOf');
      } catch (error: any) {
        const errorName = error?.errorName || error?.error?.errorName || '';
        if (isNonexistentTokenError(error)) {
          contractsLog.debug('[getOwnerByTokenId] token not minted', { tokenId, SBTAddress, errorName });
        } else {
          contractsLog.error('Error getting owner for token ID:', error);
        }
        return null;
      }
    },

    async getAllSbtAddressesCached(
      this: ContractProfileMethods,
      providerName: any,
      groupKeyOrCfg: GroupKeyOrCfg = null,
      options: SbtDiscoveryOptions | null = {}
    ): Promise<string[]> {
      const self = this.getAllSbtAddressesCached as GetAllSbtAddressesCachedMethod;
      const memo = (self._memo ??= {});
      const inflight = (self._inflight ??= {});
      self._runVersion ??= {};
      const forceRefresh = !!(options && options.force === true);
      const rawFromBlock = options && Object.prototype.hasOwnProperty.call(options, 'fromBlock')
        ? Number(options.fromBlock)
        : null;
      const rawToBlock = options && Object.prototype.hasOwnProperty.call(options, 'toBlock')
        ? Number(options.toBlock)
        : null;
      const explicitFromBlock = rawFromBlock != null && Number.isFinite(rawFromBlock)
        ? Math.max(0, Math.floor(rawFromBlock))
        : null;
      const explicitToBlock = rawToBlock != null && Number.isFinite(rawToBlock)
        ? Math.max(0, Math.floor(rawToBlock))
        : null;
      const onProgress = options && typeof options.onProgress === 'function'
        ? options.onProgress
        : null;
      const onDiscoveredAddresses = options && typeof options.onDiscoveredAddresses === 'function'
        ? options.onDiscoveredAddresses
        : null;

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const slugOrEmpty = (cfg && typeof cfg.slug !== 'undefined') ? cfg.slug : '';
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      const chId =
        gAddrs.sbtFactory?.chainId || extractChainIdOrUndefined(cfg, { contractKey: 'sbtFactory' } as any);

      if (!addr) {
        contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
        return [];
      }

      const memoKey = `${buildSbtScopeMemoTag(groupKeyOrCfg, cfg)}:${explicitFromBlock != null ? explicitFromBlock : 'auto'}:${explicitToBlock != null ? explicitToBlock : 'auto'}`;

      const TTL_MS = 60 * 1000;
      const now = Date.now();
      const hit = memo[memoKey];
      if (!forceRefresh && hit && (now - hit.ts) < TTL_MS && Array.isArray(hit.value)) {
        return hit.value;
      }
      if (!forceRefresh && inflight[memoKey]) return inflight[memoKey];
      const runVersion = bumpSbtMemoRunVersion(self, memoKey);

      let run: Promise<string[]> | null = null;
      run = (async (): Promise<string[]> => {
        try {
          const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_LOG_READ_PROVIDER_OPTIONS);
          const factory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider);
          const filter = factory.filters.SBTCreated();
          const addrs = new Set<string>();
          const emittedAddresses = new Set<string>();

          let fromBlock: number | null = explicitFromBlock;
          let toBlock: number | null = explicitToBlock;
          if (fromBlock == null || toBlock == null) {
            const getRelevantBlockWindowForFilter = requireContractProfileMethod(
              this.getRelevantBlockWindowForFilter,
              'getRelevantBlockWindowForFilter'
            );
            const blockWindow = await getRelevantBlockWindowForFilter.call(
              this,
              groupKeyOrCfg,
              SBT_READ_PROVIDER_OPTIONS
            );
            if (fromBlock == null) fromBlock = Number(blockWindow?.fromBlock);
            if (toBlock == null) toBlock = Number(blockWindow?.toBlock);
          }

          const resolvedFromBlock = Number(fromBlock);
          const resolvedToBlock = Number(toBlock);

          if (resolvedFromBlock > resolvedToBlock) {
            if (isLatestSbtMemoRun(self, memoKey, runVersion)) {
              memo[memoKey] = { ts: Date.now(), value: [] };
            }
            return [];
          }

          if (shouldLog('rpc', 'log')) {
            rpcLog('[RPC_DEBUG_TRIGGER] getAllSbtAddressesCached -> getLogs', {
              fromBlock: resolvedFromBlock,
              toBlock: resolvedToBlock,
              addr,
              chId,
            });
          }

          const totalBlocks = Math.max(0, resolvedToBlock - resolvedFromBlock + 1);
          const parsedLogKeys = new Set<string>();
          const getSbtCreatedLogKey = (log: any): string => [
            log?.blockHash || log?.blockNumber || '',
            log?.transactionHash || '',
            log?.logIndex ?? log?.transactionIndex ?? '',
            Array.isArray(log?.topics) ? log.topics.join('|') : '',
            log?.data || '',
          ].join(':');
          const collectAddressesFromLogs = (logs: any[] = []): string[] => {
            const next: string[] = [];
            (Array.isArray(logs) ? logs : []).forEach((log: any): void => {
              const logKey = getSbtCreatedLogKey(log);
              if (logKey && parsedLogKeys.has(logKey)) return;
              if (logKey) parsedLogKeys.add(logKey);
              try {
                const event = factory.interface.parseLog(log);
                const address = String(event?.args?.sbtAddress ?? event?.args?.[0] ?? '').trim();
                if (!address) return;
                addrs.add(address);
                next.push(address);
              } catch (error: unknown) {
                contractsLog.warn('contractProfile: fallback', error);
              }
            });
            return next;
          };
          const emitDiscoveredAddresses = (
            addresses: Array<string | null | undefined> = [],
            scanTo: number | null = null
          ): void => {
            if (typeof onDiscoveredAddresses !== 'function') return;
            const fresh: string[] = [];
            (Array.isArray(addresses) ? addresses : []).forEach((addressRaw: string | null | undefined): void => {
              const address = String(addressRaw || '').trim();
              if (!address) return;
              const lower = address.toLowerCase();
              if (emittedAddresses.has(lower)) return;
              emittedAddresses.add(lower);
              fresh.push(address);
            });
            if (!fresh.length) return;
            try {
              onDiscoveredAddresses({
                addresses: fresh,
                scanTo: Number.isFinite(Number(scanTo)) ? Number(scanTo) : null,
                fromBlock: resolvedFromBlock,
                toBlock: resolvedToBlock,
              });
            } catch (error: unknown) {
              contractsLog.warn('contractProfile: fallback', error);
            }
          };
          const rawLogs = await fetchLogsSmartWithProvider(
            provider,
            filter,
            resolvedFromBlock,
            resolvedToBlock,
            0,
            20,
            (onProgress || onDiscoveredAddresses) ? {
              phase: 'discover',
              fromBlock: resolvedFromBlock,
              toBlock: resolvedToBlock,
              totalBlocks,
              scannedBlocks: 0,
              onProgress,
              onLogs: onDiscoveredAddresses
                ? ({ logs = [], scanTo }: { logs?: any[]; scanTo?: number | null }): void => {
                  emitDiscoveredAddresses(
                    collectAddressesFromLogs(logs),
                    scanTo ?? null
                  );
                }
                : null,
            } : null
          );
          collectAddressesFromLogs(rawLogs);
          emitDiscoveredAddresses(Array.from(addrs), resolvedToBlock);
          const result = Array.from(addrs);
          if (isLatestSbtMemoRun(self, memoKey, runVersion)) {
            memo[memoKey] = { ts: Date.now(), value: result };
          }
          void providerName;
          return result;
        } finally {
          if (run && inflight[memoKey] === run) {
            delete inflight[memoKey];
          }
        }
      })();

      if (!forceRefresh) {
        inflight[memoKey] = run;
      }
      return run;
    },

    async getUserSbtNetHoldings(
      this: ContractProfileMethods,
      providerName: any,
      userAddress: string,
      options: UserSbtLookupOptions | null = {},
      groupKeyOrCfg: GroupKeyOrCfg = null
    ): Promise<UserSbtNetHoldings> {
      const self = this.getUserSbtNetHoldings as GetUserSbtNetHoldingsMethod;
      const memo = (self._memo ??= {});
      const inflight = (self._inflight ??= {});

      if (!userAddress || !ethers.utils.isAddress(userAddress)) {
        throw new Error('getUserSbtNetHoldings: userAddress (0x...) is required');
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS as any);

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getUserSbtNetHoldings',
          scope: 'per-user',
          user: userAddress.toLowerCase(),
          groupKeyOrCfg,
          chainId: chId || null,
          fromBlock: options?.fromBlock || 0,
        });
      }

      const scopedGroupRef = (options && options.ignoreScope)
        ? { ...(cfg && typeof cfg === 'object' ? cfg : {}), __ignoreSessionScanScope: true }
        : groupKeyOrCfg;
      const memoScopeTag = buildSbtScopeMemoTag(
        scopedGroupRef,
        scopedGroupRef && typeof scopedGroupRef === 'object' ? scopedGroupRef : null
      );
      const memoKey = `${userAddress.toLowerCase()}:${memoScopeTag}`;

      const TTL_MS = 45 * 1000;
      const now = Date.now();
      const hit = memo[memoKey];
      if (hit && (now - hit.ts) < TTL_MS) return hit.value;
      if (inflight[memoKey]) return inflight[memoKey];

      const run = (async (): Promise<UserSbtNetHoldings> => {
        try {
          const getAllSbtAddressesCached = requireContractProfileMethod(
            this.getAllSbtAddressesCached,
            'getAllSbtAddressesCached'
          );
          const universe = await getAllSbtAddressesCached.call(this, 'none', scopedGroupRef);
          if (!Array.isArray(universe) || universe.length === 0) {
            const empty: UserSbtNetHoldings = { addresses: [] };
            memo[memoKey] = { ts: Date.now(), value: empty };
            return empty;
          }

          const held: string[] = [];
          const BATCH_SIZE = 10;
          const balanceAbi = ['function balanceOf(address owner) view returns (uint256)'];
          const balanceContracts = new Map<string, any>();
          const readProvider = getReadProviderForGroup(scopedGroupRef, SBT_READ_PROVIDER_OPTIONS);
          const getBalanceContract = (addr: string): any | null => {
            const key = String(addr || '').toLowerCase();
            if (!key) return null;
            if (balanceContracts.has(key)) return balanceContracts.get(key) || null;
            const contract = new ethers.Contract(addr, balanceAbi, readProvider);
            balanceContracts.set(key, contract);
            return contract;
          };

          for (let i = 0; i < universe.length; i += BATCH_SIZE) {
            const batch = universe.slice(i, i + BATCH_SIZE);

            const results = await Promise.all(
              batch.map(async (addr: string): Promise<string | null> => {
                try {
                  const contract = getBalanceContract(addr);
                  if (!contract) return null;
                  const bal = await callWithRetry(
                    () => contract.balanceOf(userAddress),
                    'CustomSBT.balanceOf'
                  );
                  const balNum = ethers.BigNumber.isBigNumber(bal)
                    ? bal.toString()
                    : String(bal ?? '');
                  if (!balNum || balNum === '0' || balNum === '0x0') return null;
                  return addr;
                } catch (error: unknown) {
                  try {
                    const getSBTTokenIdByOwner = requireContractProfileMethod(
                      this.getSBTTokenIdByOwner,
                      'getSBTTokenIdByOwner'
                    );
                    const tokenIdStr = await getSBTTokenIdByOwner.call(
                      this,
                      'none',
                      addr,
                      userAddress,
                      scopedGroupRef
                    );
                    if (!tokenIdStr) return null;
                    const trimmed = tokenIdStr.toString();
                    if (trimmed === '0' || trimmed === '0x0') return null;
                    return addr;
                  } catch (tokenError: any) {
                    contractsLog.warn(
                      `[getUserSbtNetHoldings] balance/token check failed for ${addr}:`,
                      tokenError?.message || tokenError
                    );
                    return null;
                  }
                }
              })
            );

            results.forEach((addr: string | null): void => {
              if (addr) held.push(addr);
            });

            if (i + BATCH_SIZE < universe.length) {
              await new Promise<void>((resolveDelay): void => {
                setTimeout(resolveDelay, 25);
              });
            }
          }

          const uniqueHeld = Array.from(new Set(held));
          const value: UserSbtNetHoldings = { addresses: uniqueHeld };
          memo[memoKey] = { ts: Date.now(), value };
          void providerName;
          return value;
        } finally {
          delete inflight[memoKey];
        }
      })();

      inflight[memoKey] = run;
      return run;
    },

    async getUserSBTsMinimal(
      this: ContractProfileMethods,
      providerName: any,
      userAddress: string,
      withMetadata: boolean = true,
      groupKeyOrCfg: GroupKeyOrCfg = null,
      options: UserSbtLookupOptions | null = {}
    ): Promise<SbtListItem[]> {
      const self = this.getUserSBTsMinimal as GetUserSBTsMinimalMethod;
      const memo = (self._memo ??= {});
      const inflight = (self._inflight ??= {});

      if (!userAddress || typeof userAddress !== 'string' || userAddress.length !== 42) {
        throw new Error('getUserSBTsMinimal: userAddress (0x...) is required');
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS as any);

      const fromBlock = options?.fromBlock || 0;
      const scopedGroupRef = (options && options.ignoreScope)
        ? { ...(cfg && typeof cfg === 'object' ? cfg : {}), __ignoreSessionScanScope: true }
        : groupKeyOrCfg;
      const memoScopeTag = buildSbtScopeMemoTag(
        scopedGroupRef,
        scopedGroupRef && typeof scopedGroupRef === 'object' ? scopedGroupRef : null
      );
      const memoKey = `${userAddress.toLowerCase()}:${withMetadata ? 'meta' : 'bare'}:${chId}:${fromBlock}:${memoScopeTag}`;
      const TTL_MS = 30 * 1000;
      const now = Date.now();
      const hit = memo[memoKey];
      if (hit && (now - hit.ts) < TTL_MS) return hit.value;
      if (inflight[memoKey]) return inflight[memoKey];

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getUserSBTsMinimal',
          scope: 'per-user',
          user: userAddress.toLowerCase(),
          groupKeyOrCfg,
          chainId: chId || null,
          fromBlock,
          withMetadata: !!withMetadata,
        });
      }

      const run = (async (): Promise<SbtListItem[]> => {
        try {
          const getUserSbtNetHoldings = requireContractProfileMethod(
            this.getUserSbtNetHoldings,
            'getUserSbtNetHoldings'
          );
          const { addresses } = await getUserSbtNetHoldings.call(
            this,
            providerName,
            userAddress,
            options,
            groupKeyOrCfg
          );
          if (!withMetadata) {
            const bare = addresses.map((address: string): SbtListItem => ({ sbtAddress: address }));
            memo[memoKey] = { ts: Date.now(), value: bare };
            return bare;
          }

          const fallbackSessionSlug = normalizeSessionSlug(cfg?.slug || '');
          const fallbackSessionName = (() : string => {
            const fromCfg = resolveSessionNameValue(cfg || {});
            if (fromCfg) return fromCfg;
            return fallbackSessionSlug || 'general';
          })();
          const normalizeSbtInfoSessionNames = (rawInfo: any): any => {
            const info = (rawInfo && typeof rawInfo === 'object') ? { ...rawInfo } : {};
            normalizeSbtSessionLinkFields(info, fallbackSessionSlug);
            const hasSessionName = !!resolveSessionNameValue(info || {});
            if (!hasSessionName && !fallbackSessionName) return info;
            return normalizeSessionNameFields(info, fallbackSessionName);
          };

          const out: SbtListItem[] = [];
          const BATCH = 6;
          for (let i = 0; i < addresses.length; i += BATCH) {
            const batch = addresses.slice(i, i + BATCH);
            const metas = await Promise.all(batch.map(async (addr: string): Promise<SbtListItem> => {
              try {
                const getSbtMetadata = requireContractProfileMethod(
                  this.getSbtMetadata,
                  'getSbtMetadata'
                );
                const info = await getSbtMetadata.call(this, providerName, addr, groupKeyOrCfg);
                const normalizedInfo = normalizeSbtInfoSessionNames(info);
                if (normalizedInfo) return { sbtAddress: addr, sbtInfo: normalizedInfo };
                return { sbtAddress: addr };
              } catch (_error: unknown) {
                const fallbackInfo = normalizeSbtInfoSessionNames(null);
                if (fallbackInfo) return { sbtAddress: addr, sbtInfo: fallbackInfo };
                return { sbtAddress: addr };
              }
            }));
            out.push(...metas);
          }
          memo[memoKey] = { ts: Date.now(), value: out };
          return out;
        } finally {
          delete inflight[memoKey];
        }
      })();

      inflight[memoKey] = run;
      return run;
    },

    async getSBTsForUser(
      this: ContractProfileMethods,
      address: string,
      slug: any,
      fromBlock: number = 0,
      opts: SbtLookupMetaOptions | null = {}
    ): Promise<SbtListItem[] | MetaResult<SbtListItem[]>> {
      const returnMeta = !!(opts && opts.returnMeta);
      const ignoreScope = !!(opts && opts.ignoreScope);
      const toMeta = (
        data: SbtListItem[],
        hadError: boolean = false,
        error: unknown = null
      ): SbtListItem[] | MetaResult<SbtListItem[]> => {
        const normalized = Array.isArray(data) ? data : [];
        if (!returnMeta) return normalized;
        const result: MetaResult<SbtListItem[]> = { data: normalized, hadError: !!hadError };
        if (hadError && error) {
          result.error = String((error as any)?.message || error);
        }
        return result;
      };

      try {
        if (shouldLog('rpc', 'log')) {
          rpcLog('RPC Call:', {
            function: 'getSBTsForUser',
            scope: 'per-user',
            address: (address || '').toLowerCase(),
            sessionSlug: slug,
            fromBlock,
          });
        }

        const getUserSBTsMinimal = requireContractProfileMethod(
          this.getUserSBTsMinimal,
          'getUserSBTsMinimal'
        );
        const sessionRef = ignoreScope
          ? { ...(resolveSession(slug || '') || {}), __ignoreSessionScanScope: true }
          : slug;
        const sbts = await getUserSBTsMinimal.call(this, 'none', address, true, sessionRef, {
          fromBlock,
          ignoreScope,
        });
        return toMeta(sbts || [], false);
      } catch (error: unknown) {
        contractsLog.warn(`[getSBTsForUser] Failed for ${slug}:`, error);
        return toMeta([], true, error);
      }
    },

    async getUserActivity(
      this: ContractProfileMethods,
      address: string,
      slug: any,
      fromBlock: number = 0,
      opts: UserActivityOptions | null = {}
    ): Promise<UserActivity | MetaResult<UserActivity>> {
      const returnMeta = !!(opts && opts.returnMeta);
      const ignoreScope = !!(opts && opts.ignoreScope);
      const includeSurveyActivity = !(
        opts &&
        Object.prototype.hasOwnProperty.call(opts, 'includeSurveyActivity') &&
        opts.includeSurveyActivity === false
      );
      const includeQuestionActivity = !(
        opts &&
        Object.prototype.hasOwnProperty.call(opts, 'includeQuestionActivity') &&
        opts.includeQuestionActivity === false
      );
      const sessionRef = ignoreScope
        ? { ...(resolveSession(slug || '') || {}), __ignoreSessionScanScope: true }
        : slug;
      const activity: UserActivity = {
        sbts: [],
        createdSurveys: [],
        createdQuestions: [],
        surveyResponses: [],
        questionResponses: [],
      };
      let hadError = false;

      const toMeta = (
        data: UserActivity,
        failed: boolean = false
      ): UserActivity | MetaResult<UserActivity> => {
        if (!returnMeta) return data;
        return { data, hadError: !!failed };
      };

      const markStepError = (step: string, error: unknown): void => {
        hadError = true;
        contractsLog.warn(`[getUserActivity] ${step} failed for ${slug}:`, error);
      };

      const safeCall = async <T>(step: string, run: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await run();
        } catch (error: unknown) {
          markStepError(step, error);
          return fallback;
        }
      };

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getUserActivity',
          scope: 'per-user',
          address: (address || '').toLowerCase(),
          sessionSlug: slug,
          fromBlock,
          includeSurveyActivity,
          includeQuestionActivity,
        });
      }

      try {
        if (includeSurveyActivity) {
          const getSurveysCreatedByAddress = requireContractProfileMethod(
            this.getSurveysCreatedByAddress,
            'getSurveysCreatedByAddress'
          );
          const getSurveyDataById = requireContractProfileMethod(
            this.getSurveyDataById,
            'getSurveyDataById'
          );
          const getSurveyResponsesByAddress = requireContractProfileMethod(
            this.getSurveyResponsesByAddress,
            'getSurveyResponsesByAddress'
          );
          const getSurveyResponse = requireContractProfileMethod(
            this.getSurveyResponse,
            'getSurveyResponse'
          );

          const surveyIDsRaw = await safeCall<any[]>(
            'getSurveysCreatedByAddress',
            () => getSurveysCreatedByAddress.call(this, 'none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const surveyIDs = Array.isArray(surveyIDsRaw) ? surveyIDsRaw : [];
          if (surveyIDs.length > 0) {
            const surveys = await Promise.all(surveyIDs.map(async (id: any): Promise<SurveyActivityEntry | null> => {
              const data = await safeCall<any | null>(
                `getSurveyDataById:${String(id || '').toLowerCase()}`,
                () => getSurveyDataById.call(this, 'none', id, sessionRef, { throwOnFailure: true }),
                null
              );
              return data ? { id, data } : null;
            }));
            activity.createdSurveys = surveys.filter(
              (survey: SurveyActivityEntry | null): survey is SurveyActivityEntry => !!(survey && survey.data)
            );
          }

          const respondedSurveyIDsRaw = await safeCall<any[]>(
            'getSurveyResponsesByAddress',
            () => getSurveyResponsesByAddress.call(this, 'none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const respondedSurveyIDs = Array.isArray(respondedSurveyIDsRaw) ? respondedSurveyIDsRaw : [];
          if (respondedSurveyIDs.length > 0) {
            const responses = await Promise.all(
              respondedSurveyIDs.map(async (sid: any): Promise<SurveyResponseActivityEntry | null> => {
                const data = await safeCall<any | null>(
                  `getSurveyResponse:${String(sid || '').toLowerCase()}`,
                  () => getSurveyResponse.call(this, 'none', address, sid, sessionRef, { throwOnError: true }),
                  null
                );
                return data ? { surveyId: sid, response: data, responder: address } : null;
              })
            );
            activity.surveyResponses = responses.filter(
              (response: SurveyResponseActivityEntry | null): response is SurveyResponseActivityEntry => !!(response && response.response)
            );
          }
        }

        if (includeQuestionActivity) {
          const getQuestionsCreatedByAddress = requireContractProfileMethod(
            this.getQuestionsCreatedByAddress,
            'getQuestionsCreatedByAddress'
          );
          const getQuestionData = requireContractProfileMethod(
            this.getQuestionData,
            'getQuestionData'
          );
          const getQuestionResponsesByAddress = requireContractProfileMethod(
            this.getQuestionResponsesByAddress,
            'getQuestionResponsesByAddress'
          );
          const getResponse = requireContractProfileMethod(
            this.getResponse,
            'getResponse'
          );

          const questionIDsRaw = await safeCall<any[]>(
            'getQuestionsCreatedByAddress',
            () => getQuestionsCreatedByAddress.call(this, 'none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const questionIDs = Array.isArray(questionIDsRaw) ? questionIDsRaw : [];
          if (questionIDs.length > 0) {
            const questions = await Promise.all(questionIDs.map(async (id: any): Promise<QuestionActivityEntry | null> => {
              const data = await safeCall<any | null>(
                `getQuestionData:${String(id || '').toLowerCase()}`,
                () => getQuestionData.call(this, 'none', id, sessionRef, { throwOnFailure: true }),
                null
              );
              return data ? { id, data } : null;
            }));
            activity.createdQuestions = questions.filter(
              (question: QuestionActivityEntry | null): question is QuestionActivityEntry => !!(question && question.data)
            );
          }

          const respondedQuestionEntriesRaw = await safeCall<any[]>(
            'getQuestionResponsesByAddress',
            () => getQuestionResponsesByAddress.call(
              this,
              'none',
              address,
              fromBlock,
              'latest',
              sessionRef,
              { withMeta: true }
            ),
            []
          );
          const respondedQuestionEntries = Array.isArray(respondedQuestionEntriesRaw)
            ? respondedQuestionEntriesRaw
            : [];
          if (respondedQuestionEntries.length > 0) {
            const responses = await Promise.all(
              respondedQuestionEntries.map(async (entry: any): Promise<QuestionResponseActivityEntry | null> => {
                const qid = (entry && typeof entry === 'object')
                  ? String(entry.questionId || '').toLowerCase()
                  : String(entry || '').toLowerCase();
                if (!qid) return null;
                const data = await safeCall<any | null>(
                  `getResponse:${qid}`,
                  () => getResponse.call(this, 'none', address, qid, sessionRef, { throwOnError: true }),
                  null
                );
                if (!data) return null;
                return {
                  questionId: qid,
                  response: data,
                  responder: address,
                  blockNumber: Number(entry?.blockNumber || 0) || 0,
                  transactionIndex: Number(entry?.transactionIndex || 0) || 0,
                  logIndex: Number(entry?.logIndex || 0) || 0,
                  timestamp: Number(entry?.timestamp || 0) || 0,
                };
              })
            );
            activity.questionResponses = responses.filter(
              (response: QuestionResponseActivityEntry | null): response is QuestionResponseActivityEntry => !!(response && response.response)
            );
          }
        }
      } catch (error: unknown) {
        hadError = true;
        contractsLog.warn(`[getUserActivity] Partial failure for ${slug}:`, error);
      }

      return toMeta(activity, hadError);
    },
  };

  return methods;
}
