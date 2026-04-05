/**
 * @module contractProfile
 * @description SBT universe discovery and profile/activity wrappers extracted from contractScripts.
 *              These methods are high-context but mostly read-only, so they live separately from the core contract entry point.
 *
 * Key exports: createContractProfileMethods
 */

import { ethers } from 'ethers';
import { extractChainId, extractChainIdOrUndefined } from './chainIdResolution.js';

const SBT_READ_PROVIDER_OPTIONS = Object.freeze({ contractKey: 'sbtFactory' });

export function createContractProfileMethods(deps) {
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

  return {
    async getSBTTokenIdByOwner(providerName, SBTAddress, ownerAddress, groupKeyOrCfg = null) {
      const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider);
      try {
        rpcLog('RPC Call:', {
          function: 'getSBTTokenIdByOwner',
          method: 'CustomSBT.getTokenIdByOwner',
          params: { ownerAddress },
        });
        const tokenId = await callWithRetry(
          () => CustomSBT.getTokenIdByOwner(ownerAddress),
          'CustomSBT.getTokenIdByOwner'
        );
        return tokenId.toString();
      } catch {
        return null;
      }
    },

    async getOwnerByTokenId(providerName, SBTAddress, tokenId, groupKeyOrCfg = null) {
      const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider);
      try {
        rpcLog('RPC Call:', {
          function: 'getOwnerByTokenId',
          method: 'CustomSBT.ownerOf',
          params: { tokenId },
        });
        return await callWithRetry(() => CustomSBT.ownerOf(tokenId), 'CustomSBT.ownerOf');
      } catch (error) {
        const errorName = error?.errorName || error?.error?.errorName || '';
        if (isNonexistentTokenError(error)) {
          contractsLog.debug('[getOwnerByTokenId] token not minted', { tokenId, SBTAddress, errorName });
        } else {
          contractsLog.error('Error getting owner for token ID:', error);
        }
        return null;
      }
    },

    async getAllSbtAddressesCached(providerName, groupKeyOrCfg = null, options = {}) {
      const self = this.getAllSbtAddressesCached || this['getAllSbtAddressesCached'];
      if (!self._memo) self._memo = {};
      if (!self._inflight) self._inflight = {};
      if (!self._runVersion) self._runVersion = {};
      const forceRefresh = !!(options && options.force === true);
      const rawFromBlock = options && Object.prototype.hasOwnProperty.call(options, 'fromBlock')
        ? Number(options.fromBlock)
        : null;
      const rawToBlock = options && Object.prototype.hasOwnProperty.call(options, 'toBlock')
        ? Number(options.toBlock)
        : null;
      const explicitFromBlock = Number.isFinite(rawFromBlock)
        ? Math.max(0, Math.floor(rawFromBlock))
        : null;
      const explicitToBlock = Number.isFinite(rawToBlock)
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
      const chId = gAddrs.sbtFactory?.chainId || extractChainIdOrUndefined(cfg, { contractKey: 'sbtFactory' });

      if (!addr) {
        contractsLog.log('No SBT factory address in group config:', slugOrEmpty);
        return [];
      }

      const memoKey = `${buildSbtScopeMemoTag(groupKeyOrCfg, cfg)}:${explicitFromBlock != null ? explicitFromBlock : 'auto'}:${explicitToBlock != null ? explicitToBlock : 'auto'}`;

      const TTL_MS = 60 * 1000;
      const now = Date.now();
      const hit = self._memo[memoKey];
      if (!forceRefresh && hit && (now - hit.ts) < TTL_MS && Array.isArray(hit.value)) {
        return hit.value;
      }
      if (!forceRefresh && self._inflight[memoKey]) return self._inflight[memoKey];
      const runVersion = bumpSbtMemoRunVersion(self, memoKey);

      let run;
      run = (async () => {
        try {
          const provider = getReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
          const factory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider);
          const filter = factory.filters.SBTCreated();
          const addrs = new Set();
          const emittedAddresses = new Set();

          let fromBlock = explicitFromBlock;
          let toBlock = explicitToBlock;
          if (fromBlock == null || toBlock == null) {
            const blockWindow = await this.getRelevantBlockWindowForFilter(
              groupKeyOrCfg,
              SBT_READ_PROVIDER_OPTIONS
            );
            if (fromBlock == null) fromBlock = Number(blockWindow?.fromBlock);
            if (toBlock == null) toBlock = Number(blockWindow?.toBlock);
          }

          if (fromBlock > toBlock) {
            if (isLatestSbtMemoRun(self, memoKey, runVersion)) {
              self._memo[memoKey] = { ts: Date.now(), value: [] };
            }
            return [];
          }

          if (shouldLog('rpc', 'log')) {
            rpcLog('[RPC_DEBUG_TRIGGER] getAllSbtAddressesCached -> getLogs', {
              fromBlock,
              toBlock,
              addr,
              chId,
            });
          }

          const totalBlocks = Math.max(0, Number(toBlock) - Number(fromBlock) + 1);
          const collectAddressesFromLogs = (logs = []) => {
            const next = [];
            (Array.isArray(logs) ? logs : []).forEach((log) => {
              try {
                const event = factory.interface.parseLog(log);
                const address = String(event?.args?.sbtAddress ?? event?.args?.[0] ?? '').trim();
                if (!address) return;
                addrs.add(address);
                next.push(address);
              } catch (e) { contractsLog.warn('contractProfile: fallback', e); }
            });
            return next;
          };
          const emitDiscoveredAddresses = (addresses = [], scanTo = null) => {
            if (typeof onDiscoveredAddresses !== 'function') return;
            const fresh = [];
            (Array.isArray(addresses) ? addresses : []).forEach((addressRaw) => {
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
                fromBlock: Number(fromBlock),
                toBlock: Number(toBlock),
              });
            } catch (e) { contractsLog.warn('contractProfile: fallback', e); }
          };
          const rawLogs = await fetchLogsSmartWithProvider(
            provider,
            filter,
            fromBlock,
            toBlock,
            0,
            20,
            (onProgress || onDiscoveredAddresses) ? {
              phase: 'discover',
              fromBlock: Number(fromBlock),
              toBlock: Number(toBlock),
              totalBlocks,
              scannedBlocks: 0,
              onProgress,
              onLogs: onDiscoveredAddresses
                ? ({ logs = [], scanTo }) => {
                  emitDiscoveredAddresses(
                    collectAddressesFromLogs(logs),
                    scanTo
                  );
                }
                : null,
            } : null
          );
          collectAddressesFromLogs(rawLogs);
          emitDiscoveredAddresses(Array.from(addrs), toBlock);
          const result = Array.from(addrs);
          if (isLatestSbtMemoRun(self, memoKey, runVersion)) {
            self._memo[memoKey] = { ts: Date.now(), value: result };
          }
          return result;
        } finally {
          if (self._inflight[memoKey] === run) {
            delete self._inflight[memoKey];
          }
        }
      })();

      if (!forceRefresh) {
        self._inflight[memoKey] = run;
      }
      return run;
    },

    async getUserSbtNetHoldings(providerName, userAddress, options = {}, groupKeyOrCfg = null) {
      const self = this.getUserSbtNetHoldings || this['getUserSbtNetHoldings'];
      if (!self._memo) self._memo = {};
      if (!self._inflight) self._inflight = {};

      if (!userAddress || !ethers.utils.isAddress(userAddress)) {
        throw new Error('getUserSbtNetHoldings: userAddress (0x...) is required');
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS);

      if (shouldLog('rpc', 'log')) {
        rpcLog('RPC Call:', {
          function: 'getUserSbtNetHoldings',
          scope: 'per-user',
          user: userAddress.toLowerCase(),
          groupKeyOrCfg,
          chainId: chId || null,
          fromBlock: options.fromBlock || 0,
        });
      }

      const fromKey = options.fromBlock != null ? Number(options.fromBlock) : 'full';
      const toKey = options.toBlock != null ? options.toBlock : 'latest';
      const scopedGroupRef = (options && options.ignoreScope)
        ? { ...(cfg && typeof cfg === 'object' ? cfg : {}), __ignoreSessionScanScope: true }
        : groupKeyOrCfg;
      const memoScopeTag = buildSbtScopeMemoTag(
        scopedGroupRef,
        scopedGroupRef && typeof scopedGroupRef === 'object' ? scopedGroupRef : null
      );
      const memoKey = `${userAddress.toLowerCase()}:${fromKey}:${toKey}:${memoScopeTag}`;

      const TTL_MS = 45 * 1000;
      const now = Date.now();
      const hit = self._memo[memoKey];
      if (hit && (now - hit.ts) < TTL_MS) return hit.value;
      if (self._inflight[memoKey]) return self._inflight[memoKey];

      const run = (async () => {
        try {
          const universe = await this.getAllSbtAddressesCached('none', scopedGroupRef);
          if (!Array.isArray(universe) || universe.length === 0) {
            const empty = { addresses: [] };
            self._memo[memoKey] = { ts: Date.now(), value: empty };
            return empty;
          }

          const held = [];
          const BATCH_SIZE = 10;
          const balanceAbi = ['function balanceOf(address owner) view returns (uint256)'];
          const balanceContracts = new Map();
          const readProvider = getReadProviderForGroup(scopedGroupRef, SBT_READ_PROVIDER_OPTIONS);
          const getBalanceContract = (addr) => {
            const key = String(addr || '').toLowerCase();
            if (!key) return null;
            if (balanceContracts.has(key)) return balanceContracts.get(key);
            const contract = new ethers.Contract(addr, balanceAbi, readProvider);
            balanceContracts.set(key, contract);
            return contract;
          };

          for (let i = 0; i < universe.length; i += BATCH_SIZE) {
            const batch = universe.slice(i, i + BATCH_SIZE);

            const results = await Promise.all(
              batch.map(async (addr) => {
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
                } catch (error) {
                  try {
                    const tokenIdStr = await this.getSBTTokenIdByOwner(
                      'none',
                      addr,
                      userAddress,
                      scopedGroupRef
                    );
                    if (!tokenIdStr) return null;
                    const trimmed = tokenIdStr.toString();
                    if (trimmed === '0' || trimmed === '0x0') return null;
                    return addr;
                  } catch (tokenError) {
                    contractsLog.warn(
                      `[getUserSbtNetHoldings] balance/token check failed for ${addr}:`,
                      tokenError?.message || tokenError
                    );
                    return null;
                  }
                }
              })
            );

            results.forEach((addr) => {
              if (addr) held.push(addr);
            });

            if (i + BATCH_SIZE < universe.length) {
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
            }
          }

          const uniqueHeld = Array.from(new Set(held));
          const value = { addresses: uniqueHeld };
          self._memo[memoKey] = { ts: Date.now(), value };
          return value;
        } finally {
          delete self._inflight[memoKey];
        }
      })();

      self._inflight[memoKey] = run;
      return run;
    },

    async getUserSBTsMinimal(providerName, userAddress, withMetadata = true, groupKeyOrCfg = null, options = {}) {
      const self = this.getUserSBTsMinimal || this['getUserSBTsMinimal'];
      if (!self._memo) self._memo = {};
      if (!self._inflight) self._inflight = {};

      if (!userAddress || typeof userAddress !== 'string' || userAddress.length !== 42) {
        throw new Error('getUserSBTsMinimal: userAddress (0x...) is required');
      }

      const cfg = resolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS);

      const fromBlock = options.fromBlock || 0;
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
      const hit = self._memo[memoKey];
      if (hit && (now - hit.ts) < TTL_MS) return hit.value;
      if (self._inflight[memoKey]) return self._inflight[memoKey];

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

      const run = (async () => {
        try {
          const { addresses } = await this.getUserSbtNetHoldings(
            providerName,
            userAddress,
            options,
            groupKeyOrCfg
          );
          if (!withMetadata) {
            const bare = addresses.map((address) => ({ sbtAddress: address }));
            self._memo[memoKey] = { ts: Date.now(), value: bare };
            return bare;
          }

          const fallbackSessionSlug = normalizeSessionSlug(cfg?.slug || '');
          const fallbackSessionName = (() => {
            const fromCfg = resolveSessionNameValue(cfg || {});
            if (fromCfg) return fromCfg;
            return fallbackSessionSlug || 'general';
          })();
          const normalizeSbtInfoSessionNames = (rawInfo) => {
            const info = (rawInfo && typeof rawInfo === 'object') ? { ...rawInfo } : {};
            normalizeSbtSessionLinkFields(info, fallbackSessionSlug);
            const hasSessionName = !!resolveSessionNameValue(info || {});
            if (!hasSessionName && !fallbackSessionName) return info;
            return normalizeSessionNameFields(info, fallbackSessionName);
          };

          const out = [];
          const BATCH = 6;
          for (let i = 0; i < addresses.length; i += BATCH) {
            const batch = addresses.slice(i, i + BATCH);
            const metas = await Promise.all(batch.map(async (addr) => {
              try {
                const info = await this.getSbtMetadata(providerName, addr, groupKeyOrCfg);
                const normalizedInfo = normalizeSbtInfoSessionNames(info);
                if (normalizedInfo) return { sbtAddress: addr, sbtInfo: normalizedInfo };
                return { sbtAddress: addr };
              } catch (_) {
                const fallbackInfo = normalizeSbtInfoSessionNames(null);
                if (fallbackInfo) return { sbtAddress: addr, sbtInfo: fallbackInfo };
                return { sbtAddress: addr };
              }
            }));
            out.push(...metas);
          }
          self._memo[memoKey] = { ts: Date.now(), value: out };
          return out;
        } finally {
          delete self._inflight[memoKey];
        }
      })();

      self._inflight[memoKey] = run;
      return run;
    },

    async getSBTsForUser(address, slug, fromBlock = 0, opts = {}) {
      const returnMeta = !!(opts && opts.returnMeta);
      const ignoreScope = !!(opts && opts.ignoreScope);
      const toMeta = (data, hadError = false, error = null) => {
        const normalized = Array.isArray(data) ? data : [];
        if (!returnMeta) return normalized;
        const result = { data: normalized, hadError: !!hadError };
        if (hadError && error) {
          result.error = String(error?.message || error);
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

        const sessionRef = ignoreScope
          ? { ...(resolveSession(slug || '') || {}), __ignoreSessionScanScope: true }
          : slug;
        const sbts = await this.getUserSBTsMinimal('none', address, true, sessionRef, {
          fromBlock,
          ignoreScope,
        });
        return toMeta(sbts || [], false);
      } catch (error) {
        contractsLog.warn(`[getSBTsForUser] Failed for ${slug}:`, error);
        return toMeta([], true, error);
      }
    },

    async getUserActivity(address, slug, fromBlock = 0, opts = {}) {
      latestBlockCache._map = {};
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
      const activity = {
        sbts: [],
        createdSurveys: [],
        createdQuestions: [],
        surveyResponses: [],
        questionResponses: [],
      };
      let hadError = false;

      const toMeta = (data, failed = false) => {
        if (!returnMeta) return data;
        return { data, hadError: !!failed };
      };

      const markStepError = (step, error) => {
        hadError = true;
        contractsLog.warn(`[getUserActivity] ${step} failed for ${slug}:`, error);
      };

      const safeCall = async (step, run, fallback) => {
        try {
          return await run();
        } catch (error) {
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
          const surveyIDsRaw = await safeCall(
            'getSurveysCreatedByAddress',
            () => this.getSurveysCreatedByAddress('none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const surveyIDs = Array.isArray(surveyIDsRaw) ? surveyIDsRaw : [];
          if (surveyIDs.length > 0) {
            const surveys = await Promise.all(surveyIDs.map(async (id) => {
              const data = await safeCall(
                `getSurveyDataById:${String(id || '').toLowerCase()}`,
                () => this.getSurveyDataById('none', id, sessionRef, { throwOnFailure: true }),
                null
              );
              return data ? { id, data } : null;
            }));
            activity.createdSurveys = surveys.filter((survey) => !!(survey && survey.data));
          }

          const respondedSurveyIDsRaw = await safeCall(
            'getSurveyResponsesByAddress',
            () => this.getSurveyResponsesByAddress('none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const respondedSurveyIDs = Array.isArray(respondedSurveyIDsRaw) ? respondedSurveyIDsRaw : [];
          if (respondedSurveyIDs.length > 0) {
            const responses = await Promise.all(respondedSurveyIDs.map(async (sid) => {
              const data = await safeCall(
                `getSurveyResponse:${String(sid || '').toLowerCase()}`,
                () => this.getSurveyResponse('none', address, sid, sessionRef, { throwOnError: true }),
                null
              );
              return data ? { surveyId: sid, response: data, responder: address } : null;
            }));
            activity.surveyResponses = responses.filter((response) => !!(response && response.response));
          }
        }

        if (includeQuestionActivity) {
          const questionIDsRaw = await safeCall(
            'getQuestionsCreatedByAddress',
            () => this.getQuestionsCreatedByAddress('none', address, fromBlock, 'latest', sessionRef),
            []
          );
          const questionIDs = Array.isArray(questionIDsRaw) ? questionIDsRaw : [];
          if (questionIDs.length > 0) {
            const questions = await Promise.all(questionIDs.map(async (id) => {
              const data = await safeCall(
                `getQuestionData:${String(id || '').toLowerCase()}`,
                () => this.getQuestionData('none', id, sessionRef, { throwOnFailure: true }),
                null
              );
              return data ? { id, data } : null;
            }));
            activity.createdQuestions = questions.filter((question) => !!(question && question.data));
          }

          const respondedQuestionEntriesRaw = await safeCall(
            'getQuestionResponsesByAddress',
            () => this.getQuestionResponsesByAddress('none', address, fromBlock, 'latest', sessionRef, { withMeta: true }),
            []
          );
          const respondedQuestionEntries = Array.isArray(respondedQuestionEntriesRaw)
            ? respondedQuestionEntriesRaw
            : [];
          if (respondedQuestionEntries.length > 0) {
            const responses = await Promise.all(respondedQuestionEntries.map(async (entry) => {
              const qid = (entry && typeof entry === 'object')
                ? String(entry.questionId || '').toLowerCase()
                : String(entry || '').toLowerCase();
              if (!qid) return null;
              const data = await safeCall(
                `getResponse:${qid}`,
                () => this.getResponse('none', address, qid, sessionRef, { throwOnError: true }),
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
            }));
            activity.questionResponses = responses.filter((response) => !!(response && response.response));
          }
        }
      } catch (error) {
        hadError = true;
        contractsLog.warn(`[getUserActivity] Partial failure for ${slug}:`, error);
      }

      return toMeta(activity, hadError);
    },
  };
}
