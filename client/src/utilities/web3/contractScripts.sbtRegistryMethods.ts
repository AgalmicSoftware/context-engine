import type { ContractScriptsMethodMap, ContractScriptsRuntimeDeps } from './contractScripts.runtimeDeps.js';

type SbtReadProviderRef = string | Record<string, unknown>;
type SbtReadGroupKeyOrConfig = string | Record<string, unknown> | null | undefined;
type SbtReadOptions = { allowInjectedReadFallback?: boolean; [key: string]: unknown };
type SignGroupMintAuthorizationInput = {
  password?: unknown;
  sbtAddress?: string | null;
  userAddress?: string | null;
  walletScopeSbtAddress?: string | null;
};
type GenerateInvitePayloadsInput = {
  password?: unknown;
  sbtAddress?: string | null;
  nonces?: Array<string | number>;
  walletScopeSbtAddress?: string | null;
};
type InvitePayloadResult = {
  nonce: string;
  signature: string;
  inviteCode: string;
};
type EncodedInvitePayload = {
  n: string;
  s: string;
};
type SbtMintBurnCountsByAddressResult = {
  mintedCountByAddress: Record<string, number>;
  burnedCountByAddress: Record<string, number>;
  mintedEventCount?: number;
  burnedEventCount?: number;
  scannedToBlock?: number | null;
  ok?: boolean;
  [key: string]: unknown;
};

