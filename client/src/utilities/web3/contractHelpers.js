/**
 * @module contractHelpers
 * @description Read-only provider helpers and shared contract utility methods extracted from contractScripts.
 *              Keeps RPC/block-window logic isolated from session, survey, and SBT domain methods.
 *
 * Key exports: createContractHelperMethods
 */

import { ethers, utils } from 'ethers';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import {
  clearSponsoredBootstrapFaucetGrantToken,
  readSponsoredBootstrapFundingContext,
} from '../session/sponsoredBootstrapFunding.js';

const normalizeFundingErrorMessage = (error) => (
  String(error?.message || error || '').trim().toLowerCase()
);

const isMissingLocalFaucetKeyFundingError = (error) => {
  const stage = String(error?.stage || '').trim().toLowerCase();
  const status = Number(error?.status || 0);
  const message = normalizeFundingErrorMessage(error);
  return (
    stage === 'faucet-request' &&
    status === 401 &&
    message.includes('faucetprivatekey is missing')
  );
};

const isRetryableSponsoredBootstrapFundingError = (error) => {
  const stage = String(error?.stage || '').trim().toLowerCase();
  const status = Number(error?.status || 0);
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

export function createContractHelperMethods(deps) {
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
    getCorsProxyUrlOrThrow,
    fetchWorkerWithAuth,
    fetchImpl = (...args) => fetch(...args),
  } = deps;

  const resolveChainIdForRead = (cfg, contractKey = '') => {
    const normalizedContractKey = String(contractKey || '').trim();
    const preferredCandidates = normalizedContractKey === 'sbtFactory'
      ? [
          cfg?.contracts?.sbtFactory?.chainId,
          cfg?.networkChainId,
          cfg?.contracts?.surveys?.chainId,
        ]
      : normalizedContractKey === 'surveys'
        ? [
            cfg?.contracts?.surveys?.chainId,
            cfg?.networkChainId,
            cfg?.contracts?.sbtFactory?.chainId,
          ]
        : [
            cfg?.networkChainId,
            cfg?.contracts?.surveys?.chainId,
            cfg?.contracts?.sbtFactory?.chainId,
          ];

    const orderedCandidates = preferredCandidates.concat([0]);
    for (const candidate of orderedCandidates) {
      const id = Number(candidate || 0);
      if (Number.isFinite(id) && id > 0) return Math.floor(id);
    }
    return 0;
  };

  const buildProviderScopeCacheKey = ({
    provider,
    groupKeyOrCfg,
    chainId,
    contractKey = '',
  } = {}) => {
    const providerMeta = provider && typeof provider === 'object' ? provider.__CE_RPC_META : null;
    const preferredUrls = Array.isArray(providerMeta?.preferredUrls)
      ? providerMeta.preferredUrls.map((url) => String(url || '').trim()).filter(Boolean).join(',')
      : '';
    const fallbackGroupKey = (() => {
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

  return {
    async getLatestBlockNumber(providerName = 'none', groupKeyOrCfg = null, opts = null) {
      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const contractKey = String(opts?.contractKey || '').trim();
      const chId = resolveChainIdForRead(cfg, contractKey);
      const force = !!(opts && opts.force === true);
      const provider = getReadProviderForGroup(
        groupKeyOrCfg,
        contractKey ? { contractKey } : undefined
      );

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
        (groupKeyOrCfg && groupKeyOrCfg.slug) ||
        null;
      slot.promise = callWithRetry(
        () => provider.getBlockNumber(),
        'getBlockNumber',
        { op: 'getBlockNumber', chainId: chId || null, groupKey }
      );

      return slot.promise
        .then((bn) => {
          slot.value = bn;
          slot.promise = null;
          slot.ts = Date.now();
          return bn;
        })
        .catch((error) => {
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

    async getGasPrice(groupKeyOrCfg = null) {
      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = resolveChainIdForRead(cfg, '');
      const provider = getReadProviderForGroup(groupKeyOrCfg);

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
        (groupKeyOrCfg && groupKeyOrCfg.slug) ||
        null;
      slot.promise = callWithRetry(
        () => provider.getGasPrice(),
        'getGasPrice',
        { op: 'getGasPrice', chainId: chId || null, groupKey }
      )
        .then((bn) => {
          slot.value = bn;
          slot.promise = null;
          slot.ts = Date.now();
          return bn;
        })
        .catch((error) => {
          slot.value = null;
          slot.promise = null;
          slot.ts = 0;
          throw error;
        });

      return slot.promise;
    },

    async getBlockWithCaching(providerPassedIn, blockNumber, providerName = 'none', chainKey = 'default') {
      const key = `${String(chainKey)}_${String(blockNumber)}`;
      if (this._blockCache[key] && (Date.now() - this._blockCache[key].timestamp < BLOCK_CACHE_MS)) {
        return this._blockCache[key].block;
      }

      const block = await callWithRetry(
        () => providerPassedIn.getBlock(blockNumber),
        `getBlock(${blockNumber})`
      );
      const now = Date.now();
      Object.keys(this._blockCache).forEach((cacheKey) => {
        if (now - (this._blockCache[cacheKey]?.timestamp || 0) >= BLOCK_CACHE_MS) {
          delete this._blockCache[cacheKey];
        }
      });

      this._blockCache[key] = { block, timestamp: now };

      const keys = Object.keys(this._blockCache);
      if (keys.length > MAX_CACHE_SIZE) {
        keys.sort(
          (a, b) => (this._blockCache[a]?.timestamp || 0) - (this._blockCache[b]?.timestamp || 0)
        );
        for (let i = 0; i < keys.length - MAX_CACHE_SIZE; i += 1) {
          delete this._blockCache[keys[i]];
        }
      }
      return block;
    },

    async fetchLogsSmart(filter, fromBlock, toBlock, depth = 0, maxDepth = 20, groupKeyOrCfg = '') {
      if (fromBlock > toBlock) return [];
      const rangeName = `logs[${fromBlock}-${toBlock}]`;
      const providerForLogs = getReadProviderForGroup(groupKeyOrCfg);

      try {
        return await callWithRetry(
          () => providerForLogs.getLogs({ ...filter, fromBlock, toBlock }),
          `getLogs ${rangeName}`,
          {
            op: 'getLogs',
            fromBlock,
            toBlock,
            groupKey:
              (typeof groupKeyOrCfg === 'string' && groupKeyOrCfg) ||
              (groupKeyOrCfg && groupKeyOrCfg.slug) ||
              null,
          }
        );
      } catch (error) {
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

    async getNativeBalance(address, groupKeyOrCfg = null) {
      if (!address || !ethers.utils.isAddress(address)) {
        contractsLog.warn('[getNativeBalance] invalid address supplied:', address);
        return ethers.BigNumber.from(0);
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = Number(
        cfg?.networkChainId ||
        cfg?.contracts?.surveys?.chainId ||
        cfg?.contracts?.sbtFactory?.chainId ||
        0
      ) || 0;

      const provider = getReadProviderForGroup(groupKeyOrCfg);

      rpcLog('RPC Call:', {
        function: 'getNativeBalance',
        method: 'provider.getBalance',
        chainId: chId || null,
        groupKeyOrCfg,
        params: { address },
      });

      return callWithRetry(
        () => provider.getBalance(address),
        'provider.getBalance (getNativeBalance)'
      );
    },

    async getRelevantBlockWindowForFilter(groupKeyOrCfg, opts = null) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const slug = normalizeSessionSlug(cfg?.slug || '');
      const contractKey = String(opts?.contractKey || '').trim();
      const forceLatestBlock = !!(
        (
          groupKeyOrCfg &&
          typeof groupKeyOrCfg === 'object' &&
          groupKeyOrCfg.__forceLatestBlock === true
        ) ||
        (
          opts &&
          typeof opts === 'object' &&
          opts.__forceLatestBlock === true
        )
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
      const hasOwn = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
      const resolveRequiredStart = async () => {
        const slugLabel = slug || 'general';
        const hasStartField = hasOwn(lim, 'start');
        const rawStart = hasStartField ? lim.start : undefined;
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
          } catch (e) { contractsLog.warn('contractHelpers: fallback', e); }
          contractsLog.warn(
            '[blockLimits] Recovered missing blockLimits.start from SessionRegistry.SessionCreated.',
            {
              slug: slugLabel,
              chainId: Number(cfg?.networkChainId || DEFAULT_CHAIN_ID || 0) || null,
              start: fallbackStart,
            }
          );
          return fallbackStart;
        }

        throw new Error(
          `[blockLimits] Missing or invalid required blockLimits.start for session "${slugLabel}". ` +
          'Set a positive start block in SessionConfig.'
        );
      };

      const start = await resolveRequiredStart();

      try {
        const latest = await this.getLatestBlockNumber(
          'none',
          groupKeyOrCfg,
          {
            ...(forceLatestBlock ? { force: true } : {}),
            ...(contractKey ? { contractKey } : {}),
          }
        );

        const end = (lim && lim.end != null) ? Number(lim.end) : null;

        let fromBlock = Math.max(0, Math.floor(start));
        let toBlock = (end != null && Number.isFinite(end))
          ? Math.min(latest, Math.floor(end))
          : latest;
        if (toBlock < fromBlock) toBlock = fromBlock;

        return { fromBlock, toBlock };
      } catch (error) {
        contractsLog.warn('[blockLimits] Failed to fetch latest block; falling back to start block only.', {
          slug: slug || 'general',
          start,
          error: error?.message || String(error),
        });
        return { fromBlock: start, toBlock: start };
      }
    },

    async sendTestnetFunds(recipientAddress, groupKeyOrCfg = null, opts = null) {
      try {
        if (!recipientAddress || !ethers.utils.isAddress(recipientAddress)) {
          throw new Error('Invalid recipient address');
        }

        const activeSlug = (() => {
          try {
            const sessionState = store?.getState?.()?.sessionState || {};
            return sessionState?.activeSessionSlug || sessionState?.activeSessionSlug || '';
          } catch {
            return '';
          }
        })();
        const requestedSessionSlug = normalizeSessionSlug(
          typeof groupKeyOrCfg === 'string'
            ? groupKeyOrCfg
            : (groupKeyOrCfg?.slug || activeSlug || '')
        );
        const cfg = typeof groupKeyOrCfg === 'object' && groupKeyOrCfg
          ? groupKeyOrCfg
          : getSessionConfigBySlug(requestedSessionSlug || '');
        const resolvedSessionSlug = normalizeSessionSlug(cfg?.slug || requestedSessionSlug || '');

        const requestOptions = (opts && typeof opts === 'object') ? opts : {};
        const contextOverride = (
          requestOptions.context &&
          typeof requestOptions.context === 'object' &&
          !Array.isArray(requestOptions.context)
        ) ? requestOptions.context : {};
        const state = store?.getState?.();
        const profile = state?.profile || {};
        const network = profile.network || {};
        const overrideChainId = contextOverride.chainId ?? contextOverride.networkChainId ?? null;
        const context = {
          account: contextOverride.account || profile.account || '',
          providerLike: contextOverride.providerLike || profile.provider || 'wagmi',
          chainId: overrideChainId || network.id || network.chainId || cfg?.networkChainId || null,
        };
        const requestBody = {
          action: 'request_test_eth',
          to: recipientAddress,
        };
        ['amountEth', 'amount', 'sbtAddress', 'hashedPassword', 'groupPasswordHash', 'signature'].forEach((key) => {
          if (
            requestOptions[key] !== undefined &&
            requestOptions[key] !== null &&
            String(requestOptions[key]).trim() !== ''
          ) {
            requestBody[key] = requestOptions[key];
          }
        });
        const requestWithWorker = async ({ sessionSlug, sessionConfig, workerUrlOverride } = {}) => {
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
            } catch (error) {
              const wrapped = new Error(error?.message || 'Worker URL unavailable for requested session');
              wrapped.stage = 'worker-url-resolution';
              throw wrapped;
            }
          }
          const baseUrl = corsWorkerUrl.replace(/\/+$/, '');

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
            }
          );

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            const wrapped = new Error(data?.error || `Faucet request failed (${res.status})`);
            wrapped.stage = 'faucet-request';
            wrapped.status = Number(res.status || 0) || 0;
            wrapped.reason = data?.reason || '';
            wrapped.details = data?.details || null;
            throw wrapped;
          }
          return data;
        };
        const sponsoredBootstrapFundingContext = readSponsoredBootstrapFundingContext();
        const bootstrapSessionSlug = normalizeSessionSlug(sponsoredBootstrapFundingContext?.sessionSlug || '');
        const bootstrapWorkerUrl = sponsoredBootstrapFundingContext?.workerUrl || '';
        const bootstrapTargetSessionSlug = normalizeSessionSlug(sponsoredBootstrapFundingContext?.targetSessionSlug || '');
        const bootstrapFaucetGrantToken = String(sponsoredBootstrapFundingContext?.faucetGrantToken || '').trim();

        const requestWithSponsoredFaucetGrant = async ({ workerUrl, faucetGrantToken } = {}) => {
          const baseUrl = String(workerUrl || '').trim().replace(/\/+$/, '');
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
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (Number(res.status || 0) === 404) {
              clearSponsoredBootstrapFaucetGrantToken();
            }
            const wrapped = new Error(data?.error || `Faucet request failed (${res.status})`);
            wrapped.stage = 'faucet-request';
            wrapped.status = Number(res.status || 0) || 0;
            wrapped.reason = data?.reason || '';
            wrapped.details = data?.details || null;
            throw wrapped;
          }
          clearSponsoredBootstrapFaucetGrantToken();
          return data;
        };

        try {
          return await requestWithWorker({
            sessionSlug: resolvedSessionSlug,
            sessionConfig: cfg,
          });
        } catch (primaryError) {
          const shouldRetryWithSponsoredBootstrap = (
            (bootstrapSessionSlug || bootstrapWorkerUrl) &&
            bootstrapTargetSessionSlug === resolvedSessionSlug &&
            (
              bootstrapSessionSlug !== resolvedSessionSlug ||
              !!bootstrapWorkerUrl
            ) &&
            isRetryableSponsoredBootstrapFundingError(primaryError)
          );
          if (!shouldRetryWithSponsoredBootstrap) {
            throw primaryError;
          }
          if (isMissingLocalFaucetKeyFundingError(primaryError)) {
            // Bootstrap faucet grants are single-use; once consumed, later
            // requests must come from the deployed session's own faucet key.
            if (bootstrapFaucetGrantToken && bootstrapWorkerUrl) {
              try {
                return await requestWithSponsoredFaucetGrant({
                  workerUrl: bootstrapWorkerUrl,
                  faucetGrantToken: bootstrapFaucetGrantToken,
                });
              } catch (grantError) {
                if (Number(grantError?.status || 0) === 404) {
                  throw primaryError;
                }
                throw grantError;
              }
            }
            throw primaryError;
          }
          if (bootstrapFaucetGrantToken && bootstrapWorkerUrl) {
            try {
              return await requestWithSponsoredFaucetGrant({
                workerUrl: bootstrapWorkerUrl,
                faucetGrantToken: bootstrapFaucetGrantToken,
              });
            } catch (grantError) {
              if (Number(grantError?.status || 0) !== 404) {
                throw grantError;
              }
            }
          }
          const bootstrapConfig = bootstrapSessionSlug
            ? getSessionConfigBySlug(bootstrapSessionSlug)
            : null;
          return await requestWithWorker({
            sessionSlug: bootstrapSessionSlug,
            sessionConfig: bootstrapConfig,
            workerUrlOverride: bootstrapWorkerUrl,
          });
        }
      } catch (error) {
        const wrapped = new Error(`Failed to request test ETH: ${error.message}`);
        wrapped.stage = error?.stage || '';
        wrapped.status = Number(error?.status || 0) || 0;
        wrapped.reason = error?.reason || '';
        wrapped.details = error?.details || null;
        throw wrapped;
      }
    },

    async getGasPriceToDisplay(groupKeyOrCfg = null) {
      const gasPriceBN = await this.getGasPrice(groupKeyOrCfg);
      return utils.formatUnits(gasPriceBN, 'gwei');
    },
  };
}
