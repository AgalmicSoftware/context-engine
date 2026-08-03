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

export const createContractScriptsSurveyPayloadReadMethods = (
  deps: ContractScriptsRuntimeDeps,
): ContractScriptsMethodMap => {
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
    SBT_TOKENURI_METADATA_GATEWAYS,
    SBT_TOKENURI_METADATA_TIMEOUT_MS,
    STORAGE_BACKENDS,
    STORAGE_RESOURCE_KEYS,
    SURVEYS,
    SURVEYS_INTERFACE,
    arweaveScripts,
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
    async getSurveyDataById(providerName: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
      if (!surveyId || surveyId === ethers.constants.HashZero) {
        return null;
      }
      const sId = String(surveyId || '').toLowerCase();
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const cfg = resolveSession(groupKeyOrCfg || '');
      const storageBackendTag = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.SURVEYS)
        ? STORAGE_BACKENDS.CLOUDFLARE
        : STORAGE_BACKENDS.ARWEAVE;
      const modeTag = buildDecryptModeTag(opts);
      const failureModeTag = buildFailureModeTag(opts);
      const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
      const inflightKey = `${baseKey}|${sId}|${storageBackendTag}|${modeTag}|${failureModeTag}|force:${
        forceArweaveFetch ? '1' : '0'
      }`;

      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.surveyData, inflightKey, async () => {
          rpcLog('RPC Call:', {
            function: 'getSurveyDataById',
            method: 'this.getSurveyHash',
            params: { surveyId: sId },
          });
          const payloadPointerId = await this.getSurveyHash(providerName, sId, groupKeyOrCfg, {
            throwOnError: !!(opts && opts.throwOnFailure),
          });

          if (!payloadPointerId || payloadPointerId === arweaveClient.hexToBase64url(ethers.constants.HashZero)) {
            if (opts && opts.throwOnFailure) {
              throw buildHashUnavailableMetadataError(`Survey hash unavailable for survey ${sId}`, { txId: '' });
            }
            return null;
          }

          if (!ARWEAVE_ACTIVE && storageBackendTag !== STORAGE_BACKENDS.CLOUDFLARE) {
            return null;
          }
          const storageRead = await readPayloadPointerTextForGroup({
            pointerId: payloadPointerId,
            resource: STORAGE_RESOURCE_KEYS.SURVEYS,
            groupKeyOrCfg,
            cfg,
            arweaveOpts: {
              disableExistencePrecheck: true,
              preflightTxExistence: false,
              forceRetry: forceArweaveFetch,
              cacheBypass: forceArweaveFetch,
              bypassFailureCache: forceArweaveFetch,
              debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'survey_metadata', {
                fn: 'getSurveyDataById',
                surveyId: sId,
              }),
            },
          });
          const surveyPayloadText = storageRead?.text;
          let surveyData = null;
          try {
            surveyData = JSON.parse(surveyPayloadText as string);
          } catch (parseErr: any) {
            throw await recordTerminalArweaveInvalidFailure({
              groupKeyOrCfg,
              txId: payloadPointerId,
              message: `Invalid survey metadata JSON for pointer ${payloadPointerId}`,
              cause: parseErr,
            });
          }
          normalizeSessionNameFields(surveyData);
          const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
          if (!skipDecrypt) {
            await deps.contractMetadataResolutionHelpers.maybeDecryptSurveyPayload(surveyData, groupKeyOrCfg, opts);
          }
          return attachPayloadPointerFields(
            surveyData,
            payloadPointerId,
            STORAGE_RESOURCE_KEYS.SURVEYS,
            storageRead?.storageRef || null,
          );
        });
        return cloneJsonSafe(result);
      } catch (error: any) {
        logArweaveMetadataFetchFailure({ scope: 'survey', error });
        if (opts && opts.throwOnFailure) throw error;
        return null;
      }
    },

    // === CHANGED: pass-through group to getResponse
    async getSurveyResponse(providerName: any, userAddress: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
      const response = await this.getResponse(providerName, userAddress, surveyId, groupKeyOrCfg, {
        ...(opts && typeof opts === 'object' ? opts : {}),
        responseCategory: 'survey_response_payload',
      });
      return response;
    },

    async getResponseHash(providerName: any, userAddress: any, id: any, groupKeyOrCfg: any, opts: any = {}) {
      const cfg =
        opts && typeof opts === 'object' && opts._resolvedCfg && typeof opts._resolvedCfg === 'object'
          ? opts._resolvedCfg
          : resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
      const throwOnError = !!(opts && opts.throwOnError);

      if (!addr) {
        if (throwOnError) throw new Error('Missing surveys address for response hash lookup.');
        return null;
      }

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize ID to bytes32
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const idB32 = ensureHash(id);
      const responderLower = String(userAddress || '').toLowerCase();
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const inflightKey = `${baseKey}|${responderLower}|${idB32}|hash`;

      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.response, inflightKey, async () => {
          rpcLog('RPC Call:', {
            function: 'getResponseHash',
            method: 'SurveyContract.getResponse',
            params: { userAddress: responderLower, id: idB32 },
          });
          const arweaveHash = await callWithRetry(
            () => SurveyContract.getResponse(responderLower, idB32),
            'SurveyContract.getResponse',
          );
          if (!arweaveHash || arweaveHash === ethers.constants.HashZero) {
            return null;
          }
          return arweaveScripts.hexToBase64url(arweaveHash);
        });
        return typeof result === 'string' && result ? result : null;
      } catch (error: any) {
        if (throwOnError) throw error;
        contractsLog.error('Error getting response hash:', error);
        return null;
      }
    },

    async getResponse(providerName: any, userAddress: any, id: any, groupKeyOrCfg: any, opts: any = {}) {
      const cfg =
        opts && typeof opts === 'object' && opts._resolvedCfg && typeof opts._resolvedCfg === 'object'
          ? opts._resolvedCfg
          : resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
      const throwOnError = !!(opts && (opts.throwOnError || opts.throwOnFailure));

      if (!addr) {
        if (throwOnError) {
          throw new Error('Missing surveys address for response lookup.');
        }
        return null;
      }

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize ID to bytes32
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const idB32 = ensureHash(id);
      const responderLower = String(userAddress || '').toLowerCase();
      const responseCategory =
        String(opts?.responseCategory || '')
          .trim()
          .toLowerCase() === 'survey_response_payload'
          ? 'survey_response_payload'
          : 'question_response_payload';
      const forceArweaveFetch = !!opts?.forceArweaveFetch;
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const inflightKey = `${baseKey}|${responderLower}|${idB32}|strict:${throwOnError ? '1' : '0'}|force:${forceArweaveFetch ? '1' : '0'}`;
      const readE2EMockedViewedResponse = () => {
        if (typeof window === 'undefined') return null;
        if (globalThis.CE_E2E_LIT_MOCK !== true) return null;
        const responseKey = `${responderLower}|${idB32}`;

        try {
          const globalMocks =
            window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ && typeof window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ === 'object'
              ? window.__CE_E2E_MOCKED_VIEWED_RESPONSES__
              : null;
          const globalHit = globalMocks?.[responseKey];
          if (globalHit && typeof globalHit === 'object') {
            return cloneJsonSafe(globalHit);
          }
        } catch {}

        try {
          const raw = window.sessionStorage?.getItem('ce:e2e:mockedViewedResponses:v1');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          const hit = parsed?.[responseKey];
          if (hit && typeof hit === 'object') {
            return cloneJsonSafe(hit);
          }
        } catch {}

        return null;
      };
      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.response, inflightKey, async () => {
          rpcLog('RPC Call:', {
            function: 'getResponse',
            method: 'SurveyContract.getResponse',
            params: { userAddress: responderLower, id: idB32 },
          });
          const arweaveHash = await callWithRetry(
            () => SurveyContract.getResponse(responderLower, idB32),
            'SurveyContract.getResponse',
          );

          if (!arweaveHash || arweaveHash === ethers.constants.HashZero) {
            if (throwOnError && ARWEAVE_ACTIVE) {
              throw buildHashUnavailableMetadataError(
                `Response hash unavailable for responder ${responderLower} and id ${idB32}`,
                { txId: '' },
              );
            }
            return null;
          }
          const payloadPointerId = arweaveScripts.hexToBase64url(arweaveHash);
          const mockedResponse = readE2EMockedViewedResponse();
          if (mockedResponse) {
            normalizeSessionNameFields(mockedResponse);
            const mockedStorageRef = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES)
              ? normalizeStorageRef(
                  {
                    backend: STORAGE_BACKENDS.CLOUDFLARE,
                    id: payloadPointerId,
                    resource: STORAGE_RESOURCE_KEYS.RESPONSES,
                  },
                  { fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE, resource: STORAGE_RESOURCE_KEYS.RESPONSES },
                )
              : null;
            return normalizeConvictionImportance(
              attachPayloadPointerFields(
                mockedResponse,
                payloadPointerId,
                STORAGE_RESOURCE_KEYS.RESPONSES,
                mockedStorageRef,
              ),
            );
          }
          if (!ARWEAVE_ACTIVE && !isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES)) {
            return null;
          }
          const storageRead = await readPayloadPointerTextForGroup({
            pointerId: payloadPointerId,
            resource: STORAGE_RESOURCE_KEYS.RESPONSES,
            groupKeyOrCfg,
            cfg,
            arweaveOpts: {
              debugContext: buildArweaveDebugContext(groupKeyOrCfg, responseCategory, {
                fn: 'getResponse',
                responder: responderLower,
                id: idB32,
              }),
              // Response reports should not be held hostage by the ar.io-only
              // troubleshooting path. The on-chain pointer is immutable, so the
              // regular gateway fanout is safe and prevents a single ar.io outage
              // from making live response rows disappear.
              directToArIo: false,
              gatewayTimeoutMs: Number.isFinite(Number(opts?.arweaveGatewayTimeoutMs))
                ? Number(opts.arweaveGatewayTimeoutMs)
                : 4500,
              forceRetry: forceArweaveFetch,
              cacheBypass: forceArweaveFetch,
              bypassFailureCache: forceArweaveFetch,
            },
          });
          const arweaveData = storageRead?.text;
          let responseJson = null;
          try {
            responseJson = JSON.parse(arweaveData as string);
          } catch (parseErr: any) {
            throw await recordTerminalArweaveInvalidFailure({
              groupKeyOrCfg,
              txId: payloadPointerId,
              message: `Invalid response JSON for pointer ${payloadPointerId}`,
              cause: parseErr,
            });
          }
          normalizeSessionNameFields(responseJson);
          return normalizeConvictionImportance(
            attachPayloadPointerFields(
              responseJson,
              payloadPointerId,
              STORAGE_RESOURCE_KEYS.RESPONSES,
              storageRead?.storageRef || null,
            ),
          );
        });
        return cloneJsonSafe(result);
      } catch (error: any) {
        logArweaveMetadataFetchFailure({ scope: 'response', error });
        if (throwOnError) throw error;
        return null;
      }
    },

    async getQuestionHash(providerName: any, questionId: any, groupKeyOrCfg: any, opts: any = {}) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
      const throwOnError = !!(opts && opts.throwOnError);

      if (!addr || !utils.isAddress(addr)) {
        if (throwOnError) throw new Error('Missing surveys address for question hash lookup.');
        return null;
      }

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      if (!provider) {
        if (throwOnError)
          throw new Error(
            `Missing read provider for question hash lookup (chainId=${String(chId || '') || 'unknown'}).`,
          );
        return null;
      }

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const qId = ensureHash(questionId);
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const memoKey = buildHashReadMemoKey({ baseKey, id: qId });
      const inflightKey = buildHashReadInflightKey({ baseKey, id: qId, throwOnError });
      const memoValue = getTimedMemoValue(READ_MEMO.questionHash, memoKey, HASH_READ_TTL_MS);
      if (memoValue === HASH_MISS_SENTINEL) return null;
      if (memoValue !== null && memoValue !== undefined) return memoValue;

      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.questionHash, inflightKey, async () => {
          rpcLog('RPC Call:', {
            function: 'getQuestionHash',
            method: 'SurveyContract.getQuestionHash',
            params: { questionId: qId },
          });
          const arweaveHashBytes = await callWithRetry(
            () => SurveyContract.getQuestionHash(qId),
            'SurveyContract.getQuestionHash',
          );
          if (!arweaveHashBytes || arweaveHashBytes === ethers.constants.HashZero) {
            return null;
          }
          return arweaveScripts.hexToBase64url(arweaveHashBytes);
        });
        setTimedMemoValue(
          READ_MEMO.questionHash,
          memoKey,
          result == null ? HASH_MISS_SENTINEL : result,
          HASH_READ_MAX_ENTRIES,
        );
        return result;
      } catch (error: any) {
        if (isCallExceptionError(error)) {
          READ_MEMO.questionHash.delete(memoKey);
          const didLog = markHashRevertLoggedOnce(questionHashRevertLogged, memoKey);
          if (didLog) {
            contractsLog.warn('Question hash lookup reverted; not memoizing a long-lived miss.', {
              questionId: qId,
              code: error?.code ?? error?.error?.code ?? null,
              message: error?.message || error?.error?.message || '',
            });
          }
          // Treat revert as "hash unavailable" (not a transport failure), even in strict mode.
          // Strict callers will still surface terminal_not_found via getQuestionData/getSurveyDataById.
          return null;
        }
        if (throwOnError) throw error;
        contractsLog.error('Error getting question hash:', error);
        return null;
      }
    },

    async getSurveyHash(providerName: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
      if (!surveyId || surveyId === ethers.constants.HashZero) {
        return null;
      }
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
      const throwOnError = !!(opts && opts.throwOnError);

      if (!addr || !utils.isAddress(addr)) {
        if (throwOnError) throw new Error('Missing surveys address for survey hash lookup.');
        return null;
      }

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      if (!provider) {
        if (throwOnError)
          throw new Error(`Missing read provider for survey hash lookup (chainId=${String(chId || '') || 'unknown'}).`);
        return null;
      }

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const sId = ensureHash(surveyId);
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const memoKey = buildHashReadMemoKey({ baseKey, id: sId });
      const inflightKey = buildHashReadInflightKey({ baseKey, id: sId, throwOnError });
      const memoValue = getTimedMemoValue(READ_MEMO.surveyHash, memoKey, HASH_READ_TTL_MS);
      if (memoValue === HASH_MISS_SENTINEL) return null;
      if (memoValue !== null && memoValue !== undefined) return memoValue;

      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.surveyHash, inflightKey, async () => {
          rpcLog('RPC Call:', {
            function: 'getSurveyHash',
            method: 'SurveyContract.getSurveyHash',
            params: { surveyId: sId },
          });
          const arweaveHashBytes = await callWithRetry(
            () => SurveyContract.getSurveyHash(sId),
            'SurveyContract.getSurveyHash',
          );
          if (!arweaveHashBytes || arweaveHashBytes === ethers.constants.HashZero) {
            return null;
          }
          return arweaveScripts.hexToBase64url(arweaveHashBytes);
        });
        setTimedMemoValue(
          READ_MEMO.surveyHash,
          memoKey,
          result == null ? HASH_MISS_SENTINEL : result,
          HASH_READ_MAX_ENTRIES,
        );
        return result;
      } catch (error: any) {
        if (isCallExceptionError(error)) {
          READ_MEMO.surveyHash.delete(memoKey);
          const didLog = markHashRevertLoggedOnce(surveyHashRevertLogged, memoKey);
          if (didLog) {
            contractsLog.warn('Survey hash lookup reverted; not memoizing a long-lived miss.', {
              surveyId: sId,
              code: error?.code ?? error?.error?.code ?? null,
              message: error?.message || error?.error?.message || '',
            });
          }
          // Treat revert as "hash unavailable" (not a transport failure), even in strict mode.
          // Strict callers will still surface terminal_not_found via getQuestionData/getSurveyDataById.
          return null;
        }
        if (throwOnError) throw error;
        contractsLog.error('Error getting survey hash:', error);
        return null;
      }
    },

    getQuestionSurvey: async function (providerName: any, questionId: any, groupKeyOrCfg: any = null) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      if (!addr || !utils.isAddress(addr)) {
        return null;
      }

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      if (!provider) {
        return null;
      }
      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const qId = ensureHash(questionId);

      try {
        rpcLog('RPC Call:', {
          function: 'getQuestionSurvey',
          method: 'SurveyContract.getQuestionSurvey',
          params: { questionId: qId },
        });
        const surveyIdResult = await callWithRetry(
          () => SurveyContract.getQuestionSurvey(qId),
          'SurveyContract.getQuestionSurvey',
        );
        return surveyIdResult;
      } catch (error: any) {
        contractsLog.error("Error getting question's associated survey:", error);
        return null;
      }
    },

    // === CHANGED: +groupKeyOrCfg (optional). Threads group to getQuestionHash.
    async getQuestionData(providerName: any, questionId: any, groupKeyOrCfg: any, opts: any = {}) {
      const qId = String(questionId || '').toLowerCase();
      const { baseKey } = resolveReadContext(groupKeyOrCfg);
      const modeTag = buildDecryptModeTag(opts);
      const failureModeTag = buildFailureModeTag(opts);
      const arweaveReadModeTag = buildArweaveReadModeTag(opts);
      const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
      const inflightKey = `${baseKey}|${qId}|${modeTag}|${failureModeTag}|${arweaveReadModeTag}|force:${forceArweaveFetch ? '1' : '0'}`;
      try {
        const result = await runInFlightCoalesced(READ_INFLIGHT.questionData, inflightKey, async () => {
          const payloadPointerId = await this.getQuestionHash(providerName, qId, groupKeyOrCfg, {
            throwOnError: !!(opts && opts.throwOnFailure),
          });
          if (!payloadPointerId) {
            if (
              opts &&
              opts.throwOnFailure &&
              (ARWEAVE_ACTIVE ||
                isCloudflareStorageResource(resolveSession(groupKeyOrCfg || ''), STORAGE_RESOURCE_KEYS.QUESTIONS))
            ) {
              throw buildHashUnavailableMetadataError(`Question hash unavailable for question ${qId}`, { txId: '' });
            }
            return null;
          }
          const cfg = resolveSession(groupKeyOrCfg || '');
          if (!ARWEAVE_ACTIVE && !isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS)) {
            return null;
          }
          const storageRead = await readPayloadPointerTextForGroup({
            pointerId: payloadPointerId,
            resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
            groupKeyOrCfg,
            cfg,
            arweaveOpts: {
              disableExistencePrecheck: true,
              preflightTxExistence: false,
              forceRetry: forceArweaveFetch,
              cacheBypass: forceArweaveFetch,
              bypassFailureCache: forceArweaveFetch,
              ...(Number.isFinite(Number(opts?.arweaveRetries))
                ? { retries: Math.max(0, Number(opts.arweaveRetries)) }
                : {}),
              ...(Number.isFinite(Number(opts?.arweaveGatewayTimeoutMs))
                ? { gatewayTimeoutMs: Math.max(300, Number(opts.arweaveGatewayTimeoutMs)) }
                : {}),
              debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'question_metadata', {
                fn: 'getQuestionData',
                questionId: qId,
              }),
            },
          });
          const questionDataString = storageRead?.text;
          if (!questionDataString) {
            contractsLog.error(`No data found for question payload pointer: ${payloadPointerId}`);
            return null;
          }
          let questionData = null;
          try {
            questionData = JSON.parse(questionDataString);
          } catch (parseErr: any) {
            throw await recordTerminalArweaveInvalidFailure({
              groupKeyOrCfg,
              txId: payloadPointerId,
              message: `Invalid question metadata JSON for pointer ${payloadPointerId}`,
              cause: parseErr,
            });
          }
          normalizeSessionNameFields(questionData);
          normalizeQuestionFlags(questionData);
          const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
          if (!skipDecrypt) {
            await deps.contractMetadataResolutionHelpers.maybeDecryptQuestionPayload(questionData, groupKeyOrCfg, opts);
          }
          return attachPayloadPointerFields(
            questionData,
            payloadPointerId,
            STORAGE_RESOURCE_KEYS.QUESTIONS,
            storageRead?.storageRef || null,
          );
        });
        return cloneJsonSafe(result);
      } catch (error: any) {
        logArweaveMetadataFetchFailure({ scope: 'question', error });
        if (opts && opts.throwOnFailure) throw error;
        return null;
      }
    },

    // Decrypt masked question metadata without re-downloading the payload from Arweave.
    // This is useful for "gate just changed" refreshes where we already have the encrypted
    // prompt/options/tags envelopes cached locally.
    async decryptQuestionPayloadInPlace(questionData: any, groupKeyOrCfg: any = null, opts: any = {}) {
      return deps.contractMetadataResolutionHelpers.maybeDecryptQuestionPayload(questionData, groupKeyOrCfg, opts);
    },

    // Decrypt masked survey metadata without re-downloading the payload from Arweave.
    async decryptSurveyPayloadInPlace(surveyData: any, groupKeyOrCfg: any = null, opts: any = {}) {
      return deps.contractMetadataResolutionHelpers.maybeDecryptSurveyPayload(surveyData, groupKeyOrCfg, opts);
    },
  };
};