export const createContractScriptsSbtRegistryMethods = (deps: ContractScriptsRuntimeDeps): ContractScriptsMethodMap => {
  const {
    ARWEAVE_ACTIVE,
    CUSTOM_SBT_ABI,
    CUSTOM_SBT_INTERFACE,
    GAS_FALLBACKS,
    HASH_MISS_SENTINEL,
    HASH_READ_MAX_ENTRIES,
    HASH_READ_TTL_MS,
    READ_INFLIGHT,
    READ_MEMO,
    SBT_FACTORY_ABI,
    SBT_FACTORY_INTERFACE,
    SBT_READ_PROVIDER_OPTIONS,
    SBT_TOKENURI_METADATA_TIMEOUT_MS,
    STORAGE_BACKENDS,
    STORAGE_RESOURCE_KEYS,
    SURVEYS,
    SURVEYS_INTERFACE,
    arweaveClient,
    attachStorageRefCompatibilityFields,
    buildSbtScopeMemoTag,
    clearReadCachesForGroup,
    getSessionAddresses,
    getTimedMemoValue,
    normalizeSbtSessionLinkFields,
    resolveArweaveUploadOpts,
    resolveSessionNameValue,
    attachPayloadPointerFields,
    buildArweaveDebugContext,
    buildArweaveReadModeTag,
    buildDecryptModeTag,
    buildFailureModeTag,
    buildHashReadInflightKey,
    buildHashReadMemoKey,
    buildHashUnavailableMetadataError,
    callWithRetry,
    cloneJsonSafe,
    contractEventScanMethods,
    contractsLog,
    createSbtEventScanProgressState,
    cryptoUtils,
    deriveSbtHistorySummaryFromCounts,
    downloadArweaveTextForGroup,
    ethers,
    extractChainId,
    fetchLogsSmartWithProvider,
    getLocalAwareReadProviderForGroup,
    getReadProviderForChain,
    getSurveysReadProviderForSession,
    hasNonZeroHashValue,
    hasPasswordMintForSbtMintMode,
    inviteLog,
    isCallExceptionError,
    isCloudflareStorageResource,
    isNonexistentTokenError,
    isObj,
    isRetryableSurveyResponseReadError,
    latestBlockCache,
    logArweaveMetadataFetchFailure,
    markHashRevertLoggedOnce,
    maybeWrapUnsupportedConfiguredDeterministicFactoryError,
    memoizedResolveSession,
    normalizeAddress,
    normalizeArweaveUrl,
    normalizeConvictionImportance,
    normalizeCreate2Salt,
    normalizeHistorySummaryCount,
    normalizeQuestionFlags,
    normalizeSbtHistorySummary,
    normalizeSessionNameFields,
    normalizeSessionSlug,
    normalizeStorageRef,
    notify,
    notifyUserFacingTransactionError,
    parseArweaveTxId,
    questionHashRevertLogged,
    readPayloadPointerTextForGroup,
    recordTerminalArweaveInvalidFailure,
    resolveGroupPasswordWalletScopeSbtAddress,
    resolveReadContext,
    resolveReadProvider,
    resolveSession,
    resolveSessionByName,
    resolveStorageSessionSlug,
    resolveTxGasOverrides,
    rpcLog,
    runInFlightCoalesced,
    runWithSoftTimeout,
    sendContractWriteViaProvider,
    setTimedMemoValue,
    shouldLog,
    surveyHashRevertLogged,
    uploadJsonPayloadForContractPointer,
    utils,
    validateNoLockedPlaintextInPayload,
  } = deps;

  return {
    predictSBTAddress: async function (
      providerName: any,
      name: any,
      symbol: any,
      limitedNumber: any,
      adminAddress: any,
      mintingEndTime: any,
      hasPasswordMint: any,
      burnAuth: any,
      hashedPasswords: any,
      tokenURI: any,
      groupPasswordHash: any = ethers.constants.HashZero,
      groupKeyOrCfg: any = null,
      create2Salt: any = '',
      predictOptions: any = {},
    ) {
      const create2SaltNormalized = normalizeCreate2Salt(create2Salt);
      if (!create2SaltNormalized) {
        throw new Error('predictSBTAddress requires a CREATE2 salt.');
      }
      const useConfiguredDeterministic = !!predictOptions?.useConfiguredDeterministic;
      const initializeGroupPasswordHash = !!predictOptions?.initializeGroupPasswordHash;
      if (useConfiguredDeterministic && !initializeGroupPasswordHash && hasNonZeroHashValue(groupPasswordHash)) {
        throw new Error('Configured deterministic SBT prediction cannot preinitialize a group password hash.');
      }

      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const slugOrEmpty = cfg && typeof cfg.slug !== 'undefined' ? cfg.slug : '';
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      if (!addr) {
        contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
        return '';
      }

      let provider = null;
      const chainId = Number(cfg?.networkChainId || 0) || null;
      if (chainId) {
        try {
          provider = getReadProviderForChain(chainId);
        } catch {
          provider = null;
        }
      }
      if (!provider) {
        const providerLocation = this.getProviderLocation(providerName);
        provider = new ethers.providers.Web3Provider(providerLocation as any);
      }

      const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
      try {
        if (useConfiguredDeterministic) {
          return await SBTFactory.predictConfiguredSBTAddress(
            create2SaltNormalized,
            name,
            symbol,
            limitedNumber,
            adminAddress,
            mintingEndTime,
            hasPasswordMint,
            burnAuth,
            hashedPasswords,
            initializeGroupPasswordHash,
          );
        }
        return await SBTFactory.predictSBTAddress(
          create2SaltNormalized,
          name,
          symbol,
          limitedNumber,
          adminAddress,
          mintingEndTime,
          hasPasswordMint,
          burnAuth,
          hashedPasswords,
          tokenURI,
          groupPasswordHash,
        );
      } catch (err: any) {
        const normalizedError = useConfiguredDeterministic
          ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(err, addr)
          : err;
        contractsLog.error('[predictSBTAddress] failed:', normalizedError?.message || normalizedError);
        throw normalizedError;
      }
    },

    createSBT: async function (
      providerName: any,
      name: any,
      symbol: any,
      limitedNumber: any,
      adminAddress: any,
      mintingEndTime: any,
      hasPasswordMint: any,
      burnAuth: any,
      hashedPasswords: any,
      tokenURI: any,
      groupPasswordHash: any = ethers.constants.HashZero, // <-- ADDED (default = 0)
      groupKeyOrCfg: any = null,
      create2Salt: any = '',
      createOptions: any = {},
    ) {
      if (providerName === 'none') {
        throw new Error('createSBT: read-only provider is not allowed here. Connect a wallet first.');
      }
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();

      // === Address resolution (group-aware; no constant fallback)
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const slugOrEmpty = cfg && typeof cfg.slug !== 'undefined' ? cfg.slug : '';
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      if (!addr) {
        contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
        return; // early return, no tx
      }
      const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, signer as any);

      const create2SaltNormalized = normalizeCreate2Salt(create2Salt);
      const useCreate2 = !!create2SaltNormalized;
      const useConfiguredDeterministic = !!(useCreate2 && createOptions?.useConfiguredDeterministic);
      const initializeGroupPasswordHash = !!createOptions?.initializeGroupPasswordHash;
      if (useConfiguredDeterministic && !initializeGroupPasswordHash && hasNonZeroHashValue(groupPasswordHash)) {
        throw new Error('Configured deterministic SBT deployment cannot preinitialize a group password hash.');
      }
      if (useConfiguredDeterministic) {
        if (!ethers.utils.isAddress(String(adminAddress || ''))) {
          throw new Error('Configured deterministic SBT deployment requires a valid admin address.');
        }
        const signerAddress = await signer.getAddress();
        if (ethers.utils.getAddress(signerAddress) !== ethers.utils.getAddress(adminAddress)) {
          throw new Error('Configured deterministic SBT deployment must be submitted by the SBT admin wallet.');
        }
      }

      rpcLog('RPC Call (Tx):', {
        function: 'createSBT',
        method: useConfiguredDeterministic
          ? 'SBTFactory.createSBTDeterministicConfigured'
          : useCreate2
            ? 'SBTFactory.createSBTDeterministic'
            : 'SBTFactory.createSBT',
        params: {
          ...(useCreate2 ? { create2Salt: create2SaltNormalized } : {}),
          name,
          symbol,
          limitedNumber,
          adminAddress,
          mintingEndTime,
          hasPasswordMint,
          burnAuth,
          hashedPasswordsCount: hashedPasswords.length,
          tokenURI,
          groupPasswordHash,
          ...(useConfiguredDeterministic ? { initializeGroupPasswordHash } : {}),
        },
      });
      const numPasswords = Array.isArray(hashedPasswords) ? hashedPasswords.length : 0;
      const fallbackGasValue = useConfiguredDeterministic
        ? GAS_FALLBACKS.createSBTDeterministicConfigured(numPasswords)
        : useCreate2
          ? GAS_FALLBACKS.createSBTDeterministic(numPasswords)
          : GAS_FALLBACKS.createSBT(numPasswords);
      const createArgs = useConfiguredDeterministic
        ? [
            create2SaltNormalized,
            name,
            symbol,
            limitedNumber,
            adminAddress,
            mintingEndTime,
            hasPasswordMint,
            burnAuth,
            hashedPasswords,
            tokenURI,
            groupPasswordHash,
            initializeGroupPasswordHash,
          ]
        : useCreate2
          ? [
              create2SaltNormalized,
              name,
              symbol,
              limitedNumber,
              adminAddress,
              mintingEndTime,
              hasPasswordMint,
              burnAuth,
              hashedPasswords,
              tokenURI,
              groupPasswordHash,
            ]
          : [
              name,
              symbol,
              limitedNumber,
              adminAddress,
              mintingEndTime,
              hasPasswordMint,
              burnAuth,
              hashedPasswords,
              tokenURI,
              groupPasswordHash,
            ];
      let txOverrides;
      try {
        txOverrides = await resolveTxGasOverrides({
          contract: SBTFactory,
          method: useConfiguredDeterministic
            ? 'createSBTDeterministicConfigured'
            : useCreate2
              ? 'createSBTDeterministic'
              : 'createSBT',
          args: createArgs,
          fallbackGasLimit: String(fallbackGasValue),
          minEstimate: '3500000',
          logLabel: 'CREATE_SBT',
          preferFallbackGasLimit: true,
        });
      } catch (error: any) {
        throw useConfiguredDeterministic ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(error, addr) : error;
      }
      contractsLog.log(
        '[CREATE_SBT] tx gasLimit:',
        txOverrides?.gasLimit?.toString?.() || String(txOverrides?.gasLimit || ''),
      );

      try {
        const createMethod = useConfiguredDeterministic
          ? 'createSBTDeterministicConfigured'
          : useCreate2
            ? 'createSBTDeterministic'
            : 'createSBT';
        const { receipt } = await sendContractWriteViaProvider({
          signingProvider: providerLocation,
          ethersProvider,
          signer,
          contract: SBTFactory,
          method: createMethod,
          args: createArgs,
          txOverrides,
          rpcFunction: 'createSBT',
          revertMessage: 'createSBT transaction reverted on-chain.',
        });
        return receipt;
      } catch (error: any) {
        const normalizedError = useConfiguredDeterministic
          ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(error, addr)
          : error;
        if (normalizedError !== error) {
          notify.error(normalizedError.message);
        } else {
          notifyUserFacingTransactionError(error);
        }
        throw normalizedError;
      }
    },

    countSBTCreated: async function (providerName: any, groupKeyOrCfg: any = null) {
      try {
        // Read-only: use group-aware read provider; no signer.
        const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
        const slugOrEmpty = cfg && typeof cfg.slug !== 'undefined' ? cfg.slug : '';
        const gAddrs = getSessionAddresses(cfg);
        const addr = gAddrs.sbtFactory?.address;

        if (!addr) {
          contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
          return 0; // neutral
        }

        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
        const sbtCount = await SBTFactory.sbtCount();
        return (ethers.BigNumber.isBigNumber(sbtCount) ? sbtCount.toNumber() : Number(sbtCount || 0)) || 0;
      } catch (error: any) {
        contractsLog.error('Error in countSBTCreated function:', error);
        throw error;
      }
    },

    async getSbtsCreated(
      providerName: any,
      fromCustomBlock: any = 0,
      toCustomBlock: any = 'latest',
      groupKeyOrCfg: any,
      options: any = null,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const slugOrEmpty = cfg && typeof cfg.slug !== 'undefined' ? cfg.slug : '';
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.sbtFactory?.address;
      const onProgress = options && typeof options.onProgress === 'function' ? options.onProgress : null;

      if (!addr) {
        contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
        return []; // neutral
      }

      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
      const sbtCreatedEventFilter = SBTFactory.filters.SBTCreated();

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        ...SBT_READ_PROVIDER_OPTIONS,
        _resolvedCfg: cfg,
      });

      const fromBlock = Number.isFinite(Number(fromCustomBlock))
        ? Math.max(Number(fromCustomBlock), baseFrom)
        : baseFrom;

      const toBlock =
        toCustomBlock === 'latest' || typeof toCustomBlock !== 'number'
          ? baseTo
          : Math.min(Number(toCustomBlock), baseTo);

      if (fromBlock > toBlock) return [];

      rpcLog('getSbtsCreated: Fetching logs:', {
        address: SBTFactory.address,
        fromBlock,
        toBlock,
      });

      const totalBlocks = Math.max(0, Number(toBlock) - Number(fromBlock) + 1);
      const rawLogs = await fetchLogsSmartWithProvider(
        provider,
        sbtCreatedEventFilter,
        fromBlock,
        toBlock,
        0,
        20,
        onProgress
          ? {
              phase: 'discover',
              fromBlock: Number(fromBlock),
              toBlock: Number(toBlock),
              totalBlocks,
              scannedBlocks: 0,
              onProgress,
            }
          : null,
      );
      const sbtCreatedEvents = rawLogs
        .map((log: any) => {
          let parsed = null;
          try {
            parsed = SBT_FACTORY_INTERFACE.parseLog(log);
          } catch {
            return null;
          }
          const sbtAddress = parsed?.args?.sbtAddress || parsed?.args?.[0] || parsed?.args?.['0'];
          if (!sbtAddress) return null;
          return { sbtAddress, blockNumber: log?.blockNumber };
        })
        .filter(Boolean);

      const creationByAddress = new Map();
      for (const ev of sbtCreatedEvents as any[]) {
        const key = String(ev.sbtAddress || '').toLowerCase();
        if (!key) continue;
        const bn = Number(ev.blockNumber);
        const normalized = Number.isFinite(bn) ? bn : null;
        const prev = creationByAddress.get(key);
        if (!prev || (normalized != null && (prev.creationBlock == null || normalized < prev.creationBlock))) {
          creationByAddress.set(key, { sbtAddress: ev.sbtAddress, creationBlock: normalized });
        }
      }

      const discovered = Array.from(creationByAddress.values());

      const results = await Promise.all(
        discovered.map(async ({ sbtAddress, creationBlock }: any) => {
          let meta = null;
          try {
            // IMPORTANT: pass through the SAME groupKeyOrCfg, not a transformed cfg
            meta = await this.getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg);
          } catch {}
          return {
            sbtAddress,
            tokenURI: meta?.tokenURI || null,
            tokenURIInfo: meta || null,
            creationBlock:
              creationBlock != null && Number.isFinite(Number(creationBlock))
                ? Math.floor(Number(creationBlock))
                : null,
          };
        }),
      );

      return results;
    },

    // Fetch a single SBT's creation block by scanning factory logs.
    // Attempts the full range first; falls back to split queries if the provider rejects wide ranges.
    async getSbtCreationBlockByAddress(
      providerName: any,
      sbtAddress: any,
      groupKeyOrCfg: any = null,
      options: any = {},
    ) {
      try {
        if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) return null;

        const metaSessionSlug =
          options?.sessionSlug ?? options?.metadata?.sessionSlug ?? options?.meta?.sessionSlug ?? null;
        const metaSessionName = options?.sessionName || options?.metadata?.sessionName || options?.meta?.sessionName;
        const metaCfg =
          metaSessionSlug != null
            ? resolveSession(normalizeSessionSlug(metaSessionSlug))
            : resolveSessionByName(metaSessionName);
        const baseCfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);

        let cfg = metaCfg || baseCfg;
        let gAddrs = getSessionAddresses(cfg);
        if (!gAddrs.sbtFactory?.address && metaCfg && baseCfg) {
          cfg = baseCfg;
          gAddrs = getSessionAddresses(cfg);
        }

        const addr = gAddrs.sbtFactory?.address;
        if (!addr) return null;

        const provider = getLocalAwareReadProviderForGroup(cfg || groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
        const sbtCreatedEventFilter = SBTFactory.filters.SBTCreated(sbtAddress);

        const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(
          cfg || groupKeyOrCfg,
          SBT_READ_PROVIDER_OPTIONS,
        );

        const logs = await fetchLogsSmartWithProvider(
          provider,
          sbtCreatedEventFilter,
          Number(baseFrom),
          Number(baseTo),
        );
        if (!Array.isArray(logs) || logs.length === 0) return null;

        let best = null;
        for (const lg of logs) {
          const bn = Number(lg?.blockNumber);
          if (Number.isFinite(bn) && (best == null || bn < best)) best = bn;
        }
        return best;
      } catch (e: any) {
        contractsLog.warn('[getSbtCreationBlockByAddress] failed:', e?.message || e);
        return null;
      }
    },

    getSbtMintBurnCountsByAddress: async function (
      providerName: any,
      sbtAddress: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      groupKeyOrCfg: any = null,
      options: any = null,
    ) {
      try {
        let groupCfg = groupKeyOrCfg;
        let opts = options;
        if (groupCfg && typeof groupCfg === 'object' && opts == null && typeof groupCfg.onProgress === 'function') {
          opts = groupCfg;
          groupCfg = null;
        }
        if (!opts || typeof opts !== 'object') opts = {};
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        const onCheckpoint = typeof opts.onCheckpoint === 'function' ? opts.onCheckpoint : null;

        if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
          contractsLog.warn('[getSbtMintBurnCountsByAddress] invalid SBT address:', sbtAddress);
          return {
            mintedCountByAddress: {},
            burnedCountByAddress: {},
            mintedEventCount: 0,
            burnedEventCount: 0,
            scannedToBlock: null,
            ok: false,
          };
        }

        const provider = getLocalAwareReadProviderForGroup(groupCfg, SBT_READ_PROVIDER_OPTIONS);

        // Clamp to group's relevant window
        const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(
          groupCfg,
          SBT_READ_PROVIDER_OPTIONS,
        );
        const f = Number.isFinite(Number(fromBlock)) ? Math.max(Number(fromBlock), baseFrom) : baseFrom;
        const t = toBlock === 'latest' || typeof toBlock !== 'number' ? baseTo : Math.min(Number(toBlock), baseTo);
        if (f > t) {
          return {
            mintedCountByAddress: {},
            burnedCountByAddress: {},
            mintedEventCount: 0,
            burnedEventCount: 0,
            scannedToBlock: Number.isFinite(Number(t)) ? Number(t) : null,
            ok: false,
          };
        }

        const sbt = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
        const totalBlocks = Math.max(0, Number(t) - Number(f) + 1);
        const normalizeCountMap = (value: any) => {
          const out = Object.create(null);
          Object.entries(value || {}).forEach(([addrRaw, countRaw]: any) => {
            const addr = String(addrRaw || '').toLowerCase();
            if (!addr) return;
            const count = Math.max(0, Math.floor(Number(countRaw || 0)));
            if (count <= 0) return;
            out[addr] = count;
          });
          return out;
        };
        const sumCountMap = (value: any) =>
          Object.values(value || {}).reduce((sum: any, count: any) => {
            const n = Math.max(0, Math.floor(Number(count || 0)));
            return sum + n;
          }, 0);
        const phaseOrder: any = { activity: 0 };
        const normalizeResumeState = (resumeIn: any) => {
          if (!resumeIn || typeof resumeIn !== 'object') return null;
          const phase = String(resumeIn.phase || '').trim();
          if (!Object.prototype.hasOwnProperty.call(phaseOrder, phase)) return null;
          const blockNumber = Math.max(f - 1, Math.min(t, Math.floor(Number(resumeIn.blockNumber ?? f - 1))));
          const mintedCountByAddress = normalizeCountMap(resumeIn.mintedCountByAddress);
          const burnedCountByAddress = normalizeCountMap(resumeIn.burnedCountByAddress);
          const mintedEventCountRaw = Math.floor(Number(resumeIn.mintedEventCount || 0));
          const burnedEventCountRaw = Math.floor(Number(resumeIn.burnedEventCount || 0));
          return {
            phase,
            blockNumber,
            mintedCountByAddress,
            burnedCountByAddress,
            mintedEventCount:
              mintedEventCountRaw > 0 ? mintedEventCountRaw : (sumCountMap(mintedCountByAddress) as number),
            burnedEventCount:
              burnedEventCountRaw > 0 ? burnedEventCountRaw : (sumCountMap(burnedCountByAddress) as number),
          };
        };
        const resumeState = normalizeResumeState(opts.resumeState);

        const mintedCountByAddress = normalizeCountMap(resumeState?.mintedCountByAddress);
        const burnedCountByAddress = normalizeCountMap(resumeState?.burnedCountByAddress);
        let mintedEventCount: number =
          Number(resumeState?.mintedEventCount || 0) || (sumCountMap(mintedCountByAddress) as number);
        let burnedEventCount: number =
          Number(resumeState?.burnedEventCount || 0) || (sumCountMap(burnedCountByAddress) as number);
        const addCount = (bucket: any, addressRaw: any) => {
          const address = String(addressRaw || '').toLowerCase();
          if (!address) return false;
          bucket[address] = (bucket[address] || 0) + 1;
          return true;
        };
        const addMintedToken = (accountRaw: any) => {
          if (addCount(mintedCountByAddress, accountRaw)) {
            mintedEventCount += 1;
          }
        };
        const addBurnedToken = (accountRaw: any) => {
          if (addCount(burnedCountByAddress, accountRaw)) {
            burnedEventCount += 1;
          }
        };
        const emitCheckpoint = (phase: any, blockNumber: any) => {
          if (!onCheckpoint) return;
          try {
            onCheckpoint({
              phase,
              blockNumber: Math.max(f - 1, Math.min(t, Math.floor(Number(blockNumber || f - 1)))),
              scanStartBlock: f,
              scanToBlock: t,
              mintedCountByAddress: { ...mintedCountByAddress },
              burnedCountByAddress: { ...burnedCountByAddress },
              mintedEventCount,
              burnedEventCount,
            });
          } catch (err: any) {
            contractsLog.warn('[getSbtMintBurnCountsByAddress] checkpoint callback failed:', err?.message || err);
          }
        };
        const getPassResumeState = (passName: any = 'activity') => {
          const passIndex = phaseOrder[passName];
          const resumePhase = resumeState?.phase || '';
          const resumeIndex = Object.prototype.hasOwnProperty.call(phaseOrder, resumePhase)
            ? phaseOrder[resumePhase]
            : null;
          if (resumeIndex == null || resumeIndex < passIndex) {
            return { skip: false, passFrom: f, initialScannedBlocks: 0 };
          }
          if (resumeIndex > passIndex) {
            return { skip: true, passFrom: t + 1, initialScannedBlocks: totalBlocks };
          }
          const checkpointBlock = Math.max(f - 1, Math.min(t, Math.floor(Number(resumeState?.blockNumber ?? f - 1))));
          return {
            skip: false,
            passFrom: Math.min(t + 1, checkpointBlock + 1),
            initialScannedBlocks: Math.max(0, checkpointBlock - f + 1),
          };
        };

        const activityResume = getPassResumeState('activity');
        if (!activityResume.skip && activityResume.passFrom <= t) {
          const activityFilter = sbt.filters.SBTActivity();
          await fetchLogsSmartWithProvider(
            provider,
            activityFilter,
            activityResume.passFrom,
            t,
            0,
            20,
            createSbtEventScanProgressState({
              onProgress,
              onLogs: ({ logs = [], scanTo }: any) => {
                logs.forEach((lg: any) => {
                  let parsed;
                  try {
                    parsed = CUSTOM_SBT_INTERFACE.parseLog(lg);
                  } catch {
                    return;
                  }
                  const account = parsed?.args?.account ?? parsed?.args?.[0];
                  const burned = parsed?.args?.burned ?? parsed?.args?.[2];
                  if (burned === true) {
                    addBurnedToken(account);
                  } else {
                    addMintedToken(account);
                  }
                });
                emitCheckpoint('activity', scanTo);
              },
              phase: 'activity',
              fromBlock: f,
              toBlock: t,
              scanTotalBlocks: totalBlocks,
              phaseTotalBlocks: totalBlocks,
              passOffsetBlocks: 0,
              initialScannedBlocks: activityResume.initialScannedBlocks,
              maxConcurrency: onCheckpoint ? 1 : null,
            }),
          );
        }

        return {
          mintedCountByAddress,
          burnedCountByAddress,
          mintedEventCount,
          burnedEventCount,
          scannedToBlock: Number.isFinite(Number(t)) ? Number(t) : null,
          ok: true,
        };
      } catch (e: any) {
        contractsLog.error('[getSbtMintBurnCountsByAddress] failed:', e);
        return {
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          scannedToBlock: null,
          ok: false,
        };
      }
    },

    getSBTsByUserAddress: async function (
      providerName: any,
      userAddress: any,
      fromBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      // Per-group base window + clamp caller override (fromBlock only)
      const { fromBlock: baseFrom } = await this.getRelevantBlockWindowForFilter(
        groupKeyOrCfg,
        SBT_READ_PROVIDER_OPTIONS,
      );
      const fromBlockNum = Number.isFinite(Number(fromBlock)) ? Math.max(Number(fromBlock), baseFrom) : baseFrom;

      const sbts = await this.getSbtsCreated('none', fromBlockNum, 'latest', groupKeyOrCfg);
      try {
        const holdings = await this.getUserSbtNetHoldings(
          'none',
          userAddress,
          { fromBlock: fromBlockNum },
          groupKeyOrCfg,
        );
        const heldSet = new Set(
          (Array.isArray(holdings?.addresses) ? holdings.addresses : [])
            .map((address: any) => normalizeAddress(address))
            .filter(Boolean),
        );
        if (heldSet.size > 0) {
          return sbts.filter((sbt: any) => heldSet.has(normalizeAddress(sbt?.sbtAddress || '')));
        }
        return [];
      } catch (error: any) {
        contractsLog.warn(
          '[getSBTsByUserAddress] holdings lookup failed; falling back to per-SBT checks:',
          error?.message || error,
        );
      }

      let claimedSBTs: any[] = [];
      for (let sbt of sbts) {
        const userHasClaimed = await this.userHasSBT(
          'none',
          sbt.sbtAddress,
          userAddress,
          fromBlockNum,
          'latest',
          groupKeyOrCfg,
        );
        if (userHasClaimed) {
          const addressesWhoMinted = await this.getAddressesWhoMintedSBT(
            'none',
            sbt.sbtAddress,
            fromBlockNum,
            'latest',
            groupKeyOrCfg,
          );
          const addressesWhoBurned = await this.getAddressesWhoBurnedSBT(
            'none',
            sbt.sbtAddress,
            fromBlockNum,
            'latest',
            groupKeyOrCfg,
          );
          if (
            addressesWhoMinted.map((a: any) => a.toLowerCase()).includes(userAddress.toLowerCase()) &&
            !addressesWhoBurned.map((a: any) => a.toLowerCase()).includes(userAddress.toLowerCase())
          ) {
            claimedSBTs.push(sbt);
          }
        }
      }
      return claimedSBTs;
    },

    async getSbtMetadata(providerName: any, sbtAddress: any, groupKeyOrCfg: any = null) {
      try {
        if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
          contractsLog.warn('[getSbtMetadata] invalid SBT address:', sbtAddress);
          return null;
        }

        // Read-only provider resolved from group
        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
        const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS);

        // Helpers (local scope)
        const normalizeUri = (u: any, options: any = {}) => {
          if (!u) return null;
          const s = String(u).trim();
          if (!s) return null;
          const arweaveNormalized = normalizeArweaveUrl(s, options);
          if (arweaveNormalized !== s) return arweaveNormalized;
          if (/^ipfs:\/\//i.test(s)) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//i, '')}`;
          return s;
        };
        const toSeconds = (v: any) => {
          if (v == null) return undefined;
          const n = Number(v);
          if (!Number.isFinite(n)) return undefined;
          if (n <= 0) return 0;
          return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
        };
        const toBlockNumber = (v: any) => {
          if (v == null) return undefined;
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return undefined;
          return Math.floor(n);
        };
        const mapBurnAuth = (raw: any) => {
          const MAP: any = { AdminOnly: 0, OwnerOnly: 1, Both: 2, Neither: 3 };
          if (typeof raw === 'number') return raw;
          if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(MAP, raw)) return MAP[raw];
          return raw;
        };
        const inferDirectImageUrl = (uriIn: any) => {
          const normalized = normalizeUri(uriIn);
          if (!normalized) return null;
          if (/^data:image\//i.test(normalized)) return normalized;
          try {
            const parsed = new URL(normalized);
            if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(parsed.pathname || '')) {
              return normalized;
            }
          } catch {
            // ignore
          }
          return null;
        };

        const extractSbtMetadataTokenURI = (metadata: unknown) => {
          if (!metadata) return null;
          const indexedTokenUri = Array.isArray(metadata) ? metadata[8] : null;
          const namedTokenUri =
            typeof metadata === 'object'
              ? (metadata as { tokenURI_?: unknown; tokenURI?: unknown }).tokenURI_ ||
                (metadata as { tokenURI_?: unknown; tokenURI?: unknown }).tokenURI ||
                null
              : null;
          return namedTokenUri || indexedTokenUri || null;
        };

        const sbt = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
        const readCollectionTokenURI = async () => {
          try {
            const metadata = await callWithRetry(() => sbt.getSBTMetadata(), 'SBT.getSBTMetadata');
            const metadataTokenURI = extractSbtMetadataTokenURI(metadata);
            if (metadataTokenURI) return metadataTokenURI;
          } catch {
            // Legacy SBTs may not expose the aggregate metadata getter.
          }

          try {
            return await callWithRetry(() => sbt.tokenURI(), 'SBT.tokenURI()');
          } catch {
            try {
              return await callWithRetry(() => sbt.tokenURI(0), 'SBT.tokenURI(0)');
            } catch {
              return null;
            }
          }
        };

        // OPTIMIZATION: Removed redundant provider.getNetwork() call.
        // We already know 'chId' from the config used to create the provider.
        const [name, symbol, admin, tokenURI_raw] = await Promise.all([
          callWithRetry(() => sbt.name(), 'SBT.name').catch(() => null),
          callWithRetry(() => sbt.symbol(), 'SBT.symbol').catch(() => null),
          (async () => {
            try {
              return await callWithRetry(() => sbt.admin(), 'SBT.admin');
            } catch {
              try {
                return await callWithRetry(() => sbt.owner(), 'SBT.owner');
              } catch {
                return ethers.constants.AddressZero;
              }
            }
          })(),
          readCollectionTokenURI(),
        ]);

        const tokenURI = normalizeUri(tokenURI_raw);

        const out: any = {
          contractName: name || null,
          name: name || null,
          symbol: symbol || null,
          admin: admin || ethers.constants.AddressZero,
          tokenURI: tokenURI || null,
          chainID: chId, // Use the config-derived chain ID
        };
        const directImageFromTokenUri = inferDirectImageUrl(tokenURI);
        if (directImageFromTokenUri) out.image = directImageFromTokenUri;

        // Merge tokenURI JSON (fail-soft)
        if (tokenURI) {
          try {
            const tokenUriLogMeta: any = {
              sbtAddress: String(sbtAddress || '').toLowerCase(),
              tokenURI,
            };
            const tokenUriArweaveTxId = parseArweaveTxId(tokenURI);
            let tokenUriMetadataTimedOut = false;
            const tokenUriOut: any = {};
            const tokenUriMetadataTask = (async () => {
              if (tokenUriArweaveTxId) {
                const tokenUriText = await downloadArweaveTextForGroup({
                  txId: tokenUriArweaveTxId,
                  groupKeyOrCfg,
                  arweaveOpts: {
                    // Honor the deployment-wide AR.IO-only toggle. Per-call
                    // fanout here previously made SBT names intermittently blank.
                    bypassFailureCache: true,
                    shortCircuitNotFound: true,
                    retries: 0,
                    gatewayTimeoutMs: Math.max(1000, SBT_TOKENURI_METADATA_TIMEOUT_MS - 500),
                    debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'sbt_metadata', {
                      fn: 'getSbtMetadata',
                      sbtAddress: String(sbtAddress || '').toLowerCase(),
                    }),
                  },
                });
                return JSON.parse(tokenUriText);
              }
              const res = await fetch(tokenURI, { headers: { accept: 'application/json' } });
              if (res && res.ok) {
                const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
                if (contentType.includes('json')) {
                  return await res.json().catch(() => null);
                }
                if (contentType.startsWith('image/')) {
                  tokenUriOut.image = tokenURI;
                }
                const text = await res.text().catch(() => '');
                if (!text) return null;
                try {
                  return JSON.parse(text);
                } catch {
                  return null;
                }
              }
              return null;
            })();
            const json = await runWithSoftTimeout(
              tokenUriMetadataTask.then((result: any) => {
                if (!tokenUriMetadataTimedOut && Object.keys(tokenUriOut).length > 0) {
                  Object.assign(out, tokenUriOut);
                  out.tokenUriMetadataFetched = true;
                }
                return result;
              }),
              {
                timeoutMs: SBT_TOKENURI_METADATA_TIMEOUT_MS,
                fallbackValue: null,
                onTimeout: () => {
                  tokenUriMetadataTimedOut = true;
                  contractsLog.warn('[getSbtMetadata] tokenURI metadata fetch timed out; using on-chain fallback', {
                    ...tokenUriLogMeta,
                    txId: tokenUriArweaveTxId || null,
                    timeoutMs: SBT_TOKENURI_METADATA_TIMEOUT_MS,
                  });
                },
              },
            );

            if (!tokenUriMetadataTimedOut && json && typeof json === 'object') {
              out.tokenUriMetadataFetched = true;
              const MASKED_SBT_FIELD_VALUE = '[encrypted]';
              const hasJsonField = (fieldKey: any) => Object.prototype.hasOwnProperty.call(json, fieldKey);
              const encryptedFields = isObj(json.encryptedFields) ? json.encryptedFields : null;
              const targets = isObj(json?.encryption?.targets) ? json.encryption.targets : {};
              const legacyEncryptedFieldKeys: any = {
                name: ['nameEncrypted', 'encryptedName'],
                description: ['descriptionEncrypted', 'encryptedDescription'],
                tags: ['tagsEncrypted', 'encryptedTags'],
                documentURLs: ['documentURLsEncrypted', 'docUrlsEncrypted'],
              };
              const isLockedField = (fieldKey: any) => {
                if (
                  encryptedFields &&
                  Object.prototype.hasOwnProperty.call(encryptedFields, fieldKey) &&
                  encryptedFields[fieldKey]
                ) {
                  return true;
                }
                if (targets?.[fieldKey] === true) return true;
                return (legacyEncryptedFieldKeys[fieldKey] || []).some((legacyKey: any) => !!json?.[legacyKey]);
              };

              if (hasJsonField('name')) {
                out.name = typeof json.name === 'string' ? json.name : '';
              } else if (!out.name) {
                if (typeof json.title === 'string') out.name = json.title;
              }
              if (encryptedFields && typeof encryptedFields === 'object') {
                out.encryptedFields = encryptedFields;
              }
              if (json.encryption && typeof json.encryption === 'object') {
                out.encryption = json.encryption;
              }
              if (encryptedFields?.name) out.nameEncrypted = encryptedFields.name;
              if (isLockedField('name')) {
                out.nameLocked = true;
                out.name = MASKED_SBT_FIELD_VALUE;
              }
              if (!isLockedField('image') && typeof json.image === 'string') {
                const normalizedImage = normalizeUri(json.image);
                if (normalizedImage) {
                  out.image = normalizedImage;
                }
              }
              if (encryptedFields?.image) out.imageEncrypted = encryptedFields.image;
              if (isLockedField('image')) {
                out.imageLocked = true;
                out.image = '';
              }
              if (typeof json.description === 'string') out.description = json.description;
              if (encryptedFields?.description) out.descriptionEncrypted = encryptedFields.description;
              if (typeof json.descriptionEncrypted === 'string') out.descriptionEncrypted = json.descriptionEncrypted;
              if (typeof json.encryptedDescription === 'string') out.descriptionEncrypted = json.encryptedDescription;
              if (json.descriptionAccess && typeof json.descriptionAccess === 'object') {
                out.descriptionAccess = json.descriptionAccess;
              }
              if ((out.description == null || out.description === '') && out.descriptionEncrypted) {
                out.description = '';
              }
              if (out.descriptionEncrypted) out.descriptionLocked = true;
              if (encryptedFields?.tags) out.tagsEncrypted = encryptedFields.tags;
              if (typeof json.tagsEncrypted === 'string') out.tagsEncrypted = json.tagsEncrypted;
              if (typeof json.encryptedTags === 'string') out.tagsEncrypted = json.encryptedTags;
              if (json.tagsAccess && typeof json.tagsAccess === 'object') {
                out.tagsAccess = json.tagsAccess;
              }
              if (encryptedFields?.documentURLs) out.documentURLsEncrypted = encryptedFields.documentURLs;
              if (typeof json.documentURLsEncrypted === 'string')
                out.documentURLsEncrypted = json.documentURLsEncrypted;
              if (typeof json.docUrlsEncrypted === 'string') out.documentURLsEncrypted = json.docUrlsEncrypted;
              if (json.documentURLsAccess && typeof json.documentURLsAccess === 'object') {
                out.documentURLsAccess = json.documentURLsAccess;
              }
              if (json.encryptedFieldGates && typeof json.encryptedFieldGates === 'object') {
                out.encryptedFieldGates = json.encryptedFieldGates;
              }

              const secs = toSeconds(json.mintingEndTime);
              if (secs !== undefined) out.mintingEndTime = secs; // 0 = never

              if (typeof json.unlisted === 'boolean') out.unlisted = json.unlisted;
              if (json.burnAuth !== undefined) out.burnAuth = mapBurnAuth(json.burnAuth);

              if (typeof json.hasPasswordMint === 'boolean') out.hasPasswordMint = !!json.hasPasswordMint;
              if (json.maxTokens != null) out.maxTokens = String(json.maxTokens);

              if (Array.isArray(json.tags)) out.tags = json.tags;
              if (out.tags == null && out.tagsEncrypted) out.tags = [];
              if (out.tagsEncrypted) out.tagsLocked = true;
              const documentUrlValue =
                json.documentURLs ||
                json.documentUrls ||
                json.docURLs ||
                json.docUrls ||
                json.documentURL ||
                json.documentUrl ||
                json.docURL ||
                json.docUrl ||
                null;
              if (Array.isArray(documentUrlValue)) {
                out.documentURLs = documentUrlValue.filter(Boolean);
              } else if (typeof documentUrlValue === 'string' && documentUrlValue.trim()) {
                out.documentURLs = [documentUrlValue.trim()];
              } else if (Array.isArray(json.documents)) {
                out.documentURLs = json.documents
                  .map((entry: any) => {
                    if (typeof entry === 'string') return entry.trim();
                    if (entry && typeof entry === 'object') {
                      const record = entry as Record<string, unknown>;
                      return String(
                        record.url ||
                          record.href ||
                          record.link ||
                          record.documentURL ||
                          record.documentUrl ||
                          record.docURL ||
                          record.docUrl ||
                          record.value ||
                          '',
                      ).trim();
                    }
                    return '';
                  })
                  .filter(Boolean);
              }
              if (out.documentURLs == null) out.documentURLs = [];
              if (out.documentURLsEncrypted) out.documentURLsLocked = true;
              if (typeof json.creator === 'string') out.creator = json.creator;
              if (typeof json.sessionSlug === 'string') out.sessionSlug = json.sessionSlug;
              if (!out.sessionSlug && typeof json.slug === 'string') out.sessionSlug = json.slug;
              if (typeof json.sessionName === 'string') out.sessionName = json.sessionName;
              if (json.network !== undefined) out.network = json.network;

              const creationBlock = toBlockNumber(
                json.creationBlock ??
                  json.createdBlock ??
                  json.sbtCreatedBlock ??
                  json.creation_block ??
                  json.created_block,
              );
              if (creationBlock !== undefined) out.creationBlock = creationBlock;
            } else if (!tokenUriMetadataTimedOut) {
              out.tokenUriMetadataFetched = true;
            }
          } catch {}
        }

        // Always prefer on-chain mint flags over tokenURI hints when the reads succeed.
        {
          const FRAG: any[] = [
            'function maxTokens() view returns (uint256)',
            'function collectionBurnAuth() view returns (uint8)',
            'function mintingEndTime() view returns (uint256)',
            'function hasPasswordMint() view returns (bool)',
            'function mintMode() view returns (uint8)',
          ];
          const c = new ethers.Contract(sbtAddress, FRAG, provider as any);
          const mintModeRead =
            typeof c.mintMode === 'function' ? c.mintMode().catch(() => null) : Promise.resolve(null);
          const [max, burn, end, hasPw, mintMode] = await Promise.all([
            c.maxTokens().catch(() => null),
            c.collectionBurnAuth().catch(() => null),
            c.mintingEndTime().catch(() => null),
            c.hasPasswordMint().catch(() => null),
            mintModeRead,
          ]);

          if (max != null) out.maxTokens = ethers.BigNumber.isBigNumber(max) ? max.toString() : String(max);
          if (burn != null) out.burnAuth = Number(ethers.BigNumber.isBigNumber(burn) ? burn.toNumber() : burn);
          if (end != null)
            out.mintingEndTime = toSeconds(ethers.BigNumber.isBigNumber(end) ? end.toNumber() : Number(end));
          if (mintMode != null) {
            out.mintMode = Number(ethers.BigNumber.isBigNumber(mintMode) ? mintMode.toNumber() : mintMode);
            out.hasPasswordMint = hasPasswordMintForSbtMintMode(out.mintMode);
          } else if (hasPw != null) {
            out.hasPasswordMint = !!hasPw;
          }
        }

        // Final guard: ensure mintingEndTime is normalized to seconds if present
        if (out.mintingEndTime != null) {
          const n = Number(out.mintingEndTime);
          out.mintingEndTime = n > 1e12 ? Math.floor(n / 1000) : Math.max(0, Math.floor(n));
        }

        if (!out.admin_ && out.admin) out.admin_ = out.admin;
        const adminNormalized = normalizeAddress(out.admin || out.admin_ || '');
        const hasAdminAddress = !!adminNormalized && adminNormalized !== normalizeAddress(ethers.constants.AddressZero);
        if (hasAdminAddress && !out.deployer) out.deployer = adminNormalized;
        if (hasAdminAddress && (!out.creator || !String(out.creator).trim())) {
          out.creator = adminNormalized;
        }

        const fallbackSessionSlug = normalizeSessionSlug(cfg?.slug || '');
        normalizeSbtSessionLinkFields(out, fallbackSessionSlug);

        const fallbackSessionName = (() => {
          const fromCfg = resolveSessionNameValue(cfg || {});
          if (fromCfg) return fromCfg;
          return fallbackSessionSlug || 'general';
        })();
        normalizeSessionNameFields(out, fallbackSessionName);

        return out;
      } catch (e: any) {
        contractsLog.error('[getSbtMetadata] failed:', e);
        return null;
      }
    },
  };
};
