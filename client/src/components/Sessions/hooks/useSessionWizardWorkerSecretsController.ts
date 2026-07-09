import { useCallback, useEffect, useMemo, type MutableRefObject } from 'react';
import {
  createLitHooks,
  getGlobalLitHooks,
  resolveLitChain,
  setGlobalLitHooks,
} from '../../../utilities/crypto/litProtocol.js';
import { buildSponsoredFlagFields as buildSponsoredSessionFlagFields } from '../../../utilities/session/sponsoredFlags.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import {
  arweavePublishAdapter,
  workerAuthPublishAdapter,
} from '../../../domains/sessions/publish/sessionPublishAdapters.js';
import { resolveSessionWizardResourceSecretFields } from '../sessionWizardResourceConfig';
import { normalizeSessionWizardSlug as normalizeSlug } from '../sessionWizardUrlSupport';
import {
  parseSessionWizardAllowOriginsInput,
  resolveSessionWizardWorkerBaseUrlFromDraft,
  resolveSessionWizardWorkerFaucetConfigFromDraft,
  resolveSessionWizardWorkerRpcUrlFromDraft,
  resolveSessionWizardWorkerRpcUrlMapFromDraft,
} from '../sessionWizardWorkerRuntimeSupport';
import {
  CHIPOTLE_LIT_CONFIG_FIELDS,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from '../sessionWizardWorkerSecretSupport';
import type { AnyRecord, ChainIdLike, NetworkLike, WorkerSecretsLike } from '../../shellTypes';

type BootstrapAdminActionInput = {
  statement?: unknown;
  targetSlug?: unknown;
  workerUrl?: unknown;
  accountOverride?: unknown;
};

type TypedAdminActionInput = {
  action?: string;
  body?: AnyRecord;
  targetSlug?: unknown;
  workerUrl?: unknown;
  accountOverride?: unknown;
};

type PublishArweaveUploadOptionsInput = {
  arweaveJwk?: string;
  workerUrl?: string;
  sessionSlug?: string;
  authAccount?: string;
};

type UseSessionWizardWorkerSecretsControllerOptions = {
  account?: string;
  provider?: unknown;
  network?: NetworkLike;
  draft: AnyRecord;
  wizardMode: string;
  deployComplete: boolean;
  deployWorkerUrl: string;
  workerMode: string;
  workerSecrets: WorkerSecretsLike;
  workerSecretsEnabled: boolean;
  workerAllowOrigins: string;
  provisionedSponsoredContext?: AnyRecord | null;
  effectivePersistWorkerSecrets: boolean;
  registryChainId?: ChainIdLike;
  allowNormalModeSharedHostedWorker: boolean;
  getCurrentWorkerSecrets: () => WorkerSecretsLike;
  getCurrentEnabledWorkerSecrets: () => WorkerSecretsLike;
  applyWorkerSecretsUpdate: (nextValueOrUpdater: unknown) => unknown;
  updateDraftValue: (path: string[], value: unknown) => void;
  resolvedWalletAccountRef: MutableRefObject<string>;
  resolveChipotleHookConfig: (input: {
    workerSecretsEnabled?: boolean;
    workerSecrets?: WorkerSecretsLike | AnyRecord;
    resolvedWorkerUrl?: string;
    draft?: AnyRecord | null;
  }) => AnyRecord | null;
};

const useSessionWizardWorkerSecretsController = ({
  account,
  provider,
  network,
  draft,
  wizardMode,
  deployComplete,
  deployWorkerUrl,
  workerMode,
  workerSecrets,
  workerSecretsEnabled,
  workerAllowOrigins,
  provisionedSponsoredContext,
  effectivePersistWorkerSecrets,
  registryChainId,
  allowNormalModeSharedHostedWorker,
  getCurrentWorkerSecrets,
  getCurrentEnabledWorkerSecrets,
  applyWorkerSecretsUpdate,
  updateDraftValue,
  resolvedWalletAccountRef,
  resolveChipotleHookConfig,
}: UseSessionWizardWorkerSecretsControllerOptions) => {
  const resolveWorkerBaseUrl = useCallback(
    () =>
      resolveSessionWizardWorkerBaseUrlFromDraft({
        draft,
        wizardMode,
        deployComplete,
        deployWorkerUrl,
        workerMode,
        allowNormalModeSharedHostedWorker,
      }),
    [allowNormalModeSharedHostedWorker, deployComplete, deployWorkerUrl, draft, wizardMode, workerMode],
  );

  const resolveWorkerRpcUrl = useCallback(
    () =>
      resolveSessionWizardWorkerRpcUrlFromDraft({
        draft,
        registryChainId,
        networkId: network?.id,
        workerSecrets: getCurrentEnabledWorkerSecrets(),
      }),
    [draft, getCurrentEnabledWorkerSecrets, network?.id, registryChainId],
  );

  const resolveWorkerRpcUrlMap = useCallback(
    () =>
      resolveSessionWizardWorkerRpcUrlMapFromDraft({
        draft,
        registryChainId,
        networkId: network?.id,
        workerSecrets: getCurrentEnabledWorkerSecrets(),
      }),
    [draft, getCurrentEnabledWorkerSecrets, network?.id, registryChainId],
  );

  const resolveWorkerFaucetConfig = useCallback(
    () =>
      resolveSessionWizardWorkerFaucetConfigFromDraft({
        draft,
        registryChainId,
        networkId: network?.id,
        workerSecrets: getCurrentEnabledWorkerSecrets(),
      }),
    [draft, getCurrentEnabledWorkerSecrets, network?.id, registryChainId],
  );

  const parseAllowOriginsInput = useCallback(
    () => parseSessionWizardAllowOriginsInput(workerAllowOrigins),
    [workerAllowOrigins],
  );

  const resolvedWorkerBaseUrlForDelegation = resolveWorkerBaseUrl();
  const effectiveDefaultWorkerRpcUrl = toStr(resolveWorkerRpcUrl()).trim();

  const getResourceSecretFields = useCallback(
    (resourceKey: string) => {
      return resolveSessionWizardResourceSecretFields(resourceKey, draft?.ai);
    },
    [draft?.ai],
  );

  const buildSponsoredFlagFields = useCallback(
    (secretsSnapshot: WorkerSecretsLike = getCurrentWorkerSecrets()) => {
      const currentSlug = normalizeSlug(draft?.slug || '');
      const currentWorkerUrl = workerAuthPublishAdapter.normalizeWorkerUrl(resolvedWorkerBaseUrlForDelegation);
      const fallbackFields =
        currentSlug &&
        currentSlug === normalizeSlug(provisionedSponsoredContext?.sessionSlug || '') &&
        (!currentWorkerUrl ||
          !provisionedSponsoredContext?.workerUrl ||
          currentWorkerUrl === provisionedSponsoredContext.workerUrl)
          ? provisionedSponsoredContext?.fields
          : {};

      return buildSponsoredSessionFlagFields({
        secrets: sanitizeSessionWizardWorkerSecretsForLitMode(secretsSnapshot),
        fallbackFields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(fallbackFields),
        workerSecretsEnabled,
      });
    },
    [
      draft?.slug,
      getCurrentWorkerSecrets,
      provisionedSponsoredContext,
      resolvedWorkerBaseUrlForDelegation,
      workerSecretsEnabled,
    ],
  );

  const getMissingWorkerSecretsForDeploy = useCallback(
    (secretsSnapshot = getCurrentWorkerSecrets()) => {
      const missing = [];
      if (!toStr(secretsSnapshot.openaiKey).trim()) {
        missing.push('OpenAI key');
      }
      if (!toStr(secretsSnapshot.arweaveJwk).trim()) missing.push('Arweave JWK');
      const rpcUrl = resolveWorkerRpcUrl();
      if (!rpcUrl) missing.push('Worker RPC URL');
      const hasAnyChipotleField =
        CHIPOTLE_LIT_CONFIG_FIELDS.some((key) => !!toStr(secretsSnapshot?.[key]).trim()) ||
        !!toStr(secretsSnapshot?.litAccountApiKey).trim() ||
        !!toStr(secretsSnapshot?.litUsageApiKey).trim();
      const accountKeyOnlyChipotleConfig = !!toStr(secretsSnapshot?.litAccountApiKey).trim();
      const bootstrapOnlyChipotleConfig =
        accountKeyOnlyChipotleConfig ||
        (!!toStr(secretsSnapshot?.litApiBase).trim() &&
          !toStr(secretsSnapshot?.litGroupId).trim() &&
          !toStr(secretsSnapshot?.litPkpId).trim() &&
          !toStr(secretsSnapshot?.litActionCid).trim() &&
          !toStr(secretsSnapshot?.litUsageApiKey).trim());
      if (hasAnyChipotleField && !bootstrapOnlyChipotleConfig) {
        const requiredChipotleFields = [
          ['litApiBase', 'Lit API base'],
          ['litGroupId', 'Lit group ID'],
          ['litPkpId', 'Lit PKP ID'],
        ];
        requiredChipotleFields.forEach(([key, label]) => {
          if (!toStr(secretsSnapshot?.[key]).trim()) missing.push(label);
        });
      }
      return missing;
    },
    [getCurrentWorkerSecrets, resolveWorkerRpcUrl],
  );

  const chipotleHookWorkerSecrets = useMemo<WorkerSecretsLike>(
    () => ({
      litApiBase: workerSecrets.litApiBase,
      litGroupId: workerSecrets.litGroupId,
      litPkpId: workerSecrets.litPkpId,
      litActionCid: workerSecrets.litActionCid,
      litAccountApiKey: workerSecrets.litAccountApiKey,
      litUsageApiKey: workerSecrets.litUsageApiKey,
    }),
    [
      workerSecrets.litAccountApiKey,
      workerSecrets.litActionCid,
      workerSecrets.litApiBase,
      workerSecrets.litGroupId,
      workerSecrets.litPkpId,
      workerSecrets.litUsageApiKey,
    ],
  );

  useEffect(() => {
    const previousHooks = getGlobalLitHooks();
    const chainId = Number(registryChainId || draft?.networkChainId || network?.id || 0) || null;
    const chipotle = resolveChipotleHookConfig({
      workerSecretsEnabled,
      workerSecrets: chipotleHookWorkerSecrets,
      resolvedWorkerUrl: resolvedWorkerBaseUrlForDelegation,
      draft,
    });
    const nextHooks = chipotle
      ? createLitHooks({
          providerLike: provider,
          account,
          chainId,
          litChain: resolveLitChain({ chainId }),
          litNetwork: 'chipotle',
          chipotle,
        })
      : null;
    setGlobalLitHooks(nextHooks);
    return () => {
      setGlobalLitHooks(previousHooks);
    };
  }, [
    account,
    draft,
    network?.id,
    provider,
    registryChainId,
    resolveChipotleHookConfig,
    resolvedWorkerBaseUrlForDelegation,
    chipotleHookWorkerSecrets,
    workerSecretsEnabled,
  ]);

  const clearWorkerSecretFields = useCallback(() => {
    const aiConfig = draft?.ai && typeof draft.ai === 'object' && !Array.isArray(draft.ai) ? draft.ai : {};
    const aiProviders =
      aiConfig.providers && typeof aiConfig.providers === 'object' && !Array.isArray(aiConfig.providers)
        ? (aiConfig.providers as AnyRecord)
        : {};
    Object.keys(aiProviders).forEach((key) => {
      updateDraftValue(['ai', 'providers', key, 'apiKey'], '');
      updateDraftValue(['ai', 'providers', key, 'encryptedApiKey'], '');
    });
    const rpcConfig = draft?.rpc && typeof draft.rpc === 'object' && !Array.isArray(draft.rpc) ? draft.rpc : {};
    const rpcProviders =
      rpcConfig.providers && typeof rpcConfig.providers === 'object' && !Array.isArray(rpcConfig.providers)
        ? (rpcConfig.providers as AnyRecord)
        : {};
    Object.keys(rpcProviders).forEach((key) => {
      updateDraftValue(['rpc', 'providers', key, 'apiKey'], '');
      updateDraftValue(['rpc', 'providers', key, 'encryptedApiKey'], '');
    });
    updateDraftValue(['arweave', 'jwk'], '');
    updateDraftValue(['arweave', 'encryptedJwk'], '');
    updateDraftValue(['faucet', 'privateKey'], '');
    updateDraftValue(['faucet', 'encryptedPrivateKey'], '');
  }, [draft?.ai, draft?.rpc, updateDraftValue]);

  const clearCachedWorkerSecretsAfterDeploy = useCallback(() => {
    if (effectivePersistWorkerSecrets) return;
  }, [effectivePersistWorkerSecrets]);

  const clearCachedArweaveJwkAfterUpload = useCallback(() => {
    if (effectivePersistWorkerSecrets) return;
    applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({ ...prev, arweaveJwk: '' }));
  }, [applyWorkerSecretsUpdate, effectivePersistWorkerSecrets]);

  const signBootstrapAdminAction = useCallback(
    async ({
      statement = '',
      targetSlug = '',
      workerUrl = '',
      accountOverride = '',
    }: BootstrapAdminActionInput = {}) => {
      const baseUrl = workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrl || resolveWorkerBaseUrl()).trim());
      if (!baseUrl) throw new Error('Worker URL is missing.');
      const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
      return workerAuthPublishAdapter.buildSignedBootstrapAdminAuth({
        slug: normalizeSlug(targetSlug),
        workerUrl: baseUrl,
        statement: toStr(statement).trim(),
        context: {
          account: authAccount,
          chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
          providerLike: typeof provider === 'string' ? provider : undefined,
        },
      });
    },
    [
      account,
      draft.networkChainId,
      network?.id,
      provider,
      registryChainId,
      resolveWorkerBaseUrl,
      resolvedWalletAccountRef,
    ],
  );

  const buildSessionWizardPublishArweaveUploadOptions = useCallback(
    async ({
      arweaveJwk = '',
      workerUrl = '',
      sessionSlug = '',
      authAccount = '',
    }: PublishArweaveUploadOptionsInput = {}) =>
      arweavePublishAdapter.resolveUploadOptions({
        arweaveJwk,
        workerUrl,
        preferDirectArweaveUpload: !!toStr(arweaveJwk).trim(),
        allowDirectFallbackOnBootstrapFailure: false,
        requireAdminAuthWithoutJwk: true,
        buildAdminAuth: ({ workerUrl: resolvedWorkerUrl }) =>
          signBootstrapAdminAction({
            statement: 'Admin request: bootstrap arweave upload',
            targetSlug: sessionSlug,
            workerUrl: resolvedWorkerUrl,
            accountOverride: authAccount,
          }),
      }),
    [signBootstrapAdminAction],
  );

  const signTypedAdminAction = useCallback(
    async ({
      action = 'set-config',
      body = {},
      targetSlug = '',
      workerUrl = '',
      accountOverride = '',
    }: TypedAdminActionInput = {}) => {
      const baseUrl = workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrl || resolveWorkerBaseUrl()).trim());
      if (!baseUrl) throw new Error('Worker URL is missing.');
      const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
      return workerAuthPublishAdapter.buildSignedAdminActionAuth({
        action: toStr(action).trim() || 'set-config',
        slug: normalizeSlug(targetSlug),
        body,
        workerUrl: baseUrl,
        context: {
          account: authAccount,
          chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
          providerLike: typeof provider === 'string' ? provider : undefined,
        },
      });
    },
    [
      account,
      draft.networkChainId,
      network?.id,
      provider,
      registryChainId,
      resolveWorkerBaseUrl,
      resolvedWalletAccountRef,
    ],
  );

  return {
    buildSessionWizardPublishArweaveUploadOptions,
    buildSponsoredFlagFields,
    clearCachedArweaveJwkAfterUpload,
    clearCachedWorkerSecretsAfterDeploy,
    clearWorkerSecretFields,
    effectiveDefaultWorkerRpcUrl,
    getMissingWorkerSecretsForDeploy,
    getResourceSecretFields,
    parseAllowOriginsInput,
    resolveWorkerBaseUrl,
    resolveWorkerFaucetConfig,
    resolveWorkerRpcUrl,
    resolveWorkerRpcUrlMap,
    resolvedWorkerBaseUrlForDelegation,
    signBootstrapAdminAction,
    signTypedAdminAction,
  };
};

export default useSessionWizardWorkerSecretsController;
