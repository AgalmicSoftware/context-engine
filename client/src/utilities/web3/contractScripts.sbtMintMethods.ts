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

export const createContractScriptsSbtMintMethods = (deps: ContractScriptsRuntimeDeps): ContractScriptsMethodMap => {
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
    startClaim: async function (providerName: any, SBTAddress: any, userCommit: any) {
      if (providerName === 'none') throw new Error('startClaim requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'startClaim',
        args: [userCommit],
        fallbackGasLimit: '400000',
        minEstimate: '70000',
        logLabel: 'startClaim',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'startClaim',
        method: 'CustomSBT.startClaim',
        params: { userCommitLength: userCommit?.length || 0 },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'startClaim',
        args: [userCommit],
        txOverrides,
        rpcFunction: 'startClaim',
        revertMessage: 'startClaim transaction reverted on-chain.',
      });
      return receipt;
    },

    claimWithPassword: async function (providerName: any, SBTAddress: any, password: any) {
      if (providerName === 'none')
        throw new Error('claimWithPassword requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'claimWithPassword',
        args: [password],
        fallbackGasLimit: '700000',
        minEstimate: '120000',
        logLabel: 'claimWithPassword',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'claimWithPassword',
        method: 'CustomSBT.claimWithPassword',
        params: { passwordProvided: !!password },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'claimWithPassword',
        args: [password],
        txOverrides,
        rpcFunction: 'claimWithPassword',
        revertMessage: 'claimWithPassword transaction reverted on-chain.',
      });
      return receipt;
    },

    claimWithInvite: async function (providerName: any, SBTAddress: any, nonce: any, signature: any) {
      if (providerName === 'none')
        throw new Error('claimWithInvite requires a signer-capable provider (not read-only).');
      inviteLog.log('[INVITE_DEBUG v4] claimWithInvite (instrumented)');
      inviteLog.log('--- Debug ClaimWithInvite ---');
      inviteLog.log('SBT Address:', SBTAddress);
      inviteLog.log('Nonce:', nonce);
      inviteLog.log('Signature:', signature);
      if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) {
        throw new Error('Invalid SBT address for claimWithInvite.');
      }
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      let signerAddress = null;
      try {
        signerAddress = await signer.getAddress();
        inviteLog.log('Signer Address:', signerAddress);
      } catch (err: any) {
        inviteLog.warn('Failed to resolve signer address:', err?.message || err);
      }
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      let callStaticFailure = null;

      // Preflight debug: recover signer + compare to on-chain hash + nonce expectations.
      try {
        const messageHash = cryptoUtils.buildInviteMessageHash({ sbtAddress: SBTAddress, nonce });
        const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(messageHash), signature);
        const recoveredHash = ethers.utils.solidityKeccak256(['address'], [recovered]);
        inviteLog.log('[INVITE_DEBUG v4] recovered signer:', recovered);
        inviteLog.log('[INVITE_DEBUG v4] recovered hash:', recoveredHash);

        const onchainHash = await this.getGroupPasswordHash('none', SBTAddress, '');
        inviteLog.log('[INVITE_DEBUG v4] on-chain groupPasswordHash:', onchainHash);
        if (onchainHash && onchainHash !== ethers.constants.HashZero) {
          inviteLog.log(
            '[INVITE_DEBUG v4] signature matches on-chain:',
            String(onchainHash).toLowerCase() === recoveredHash.toLowerCase(),
          );
        }

        const mintedTokens = await this.getMintedTokens('none', SBTAddress, '');
        inviteLog.log('[INVITE_DEBUG v4] mintedTokens:', mintedTokens);
        if (mintedTokens != null) {
          try {
            const expected = ethers.BigNumber.from(mintedTokens).add(1).toString();
            inviteLog.log('[INVITE_DEBUG v4] expected nonce:', expected);
          } catch {}
        }

        try {
          const signerHash = await CustomSBT.groupPasswordHash?.().catch(() => null);
          if (signerHash) {
            inviteLog.log('[INVITE_DEBUG v4] signer groupPasswordHash:', signerHash);
            inviteLog.log(
              '[INVITE_DEBUG v4] signature matches signer:',
              String(signerHash).toLowerCase() === recoveredHash.toLowerCase(),
            );
          }
        } catch {}

        try {
          const signerMinted = await CustomSBT.mintedTokens?.().catch(() => null);
          if (signerMinted != null) {
            inviteLog.log('[INVITE_DEBUG v4] signer mintedTokens:', ethers.BigNumber.from(signerMinted).toString());
          }
        } catch {}

        try {
          let readProvider = null;
          let readChainId = null;
          try {
            const net = await ethersProvider.getNetwork();
            readChainId = net?.chainId;
            inviteLog.log('[INVITE_DEBUG v4] signer chainId:', readChainId);
          } catch {}

          if (readChainId) {
            try {
              readProvider = getReadProviderForChain(readChainId);
            } catch {
              readProvider = null;
            }
          }

          if (readProvider) {
            const readContract = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, readProvider as any);
            const [mintingEndTime, maxTokens, hasPasswordMint, userTokenId] = await Promise.all([
              readContract.mintingEndTime?.().catch(() => null),
              readContract.maxTokens?.().catch(() => null),
              readContract.hasPasswordMint?.().catch(() => null),
              readContract.getTokenIdByOwner?.(signerAddress || ethers.constants.AddressZero).catch(() => null),
            ]);
            let code = null;
            let balanceOf = null;
            try {
              code = signerAddress ? await readProvider.getCode(signerAddress) : null;
            } catch {}
            try {
              balanceOf = signerAddress ? await readContract.balanceOf?.(signerAddress).catch(() => null) : null;
            } catch {}
            const endSec = mintingEndTime != null ? Number(ethers.BigNumber.from(mintingEndTime).toString()) : null;
            const nowSec = Math.floor(Date.now() / 1000);
            inviteLog.log('[INVITE_DEBUG v4] mintingEndTime:', endSec, 'now:', nowSec);
            inviteLog.log(
              '[INVITE_DEBUG v4] maxTokens:',
              maxTokens != null ? ethers.BigNumber.from(maxTokens).toString() : null,
            );
            inviteLog.log('[INVITE_DEBUG v4] hasPasswordMint:', hasPasswordMint);
            inviteLog.log(
              '[INVITE_DEBUG v4] userTokenId:',
              userTokenId != null ? ethers.BigNumber.from(userTokenId).toString() : null,
            );
            if (code != null) {
              inviteLog.log('[INVITE_DEBUG v4] signer code length:', code.length);
              inviteLog.log('[INVITE_DEBUG v4] signer is contract:', code !== '0x');
            }
            if (balanceOf != null) {
              inviteLog.log('[INVITE_DEBUG v4] balanceOf:', ethers.BigNumber.from(balanceOf).toString());
            }

            try {
              await readContract.callStatic.claimWithInvite(nonce, signature, { from: signerAddress || undefined });
              inviteLog.log('[INVITE_DEBUG v4] read callStatic.claimWithInvite: ok');
            } catch (callErr: any) {
              const errMsg =
                callErr?.reason ||
                callErr?.errorName ||
                callErr?.error?.message ||
                callErr?.data?.message ||
                callErr?.message ||
                callErr;
              inviteLog.warn('[INVITE_DEBUG v4] read callStatic.claimWithInvite failed:', errMsg);
            }
          } else {
            inviteLog.warn('[INVITE_DEBUG v4] read provider unavailable; skipping read callStatic');
          }

          try {
            await CustomSBT.callStatic.claimWithInvite(nonce, signature, { from: signerAddress || undefined });
            inviteLog.log('[INVITE_DEBUG v4] signer callStatic.claimWithInvite: ok');
          } catch (callErr: any) {
            const errMsg =
              callErr?.reason ||
              callErr?.errorName ||
              callErr?.error?.message ||
              callErr?.data?.message ||
              callErr?.message ||
              callErr;
            inviteLog.error('[INVITE_DEBUG v4] signer callStatic.claimWithInvite failed:', errMsg);
            if (callErr instanceof Error) {
              callStaticFailure = callErr;
            } else {
              callStaticFailure = new Error(String(errMsg || 'callStatic.claimWithInvite failed'));
            }
          }
        } catch (metaErr: any) {
          inviteLog.warn('[INVITE_DEBUG v4] metadata checks failed:', metaErr?.message || metaErr);
        }
      } catch (preErr: any) {
        inviteLog.warn('[INVITE_DEBUG v4] preflight check failed:', preErr?.message || preErr);
      }
      if (callStaticFailure) {
        throw callStaticFailure;
      }
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'claimWithInvite',
        args: [nonce, signature],
        fallbackGasLimit: '10000000',
        minEstimate: '120000',
        logLabel: 'claimWithInvite',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'claimWithInvite',
        method: 'CustomSBT.claimWithInvite',
        params: {
          nonce,
          signatureLength: signature ? signature.length : 0,
          gasLimit: txOverrides?.gasLimit?.toString?.() || null,
        },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'claimWithInvite',
        args: [nonce, signature],
        txOverrides,
        rpcFunction: 'claimWithInvite',
        revertMessage: 'claimWithInvite transaction reverted on-chain.',
      });
      return receipt;
    },

    isPasswordValid: async function (
      providerLike: any,
      sbtAddress: any,
      hashedPasswordBytes32: any,
      groupKeyOrCfg: any = null,
    ) {
      try {
        const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
        const chId =
          Number(cfg?.networkChainId || cfg?.contracts?.sbtFactory?.chainId || cfg?.contracts?.surveys?.chainId || 0) ||
          undefined;

        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);

        let ok = false;
        try {
          const contract = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
          ok = await callWithRetry(() => contract.isPasswordValid(hashedPasswordBytes32), 'CustomSBT.isPasswordValid');
        } catch (e: any) {
          inviteLog.error('[LIMITED][isPasswordValid] call failed:', e);
          ok = false;
        }
        inviteLog.log(`[LIMITED][isPasswordValid] sbt=${sbtAddress}, hash=${hashedPasswordBytes32}, ok=${ok}`);
        return ok;
      } catch (e: any) {
        inviteLog.error('[LIMITED][isPasswordValid] provider resolution failed:', e);
        return false;
      }
    },

    /**
     * Deterministic group password hash scoped to an SBT address.
     * Predeploy callers fall back to AddressZero by passing an empty sbtAddress.
     */
    computeGroupPasswordHash({ password, sbtAddress, adminAddress, chainId, name, symbol, tokenURI }: any) {
      return cryptoUtils.computeGroupPasswordHash({
        password,
        sbtAddress,
        adminAddress,
        chainId,
        name,
        symbol,
        tokenURI,
      } as any);
    },

    async signGroupMintAuthorization({
      password,
      sbtAddress,
      userAddress,
      walletScopeSbtAddress,
    }: SignGroupMintAuthorizationInput) {
      const resolvedWalletScopeSbtAddress = await resolveGroupPasswordWalletScopeSbtAddress({
        password,
        sbtAddress,
        walletScopeSbtAddress,
        getGroupPasswordHashFn: this.getGroupPasswordHash.bind(this),
      });
      rpcLog('Local Sign (SBT-scoped group signature):', {
        function: 'signGroupMintAuthorization',
        params: { sbtAddress, userAddress },
      });
      return cryptoUtils.signGroupMintAuthorization({
        password,
        sbtAddress,
        userAddress,
        walletScopeSbtAddress: resolvedWalletScopeSbtAddress,
      });
    },

    async generateInvitePayloads({ password, sbtAddress, nonces, walletScopeSbtAddress }: any) {
      if (!Array.isArray(nonces) || nonces.length === 0) {
        throw new Error('generateInvitePayloads requires a non-empty nonces array.');
      }
      const normalizedPassword = cryptoUtils.normalizeGroupPasswordInput(password);
      if (!normalizedPassword) {
        throw new Error('generateInvitePayloads requires a non-empty group password.');
      }
      const resolvedWalletScopeSbtAddress = await resolveGroupPasswordWalletScopeSbtAddress({
        password: normalizedPassword,
        sbtAddress,
        walletScopeSbtAddress,
        getGroupPasswordHashFn: this.getGroupPasswordHash.bind(this),
      });
      inviteLog.log('[INVITE_DEBUG v4] generateInvitePayloads (SBT-scoped derivation)', {
        sbtAddress,
        nonceCount: nonces.length,
      });
      try {
        const localHash = cryptoUtils.computeGroupPasswordHash({
          password: normalizedPassword,
          sbtAddress: resolvedWalletScopeSbtAddress,
        });
        inviteLog.log('[INVITE_DEBUG v4] derived groupPasswordHash:', localHash);
      } catch {}
      const out: InvitePayloadResult[] = [];
      for (const nonce of nonces) {
        const signature = await cryptoUtils.signInvite({
          password: normalizedPassword,
          sbtAddress,
          nonce,
          walletScopeSbtAddress: resolvedWalletScopeSbtAddress,
        });
        const payload: EncodedInvitePayload = { n: String(nonce), s: signature };
        const inviteCode = cryptoUtils.encodeInvite(payload);
        out.push({ nonce: String(nonce), signature, inviteCode });
      }
      return out;
    },

    // "Group" here refers to SBT token group/collection, not session group
    /** Read helper for on-chain groupPasswordHash */
    async getGroupPasswordHash(
      providerName: SbtReadProviderRef,
      SBTAddress: string,
      groupKeyOrCfg: SbtReadGroupKeyOrConfig = null,
      options: SbtReadOptions = {},
    ) {
      try {
        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);
        if (!CustomSBT.groupPasswordHash) return null;
        const v = await callWithRetry(() => CustomSBT.groupPasswordHash(), 'CustomSBT.groupPasswordHash');
        return v;
      } catch (error: any) {
        try {
          const win: any = typeof window !== 'undefined' ? window : {};
          const fallback = resolveReadProvider({
            groupKeyOrCfg,
            readOptions: SBT_READ_PROVIDER_OPTIONS,
            allowInjectedReadFallback: !!options?.allowInjectedReadFallback,
            injectedProvider: win.ethereum,
            readProviderFactory: () => {
              throw error;
            },
          });
          if (fallback.ok && fallback.source === 'injected-wallet') {
            const provider = new ethers.providers.Web3Provider(fallback.provider as any, 'any');
            const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);
            if (!CustomSBT.groupPasswordHash) return null;
            inviteLog.warn(
              '[INVITE_DEBUG v2] getGroupPasswordHash falling back to injected provider by explicit opt-in',
            );
            const v = await CustomSBT.groupPasswordHash();
            return v;
          }
        } catch {}
        return null;
      }
    },

    /** Read helper for on-chain mintedTokens */
    async getMintedTokens(
      providerName: SbtReadProviderRef,
      SBTAddress: string,
      groupKeyOrCfg: SbtReadGroupKeyOrConfig = null,
      options: SbtReadOptions = {},
    ) {
      try {
        if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) return null;
        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const CustomSBT = new ethers.Contract(
          SBTAddress,
          ['function mintedTokens() view returns (uint256)'],
          provider as any,
        );
        const v = await callWithRetry(() => CustomSBT.mintedTokens(), 'CustomSBT.mintedTokens');
        return v != null ? v.toString() : null;
      } catch (error: any) {
        try {
          const win: any = typeof window !== 'undefined' ? window : {};
          const fallback = resolveReadProvider({
            groupKeyOrCfg,
            readOptions: SBT_READ_PROVIDER_OPTIONS,
            allowInjectedReadFallback: !!options?.allowInjectedReadFallback,
            injectedProvider: win.ethereum,
            readProviderFactory: () => {
              throw error;
            },
          });
          if (fallback.ok && fallback.source === 'injected-wallet') {
            const provider = new ethers.providers.Web3Provider(fallback.provider as any, 'any');
            const CustomSBT = new ethers.Contract(
              SBTAddress,
              ['function mintedTokens() view returns (uint256)'],
              provider as any,
            );
            inviteLog.warn('[INVITE_DEBUG v2] getMintedTokens falling back to injected provider by explicit opt-in');
            const v = await CustomSBT.mintedTokens();
            return v != null ? v.toString() : null;
          }
        } catch {}
        return null;
      }
    },

    async getSbtHistorySummary(
      providerName: SbtReadProviderRef,
      SBTAddress: string,
      groupKeyOrCfg: SbtReadGroupKeyOrConfig = null,
    ) {
      try {
        if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) return null;
        const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
        const CustomSBT = new ethers.Contract(
          SBTAddress,
          [
            'function getHistorySummary() view returns (uint256 totalMinted,uint256 totalBurned,uint256 activeSupply,uint256 currentHolderCount,uint256 historicalHolderCount)',
          ],
          provider as any,
        );
        const summary = await callWithRetry(() => CustomSBT.getHistorySummary(), 'CustomSBT.getHistorySummary');
        return normalizeSbtHistorySummary(summary);
      } catch {
        try {
          if (typeof window !== 'undefined' && window.ethereum) {
            const provider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
            const CustomSBT = new ethers.Contract(
              SBTAddress,
              [
                'function getHistorySummary() view returns (uint256 totalMinted,uint256 totalBurned,uint256 activeSupply,uint256 currentHolderCount,uint256 historicalHolderCount)',
              ],
              provider as any,
            );
            inviteLog.warn('[INVITE_DEBUG v2] getSbtHistorySummary falling back to injected provider');
            const summary = await CustomSBT.getHistorySummary();
            return normalizeSbtHistorySummary(summary);
          }
        } catch {}
        return null;
      }
    },

    computeGroupMintMessageHash: function (sbtAddress: any, userAddress: any) {
      return cryptoUtils.computeGroupMintMessageHash(sbtAddress, userAddress);
    },

    mintWithGroupSignature: async function (providerName: any, SBTAddress: any, signature: any) {
      if (providerName === 'none')
        throw new Error('mintWithGroupSignature requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'mintWithGroupSignature',
        args: [signature],
        fallbackGasLimit: '700000',
        minEstimate: '120000',
        logLabel: 'mintWithGroupSignature',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'mintWithGroupSignature',
        method: 'CustomSBT.mintWithGroupSignature',
        params: { signatureLength: signature ? signature.length : 0 },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'mintWithGroupSignature',
        args: [signature],
        txOverrides,
        rpcFunction: 'mintWithGroupSignature',
        revertMessage: 'mintWithGroupSignature transaction reverted on-chain.',
      });
      return receipt;
    },

    claim: async function (providerName: any, SBTAddress: any) {
      if (providerName === 'none') throw new Error('claim requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'claim',
        args: [],
        fallbackGasLimit: '400000',
        minEstimate: '70000',
        logLabel: 'claim',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', { function: 'claim', method: 'CustomSBT.claim', params: {} });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'claim',
        args: [],
        txOverrides,
        rpcFunction: 'claim',
        revertMessage: 'claim transaction reverted on-chain.',
      });
      return receipt;
    },

    addHashedPasswords: async function (providerName: any, SBTAddress: any, hashedPasswords: any) {
      if (providerName === 'none')
        throw new Error('addHashedPasswords requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'addHashedPasswords',
        args: [hashedPasswords],
        fallbackGasLimit: String(GAS_FALLBACKS.addHashedPasswords(hashedPasswords.length)),
        minEstimate: '100000',
        logLabel: 'addHashedPasswords',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'addHashedPasswords',
        method: 'CustomSBT.addHashedPasswords',
        params: { hashedPasswordsCount: hashedPasswords.length },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'addHashedPasswords',
        args: [hashedPasswords],
        txOverrides,
        rpcFunction: 'addHashedPasswords',
        revertMessage: 'addHashedPasswords transaction reverted on-chain.',
      });
      return receipt;
    },

    burnToken: async function (providerName: any, SBTAddress: any, tokenId: any) {
      if (providerName === 'none') throw new Error('burnToken requires a signer-capable provider (not read-only).');
      const providerLocation = this.getProviderLocation(providerName);
      const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
      const signer = ethersProvider.getSigner();
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
      const tokenIdFormatted = this.getBigNumber(tokenId);
      const txOverrides = await resolveTxGasOverrides({
        contract: CustomSBT,
        method: 'burn',
        args: [tokenIdFormatted],
        fallbackGasLimit: '500000',
        minEstimate: '100000',
        logLabel: 'burnToken',
        preferFallbackGasLimit: true,
      });
      rpcLog('RPC Call (Tx):', {
        function: 'burnToken',
        method: 'CustomSBT.burn',
        params: { tokenId: tokenIdFormatted.toString() },
      });
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: CustomSBT,
        method: 'burn',
        args: [tokenIdFormatted],
        txOverrides,
        rpcFunction: 'burnToken',
        revertMessage: 'burnToken transaction reverted on-chain.',
      });
      return receipt;
    },

    async userHasSBT(
      providerName: any,
      SBTAddress: any,
      userAddress: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      groupKeyOrCfg: any = null,
    ) {
      // Resolve group-aware read provider
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);

      void fromBlock;
      void toBlock;

      // Fast path: use the dedicated owner mapping when available.
      try {
        if (ethers.utils.isAddress(userAddress) && CustomSBT && typeof CustomSBT.getTokenIdByOwner === 'function') {
          const tokenId = await callWithRetry(
            () => CustomSBT.getTokenIdByOwner(userAddress),
            'CustomSBT.getTokenIdByOwner (userHasSBT)',
          );
          if (tokenId && typeof tokenId.gt === 'function' && tokenId.gt(0)) return true;
        }
      } catch {
        // Fall back to balanceOf below if the helper is unavailable.
      }

      try {
        if (ethers.utils.isAddress(userAddress) && CustomSBT && typeof CustomSBT.balanceOf === 'function') {
          const bal = await callWithRetry(() => CustomSBT.balanceOf(userAddress), 'CustomSBT.balanceOf (userHasSBT)');
          if (bal && typeof bal.gt === 'function' && bal.gt(0)) return true;
        }
      } catch {
        // Fall through to false when neither direct ownership helper succeeds.
      }

      return false;
    },

    userCanBurnSBTs: async function (providerName: any, SBTAddress: any, userAddress: any, groupKeyOrCfg: any = null) {
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);

      const admin = await callWithRetry(() => CustomSBT.admin(), 'CustomSBT.admin (userCanBurnSBTs)');
      const burnAuth = await callWithRetry(
        () => CustomSBT.collectionBurnAuth(),
        'CustomSBT.collectionBurnAuth (userCanBurnSBTs)',
      );
      const burnAuthNum = ethers.BigNumber.isBigNumber(burnAuth) ? burnAuth.toNumber() : Number(burnAuth);
      const hasSBT = await this.userHasSBT('none', SBTAddress, userAddress, 0, 'latest', groupKeyOrCfg);
      const isAdmin = normalizeAddress(admin) === normalizeAddress(userAddress);

      if (burnAuthNum === 0) return isAdmin;
      if (burnAuthNum === 1) return hasSBT;
      if (burnAuthNum === 2) return isAdmin || hasSBT;
      return false;
    },

    async getCachedSbtMintBurnCountsByAddress(
      providerName: any,
      SBTAddress: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      groupKeyOrCfg: any = null,
    ) {
      const scanFn = this.getSbtMintBurnCountsByAddress;
      if (typeof scanFn !== 'function') {
        return {
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          scannedToBlock: null,
          ok: false,
        };
      }
      const self = scanFn as any;
      const memo = (self._sharedAddressMemo ??= {});
      const inflight = (self._sharedAddressInflight ??= {});
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const scopeTag = buildSbtScopeMemoTag(groupKeyOrCfg, cfg);
      const memoKey = [
        String(providerName || 'none'),
        normalizeAddress(SBTAddress || ''),
        String(fromBlock ?? ''),
        String(toBlock ?? ''),
        scopeTag,
      ].join(':');
      const TTL_MS = 45 * 1000;
      const now = Date.now();
      const hit = memo[memoKey];
      if (hit && now - hit.ts < TTL_MS) return hit.value;
      if (inflight[memoKey]) return inflight[memoKey];
      const run = Promise.resolve(scanFn.call(this, providerName, SBTAddress, fromBlock, toBlock, groupKeyOrCfg))
        .then((value: SbtMintBurnCountsByAddressResult) => {
          memo[memoKey] = { ts: Date.now(), value };
          return value;
        })
        .finally(() => {
          if (inflight[memoKey] === run) delete inflight[memoKey];
        });
      inflight[memoKey] = run;
      return run;
    },

    async getAddressesWhoMintedSBT(
      providerName: any,
      SBTAddress: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      groupKeyOrCfg: any = null,
    ) {
      const counts = await this.getCachedSbtMintBurnCountsByAddress(
        providerName,
        SBTAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
      );
      return Object.keys(counts?.mintedCountByAddress || {});
    },

    async getAddressesWhoBurnedSBT(
      providerName: any,
      SBTAddress: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      groupKeyOrCfg: any = null,
    ) {
      const counts = await this.getCachedSbtMintBurnCountsByAddress(
        providerName,
        SBTAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
      );
      return Object.keys(counts?.burnedCountByAddress || {});
    },
  };
};
