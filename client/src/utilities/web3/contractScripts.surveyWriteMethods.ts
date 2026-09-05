import type { ContractScriptsMethodMap, ContractScriptsRuntimeDeps } from './contractScripts.runtimeDeps.js';
import { resolveSessionCapabilityProjection } from '../session/sessionCapabilityProjection';
import { resolveWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery';

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
type ProviderName = string;
type GroupKeyOrConfig = string | Record<string, unknown> | null | undefined;
type Bytes32Input = string | number | null | undefined;
type MetadataPayload = Record<string, unknown>;
type PayloadPointerUpload = {
  pointerBytes: string;
  arweaveTxId?: string;
  storageRef?: unknown;
};

const toMetadataPayload = (value: MetadataPayload | null | undefined): MetadataPayload => value || {};

export const createContractScriptsSurveyWriteMethods = (deps: ContractScriptsRuntimeDeps): ContractScriptsMethodMap => {
  const {
    ARWEAVE_ACTIVE,
    GAS_FALLBACKS,
    STORAGE_RESOURCE_KEYS,
    SURVEYS,
    attachStorageRefCompatibilityFields,
    clearReadCachesForGroup,
    getSessionAddresses,
    resolveArweaveUploadOpts,
    refreshSessionRegistryFieldsCache,
    contractsLog,
    cryptoUtils,
    ethers,
    hasNonZeroHashValue,
    isCloudflareStorageResource,
    memoizedResolveSession,
    normalizeSessionNameFields,
    normalizeSessionSlug,
    notifyUserFacingTransactionError,
    resolveSession,
    resolveStorageSessionSlug,
    resolveTxGasOverrides,
    rpcLog,
    sendContractWriteViaProvider,
    uploadJsonPayloadForContractPointer,
    utils,
    validateNoLockedPlaintextInPayload,
  } = deps;

  const assertNonZeroBytes32 = (value: unknown, label: string): void => {
    if (!utils.isHexString(value, 32)) {
      throw new Error(`${label} is not a bytes32.`);
    }
    if (!hasNonZeroHashValue(value)) {
      throw new Error(`${label} cannot be zero.`);
    }
  };

  return {
    addSurveyWithQuestions: async function (
      providerName: ProviderName,
      surveyId: Bytes32Input,
      surveyData: MetadataPayload | null | undefined,
      questionIds: Bytes32Input[],
      questionDataArray: Array<MetadataPayload | null | undefined>,
      groupKeyOrCfg: GroupKeyOrConfig = null,
    ) {
      if (providerName === 'none') {
        throw new Error('addSurveyWithQuestions requires a signer-capable provider (not read-only).');
      }

      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();

      // Group-aware address resolution (no hard-coded fallback)
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      if (!addr) {
        const slug = normalizeSessionSlug(typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfg?.slug || '');
        throw new Error(
          `[addSurveyWithQuestions] Missing surveys contract address for session slug "${slug || 'general'}".`,
        );
      }
      let surveyPayloadUpload: PayloadPointerUpload | null = null;
      const questionPayloadUploads: PayloadPointerUpload[] = [];

      // Normalize IDs to bytes32
      const ensureHash = (v: Bytes32Input) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v == null ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };

      const sId = ensureHash(surveyId);
      const qIds32 = (Array.isArray(questionIds) ? questionIds : []).map(ensureHash);

      assertNonZeroBytes32(sId, 'addSurveyWithQuestions: surveyId');
      qIds32.forEach((id: string, i: number) => {
        assertNonZeroBytes32(id, `addSurveyWithQuestions: questionIds[${i}]`);
      });

      const canUseSessionStorage =
        isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.SURVEYS) ||
        isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS);
      if (ARWEAVE_ACTIVE || canUseSessionStorage) {
        // Safety net: inject sessionName/sessionSlug if caller omitted it
        const _sessionName = String(cfg?.sessionName || cfg?.slug || '' || '');
        const _sessionSlug = resolveStorageSessionSlug(groupKeyOrCfg, cfg);
        const _sessionMetadataOptions = _sessionSlug ? { sessionSlug: _sessionSlug } : {};
        const surveyDataToUpload = normalizeSessionNameFields(
          {
            ...toMetadataPayload(surveyData),
          },
          _sessionName,
          _sessionMetadataOptions,
        );

        const qArrayToUpload = (Array.isArray(questionDataArray) ? questionDataArray : []).map((q) =>
          normalizeSessionNameFields(
            {
              ...toMetadataPayload(q),
            },
            _sessionName,
            _sessionMetadataOptions,
          ),
        );

        validateNoLockedPlaintextInPayload(surveyDataToUpload, {
          family: 'survey_metadata',
          path: 'survey metadata',
        });
        qArrayToUpload.forEach((questionData, index) => {
          validateNoLockedPlaintextInPayload(questionData, {
            family: 'question_metadata',
            path: `question metadata[${index}]`,
          });
        });

        const arweaveUploadOpts = await resolveArweaveUploadOpts(groupKeyOrCfg, {
          providerLike: ethersProvider,
          signer,
        });
        surveyPayloadUpload = await uploadJsonPayloadForContractPointer({
          payload: surveyDataToUpload,
          resource: STORAGE_RESOURCE_KEYS.SURVEYS,
          groupKeyOrCfg,
          cfg,
          arweaveUploadOpts,
          storageContext: {
            account: await signer.getAddress().catch(() => ''),
            providerLike: ethersProvider,
          },
        });

        for (let questionData of qArrayToUpload) {
          const questionPayloadUpload = await uploadJsonPayloadForContractPointer({
            payload: questionData,
            resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
            groupKeyOrCfg,
            cfg,
            arweaveUploadOpts,
            storageContext: {
              account: await signer.getAddress().catch(() => ''),
              providerLike: ethersProvider,
            },
          });
          questionPayloadUploads.push(questionPayloadUpload);
        }
      } else {
        throw new Error('Payload uploads are disabled; cannot create survey/questions.');
      }

      if (!surveyPayloadUpload) {
        throw new Error('Survey payload upload did not return a storage pointer.');
      }

      const surveyArweaveHashBytes = surveyPayloadUpload.pointerBytes;
      const questionArweaveHashesBytes = questionPayloadUploads.map((upload) => upload.pointerBytes);
      assertNonZeroBytes32(surveyArweaveHashBytes, 'addSurveyWithQuestions: survey content hash');
      questionArweaveHashesBytes.forEach((hash, index) => {
        assertNonZeroBytes32(hash, `addSurveyWithQuestions: question content hashes[${index}]`);
      });
      const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);

      rpcLog('RPC Call (Tx):', {
        function: 'addSurveyWithQuestions',
        method: 'SurveyContract.addSurvey',
        params: {
          surveyId: sId,
          surveyArweaveHashBytes,
          questionIdsCount: qIds32.length,
          questionArweaveHashesBytesCount: questionArweaveHashesBytes.length,
        },
      });

      const txOverrides = await resolveTxGasOverrides({
        contract: SurveyContract,
        method: 'addSurvey',
        args: [sId, surveyArweaveHashBytes, qIds32, questionArweaveHashesBytes],
        fallbackGasLimit: String(GAS_FALLBACKS.addSurvey(qIds32.length)),
        minEstimate: '80000',
        logLabel: 'addSurveyWithQuestions',
        preferFallbackGasLimit: true,
      });
      try {
        const { receipt } = await sendContractWriteViaProvider({
          signingProvider: providerLocation,
          ethersProvider,
          signer,
          contract: SurveyContract,
          method: 'addSurvey',
          args: [sId, surveyArweaveHashBytes, qIds32, questionArweaveHashesBytes],
          txOverrides,
          rpcFunction: 'addSurveyWithQuestions',
          revertMessage: 'addSurveyWithQuestions transaction reverted on-chain.',
        });
        clearReadCachesForGroup(groupKeyOrCfg);
        const surveyStorageRef = surveyPayloadUpload.storageRef;
        const uploadedQuestions = qIds32.map((id: string, index: number) =>
          attachStorageRefCompatibilityFields(
            {
              questionId: id,
              arweaveTxId: questionPayloadUploads[index]?.arweaveTxId || '',
              storageRef: questionPayloadUploads[index]?.storageRef || null,
              resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
            },
            { resource: STORAGE_RESOURCE_KEYS.QUESTIONS },
          ),
        );
        return {
          receipt,
          ...(surveyPayloadUpload.arweaveTxId ? { surveyArweaveTxId: surveyPayloadUpload.arweaveTxId } : {}),
          ...(surveyStorageRef ? { surveyStorageRef } : {}),
          uploadedQuestions,
        };
      } catch (error: unknown) {
        notifyUserFacingTransactionError(error);
        throw error;
      }
    },

    addQuestions: async function (
      providerName: ProviderName,
      questionIds: Bytes32Input[],
      questionDataArray: Array<MetadataPayload | null | undefined>,
      surveyIds: Bytes32Input[],
      groupKeyOrCfg: GroupKeyOrConfig = null,
    ) {
      if (providerName === 'none') {
        throw new Error('addQuestions requires a signer-capable provider (not read-only).');
      }

      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();

      // Group-aware address resolution (no hard-coded fallback)
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      if (!addr) {
        const slug = normalizeSessionSlug(typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfg?.slug || '');
        throw new Error(`[addQuestions] Missing surveys contract address for session slug "${slug || 'general'}".`);
      }
      const questionPayloadUploads: PayloadPointerUpload[] = [];

      // Normalize IDs to bytes32
      const ensureHash = (v: Bytes32Input) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v == null ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };

      const qIds32 = (Array.isArray(questionIds) ? questionIds : []).map(ensureHash);
      const sIds32 = (Array.isArray(surveyIds) ? surveyIds : []).map(ensureHash);

      qIds32.forEach((id: string, i: number) => {
        assertNonZeroBytes32(id, `addQuestions: questionIds[${i}]`);
      });
      sIds32.forEach((id: string, i: number) => {
        if (!utils.isHexString(id, 32)) throw new Error(`addQuestions: surveyIds[${i}] is not a bytes32.`);
      });

      const canUseSessionStorage = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS);
      if (ARWEAVE_ACTIVE || canUseSessionStorage) {
        // Safety net: inject sessionName/sessionSlug if caller omitted it
        const _sessionName = String(cfg?.sessionName || cfg?.slug || '' || '');
        const _sessionSlug = resolveStorageSessionSlug(groupKeyOrCfg, cfg);
        const _sessionMetadataOptions = _sessionSlug ? { sessionSlug: _sessionSlug } : {};
        const qArrayToUpload = (Array.isArray(questionDataArray) ? questionDataArray : []).map((q) =>
          normalizeSessionNameFields(
            {
              ...toMetadataPayload(q),
            },
            _sessionName,
            _sessionMetadataOptions,
          ),
        );

        qArrayToUpload.forEach((questionData, index) => {
          validateNoLockedPlaintextInPayload(questionData, {
            family: 'question_metadata',
            path: `question metadata[${index}]`,
          });
        });

        const arweaveUploadOpts = await resolveArweaveUploadOpts(groupKeyOrCfg, {
          providerLike: ethersProvider,
          signer,
        });

        for (let questionData of qArrayToUpload) {
          const questionPayloadUpload = await uploadJsonPayloadForContractPointer({
            payload: questionData,
            resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
            groupKeyOrCfg,
            cfg,
            arweaveUploadOpts,
            storageContext: {
              account: await signer.getAddress().catch(() => ''),
              providerLike: ethersProvider,
            },
          });
          questionPayloadUploads.push(questionPayloadUpload);
        }
      } else {
        throw new Error('Payload uploads are disabled; cannot add questions.');
      }

      const questionArweaveHashBytesArray = questionPayloadUploads.map((upload) => upload.pointerBytes);
      questionArweaveHashBytesArray.forEach((hash, index) => {
        assertNonZeroBytes32(hash, `addQuestions: content hashes[${index}]`);
      });
      const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);

      rpcLog('RPC Call (Tx):', {
        function: 'addQuestions',
        method: 'SurveyContract.addQuestions',
        params: {
          questionIdsCount: qIds32.length,
          questionArweaveHashBytesArrayCount: questionArweaveHashBytesArray.length,
          surveyIdsCount: sIds32.length,
        },
      });

      const txOverrides = await resolveTxGasOverrides({
        contract: SurveyContract,
        method: 'addQuestions',
        args: [qIds32, questionArweaveHashBytesArray, sIds32],
        fallbackGasLimit: String(GAS_FALLBACKS.addQuestions(qIds32.length)),
        minEstimate: '80000',
        logLabel: 'addQuestions',
        preferFallbackGasLimit: true,
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: SurveyContract,
        method: 'addQuestions',
        args: [qIds32, questionArweaveHashBytesArray, sIds32],
        txOverrides,
        rpcFunction: 'addQuestions',
        revertMessage: 'addQuestions transaction reverted on-chain.',
      });

      const uploadedQuestions = qIds32.map((id: string, index: number) => {
        const upload = questionPayloadUploads[index] || {};
        return attachStorageRefCompatibilityFields(
          {
            questionId: id,
            arweaveTxId: upload.arweaveTxId || '',
            storageRef: upload.storageRef || null,
            resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
          },
          { resource: STORAGE_RESOURCE_KEYS.QUESTIONS },
        );
      });

      clearReadCachesForGroup(groupKeyOrCfg);
      return { receipt, uploadedQuestions };
    },

    submitResponses: async function (
      providerName: ProviderName,
      questionIds: Bytes32Input[],
      questionResponses: MetadataPayload[],
      surveyId: Bytes32Input,
      surveyResponse: MetadataPayload | null | undefined,
      groupKeyOrCfg: GroupKeyOrConfig = null,
    ) {
      let cfg = resolveSession(groupKeyOrCfg || '');
      let sessionProjection = resolveSessionCapabilityProjection(cfg);
      if (sessionProjection.source === 'invalid_profile' || sessionProjection.source === 'missing') {
        throw new Error('submitResponses: session mode profile is missing, invalid, or unsupported.');
      }
      if (providerName === 'none') {
        throw new Error('submitResponses: read-only provider is not allowed here. Connect a wallet first.');
      }
      // Resolve the interactive signing provider based on the caller's intent.
      // Keep all ethers logic here, as requested.
      let signingProvider = this.getProviderLocation(providerName);

      // Keep Web3Auth override for easy re-enable; it is no-op without a provider.
      if (providerName === 'web3auth') {
        if (window.web3authProvider) {
          signingProvider = window.web3authProvider;
        } else {
          throw new Error('Selected wallet provider is not available. Log in or reconnect your wallet first.');
        }
      }

      // 🔐 Normalize identifiers to bytes32 at the boundary
      const ensureHash = (v: Bytes32Input) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') {
            return cryptoUtils.hashIdentifier(v);
          }
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };

      const hashedQuestionIds = Array.isArray(questionIds) ? questionIds.map(ensureHash) : [];
      const hashedSurveyId = ensureHash(surveyId);
      const hasSurveyId = hasNonZeroHashValue(hashedSurveyId);
      const hasSurveyResponse = !!surveyResponse;
      if (hasSurveyId !== hasSurveyResponse) {
        throw new Error('submitResponses: survey response ID/hash mismatch.');
      }

      // Optional preflight
      hashedQuestionIds.forEach((id: string, i: number) => {
        assertNonZeroBytes32(id, `submitResponses: questionIds[${i}]`);
      });
      if (!utils.isHexString(hashedSurveyId, 32)) {
        throw new Error('submitResponses: surveyId is not a bytes32.');
      }

      // Build ethers provider/signer from the chosen interactive provider.
      const ethersProvider = new ethers.providers.Web3Provider(signingProvider as any);
      const signer = ethersProvider.getSigner();
      const userAddress = await signer.getAddress(); // throws if no account

      // Prepare data to upload and on-chain params.
      let questionResponseUploads: PayloadPointerUpload[] = [];
      let surveyResponseUpload: PayloadPointerUpload | null = null;
      let surveyResponseHashBytes = ethers.constants.HashZero;

      const resolvedArweaveOpts = await resolveArweaveUploadOpts(groupKeyOrCfg, {
        providerLike: ethersProvider,
        signer,
        refreshSessionConfig:
          typeof refreshSessionRegistryFieldsCache === 'function' &&
          (sessionProjection.isRegistryCanonical || sessionProjection.source === 'legacy_registry')
            ? async ({ slug, sessionConfig }: any) =>
                refreshSessionRegistryFieldsCache({
                  chainId:
                    resolveSessionCapabilityProjection(sessionConfig).chainId || sessionProjection.chainId || null,
                  slug,
                  sessionId:
                    sessionConfig?.sessionId || sessionConfig?.__registry?.sessionIdHex || cfg?.sessionId || null,
                  providerLike: signingProvider,
                })
            : null,
      });
      if (resolvedArweaveOpts?.sessionConfig) {
        cfg = resolvedArweaveOpts.sessionConfig;
        sessionProjection = resolveSessionCapabilityProjection(cfg);
        if (sessionProjection.source === 'invalid_profile' || sessionProjection.source === 'missing') {
          throw new Error('submitResponses: refreshed session mode profile is missing, invalid, or unsupported.');
        }
      }
      const workerResponseIdentity =
        sessionProjection.profileValid && sessionProjection.isWorkerCanonical
          ? {
              sessionId: resolveWorkerCanonicalSessionIdHex(cfg),
              sessionSlug: normalizeSessionSlug(resolveStorageSessionSlug(groupKeyOrCfg, cfg)),
            }
          : null;
      if (workerResponseIdentity && (!workerResponseIdentity.sessionId || !workerResponseIdentity.sessionSlug)) {
        throw new Error('submitResponses: exact Worker session identity is required.');
      }
      const canUseSessionStorage = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES);
      if (ARWEAVE_ACTIVE || canUseSessionStorage) {
        const uploadContext = {
          account: userAddress,
          providerLike: ethersProvider,
          signer,
          chainId: sessionProjection.chainId,
        };
        const arweaveOpts = {
          ...resolvedArweaveOpts,
          context: uploadContext,
        };
        if (surveyResponse) {
          const surveyResponsePayload = workerResponseIdentity
            ? { ...surveyResponse, ...workerResponseIdentity }
            : surveyResponse;
          validateNoLockedPlaintextInPayload(surveyResponsePayload, {
            family: 'survey_response_payload',
            path: 'survey response',
          });
          surveyResponseUpload = await uploadJsonPayloadForContractPointer({
            payload: surveyResponsePayload,
            resource: STORAGE_RESOURCE_KEYS.RESPONSES,
            groupKeyOrCfg,
            cfg,
            arweaveUploadOpts: arweaveOpts,
            uploadWithRetry: true,
            storageContext: uploadContext,
          });
          surveyResponseHashBytes = surveyResponseUpload?.pointerBytes || ethers.constants.HashZero;
        }
        // Upload response objects sequentially to avoid Arweave anchor/signature races
        // that can appear when multiple uploads are posted in parallel for one wallet.
        questionResponseUploads = [];
        for (const response of questionResponses) {
          const responsePayload = workerResponseIdentity ? { ...response, ...workerResponseIdentity } : response;
          validateNoLockedPlaintextInPayload(responsePayload, {
            family: 'question_response_payload',
            path: 'question response',
          });

          const responseUpload = await uploadJsonPayloadForContractPointer({
            payload: responsePayload,
            resource: STORAGE_RESOURCE_KEYS.RESPONSES,
            groupKeyOrCfg,
            cfg,
            arweaveUploadOpts: arweaveOpts,
            uploadWithRetry: true,
            storageContext: uploadContext,
          });
          questionResponseUploads.push(responseUpload);
        }
      } else {
        return; // no-op when no configured payload storage path is available
      }

      const questionResponseHashesBytes = questionResponseUploads.map((upload) => upload.pointerBytes);
      // Regression guard: zero remains the absence sentinel on-chain, so uploaded
      // pointers and the optional survey pair must be validated before wallet submission.
      questionResponseHashesBytes.forEach((hash, index) => {
        assertNonZeroBytes32(hash, `submitResponses: questionResponseHashes[${index}]`);
      });
      if (hasSurveyResponse) {
        assertNonZeroBytes32(surveyResponseHashBytes, 'submitResponses: survey response hash');
      }

      if (sessionProjection.profileValid && sessionProjection.isWorkerCanonical && canUseSessionStorage) {
        const storageRefs = [
          surveyResponseUpload?.storageRef,
          ...questionResponseUploads.map((upload) => upload.storageRef),
        ].filter(Boolean);
        if (!storageRefs.length) {
          throw new Error('Worker-canonical response submission did not return durable storage references.');
        }
        return {
          workerCanonicalSubmission: true,
          sessionSlug: workerResponseIdentity?.sessionSlug || resolveStorageSessionSlug(groupKeyOrCfg, cfg),
          storageRefs,
        };
      }

      // === Address resolution (group-aware; no SURVEYS_ADDRESS fallback)
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      if (!addr) {
        contractsLog.log('[submitResponses] Missing surveys address in group config; aborting tx.');
        return; // early return (no throw)
      }

      const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);
      const txArgs: unknown[] = [
        hashedQuestionIds,
        questionResponseHashesBytes,
        hashedSurveyId,
        surveyResponseHashBytes,
      ];
      const txOverrides = await resolveTxGasOverrides({
        contract: SurveyContract,
        method: 'submitResponses',
        args: txArgs,
        fallbackGasLimit: String(GAS_FALLBACKS.submitResponses(hashedQuestionIds.length)),
        minEstimate: '80000',
        logLabel: 'submitResponses',
        preferFallbackGasLimit: true,
      });

      rpcLog('RPC Call (Tx):', {
        function: 'submitResponses',
        method: 'SurveyContract.submitResponses',
        params: {
          userAddress,
          questionIdsCount: hashedQuestionIds.length,
          gasLimit: txOverrides?.gasLimit?.toString?.() || null,
        },
      });

      try {
        const { receipt } = await sendContractWriteViaProvider({
          signingProvider,
          ethersProvider,
          signer,
          contract: SurveyContract,
          method: 'submitResponses',
          args: txArgs,
          txOverrides,
          rpcFunction: 'submitResponses',
          revertMessage: 'submitResponses transaction reverted on-chain.',
        });
        clearReadCachesForGroup(groupKeyOrCfg);
        return receipt;
      } catch (error: unknown) {
        notifyUserFacingTransactionError(error);
        contractsLog.error('Error sending transaction with provider.request:', error);
        throw error;
      }
    },
  };
};
