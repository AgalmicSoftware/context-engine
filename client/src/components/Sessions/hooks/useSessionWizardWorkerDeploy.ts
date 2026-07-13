import { useCallback, useRef } from 'react';
import { normalizeSparseSponsoredBundlePayload } from '../../../utilities/arweave/sponsoredBundles.js';
import { normalizeBlockLimitsForConfig } from '../../../utilities/session/blockLimits.js';
import { buildSponsoredFlagFields as buildSponsoredSessionFlagFields } from '../../../utilities/session/sponsoredFlags.js';
import { cryptoUtils } from '../../../utilities/crypto/cryptography.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import {
  buildWorkerSecretsPayload,
  syncWorkerConfigAfterPartialDeploy,
  syncWorkerSecretsAfterDeploy,
  withSecretsSyncStatus,
  withWorkerConfigSyncWarning,
} from '../sessionWizardSecrets.js';
import {
  buildSessionWizardWorkerConfigPayload,
  resolveSessionWizardWorkerStorageProfilePayload,
} from '../sessionWizardWriteNormalization.js';
import {
  buildSessionWizardLitBootstrapRequest,
  buildSessionWizardLitProvisionRequest,
  syncWorkerLitActionProvisionAfterDeploy,
  syncWorkerLitSessionBootstrapAfterDeploy,
  withLitBootstrapSyncStatus,
  withLitProvisionSyncStatus,
} from '../sessionWizardChipotleLitSupport';
import {
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundleMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  shouldForceSessionWizardNormalModeManualBundleRetry,
} from '../sessionWizardPublishFlow';
import {
  normalizeSessionWizardDeployErrorMessage,
  withSessionWizardDeployHelperWorkersDevStatus,
} from '../sessionWizardDeployErrors';
import { resolveDeployWorkerState } from '../sessionWizardWorkerState';
import { getSessionSlugValidationError } from '../sessionWizardSlugValidation';
import {
  cacheSessionWorkerConfigAfterDeploy,
  resolveSponsoredBundleBootstrapWorkerUrl,
} from '../sessionWizardSponsoredBundleSupport';
import {
  isAiProviderWorkerSecretField,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from '../sessionWizardWorkerSecretSupport';
import { getSessionWizardWorkerDeployValidationError } from '../sessionWizardWorkerRpc';
import { resolveSessionWizardModeRequirements } from '../sessionWizardModeRequirements';
import {
  normalizeSessionWizardSlug as normalizeSlug,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
} from '../sessionWizardUrlSupport';
import type { AnyRecord, ChainIdLike, NetworkLike, WorkerSecretSyncResult, WorkerSecretsLike } from '../../shellTypes';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

type DeployFormLike = AnyRecord & {
  apiToken?: string;
  workerName?: string;
  adminAddress?: string;
  accountId?: string;
  bundleUrl?: string;
};

type DraftLike = AnyRecord & {
  slug?: string;
  corsWorkerUrl?: string;
  networkChainId?: ChainIdLike;
  blockLimits?: AnyRecord;
  contracts?: AnyRecord;
  rpc?: AnyRecord;
  faucet?: AnyRecord;
};

export type SessionWizardWorkerDeployRuntime = {
  account?: string;
  provider?: AnyRecord | null;
  network?: NetworkLike | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  toggleLoginModal?: ((nextOpen?: boolean) => unknown) | null;
  registryAddress?: string;
  registryChainId?: ChainIdLike;
  wizardMode?: string;
  workerMode?: string;
  bundleMode?: string;
  bundleFile?: File | null;
  forceManualBundleFile?: boolean;
  normalModeBundleUrlOverride?: string;
  workerSecretsEnabled?: boolean;
  workerLimitPerWallet?: string | number;
  embeddedDeployHelperEnabled?: boolean;
  deployHelperUrl?: string;
  latestChainBlock?: number | null;
  sessionId?: string | number | null;
  sessionIdHex?: string;
  draft?: DraftLike | null;
  deployForm?: DeployFormLike | null;
};

const isRecord = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);

const firstTrimmed = (...values: unknown[]): string => {
  for (const value of values) {
    const trimmed = toStr(value).trim();
    if (trimmed) return trimmed;
  }
  return '';
};

const resolveDeployOnlyR2BucketName = (draft: AnyRecord, deployPayload: AnyRecord): string => {
  const rawStorageProfile = isRecord(draft.storageProfile)
    ? draft.storageProfile
    : isRecord(deployPayload.storageProfile)
      ? deployPayload.storageProfile
      : {};
  const cloudflare = isRecord(rawStorageProfile.cloudflare) ? rawStorageProfile.cloudflare : {};
  const r2 = isRecord(cloudflare.r2) ? cloudflare.r2 : {};
  return firstTrimmed(
    rawStorageProfile.r2BucketName,
    rawStorageProfile.r2Bucket,
    rawStorageProfile.bucketName,
    rawStorageProfile.bucket,
    cloudflare.r2BucketName,
    cloudflare.r2Bucket,
    cloudflare.bucketName,
    cloudflare.bucket,
    r2.bucketName,
    r2.bucket,
  );
};

const buildDeployStorageProfilePayload = (draft: AnyRecord, deployPayload: AnyRecord): AnyRecord | null => {
  const { storageProfile } = resolveSessionWizardWorkerStorageProfilePayload({
    draft,
    deployPayload,
  });
  if (toStr(storageProfile.backend).trim().toLowerCase() !== 'cloudflare') return null;
  const r2BucketName = resolveDeployOnlyR2BucketName(draft, deployPayload);
  if (!r2BucketName) return storageProfile;
  return {
    ...storageProfile,
    cloudflare: {
      ...(isRecord(storageProfile.cloudflare) ? storageProfile.cloudflare : {}),
      r2BucketName,
    },
  };
};

type SessionWizardWorkerDeployStateUpdate = {
  deployForm?: DeployFormLike;
  deployStatus?: string;
  deployInFlight?: boolean;
  deployComplete?: boolean;
  workerUrlAutoFilled?: boolean;
  workerMode?: string;
  deployWorkerUrl?: string;
  provisionedSponsoredContext?: AnyRecord;
  forceManualBundleFile?: boolean;
  normalModeBundleUrlOverride?: string;
};

type UseSessionWizardWorkerDeployOptions = {
  refs?: {
    runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>;
    resolvedWalletAccountRef?: MutableRefObject<string>;
    sponsoredBundleAppliedBundleRef?: MutableRefObject<AnyRecord | null>;
  };
  getCurrentWorkerSecrets?: () => WorkerSecretsLike;
  applyWorkerSecretsUpdate?: (nextValueOrUpdater: unknown) => unknown;
  getMissingWorkerSecretsForDeploy?: (secretsSnapshot?: WorkerSecretsLike) => string[];
  resolveWorkerBaseUrl?: () => string;
  resolveWorkerRpcUrl?: () => string;
  resolveWorkerRpcUrlMap?: () => Record<string, string[]>;
  resolveWorkerFaucetConfig?: () => AnyRecord;
  parseAllowOriginsInput?: () => string[];
  signTypedAdminAction?: (options?: {
    action?: string;
    body?: AnyRecord;
    targetSlug?: string;
    workerUrl?: string;
    accountOverride?: string;
  }) => Promise<AnyRecord>;
  setDeployForm?: Dispatch<SetStateAction<DeployFormLike>>;
  updateDraftValue?: (path: string[], value: unknown) => void;
  updateDeploymentState?: (nextState?: SessionWizardWorkerDeployStateUpdate) => void;
  clearSelectedBundleFile?: () => void;
  clearCachedWorkerSecretsAfterDeploy?: () => void;
};

const readRuntime = (
  runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>,
): SessionWizardWorkerDeployRuntime => {
  const current = runtimeRef?.current;
  return current && typeof current === 'object' ? current : {};
};

const useSessionWizardWorkerDeploy = ({
  refs = {},
  getCurrentWorkerSecrets = () => ({}),
  applyWorkerSecretsUpdate = () => undefined,
  getMissingWorkerSecretsForDeploy = () => [],
  resolveWorkerBaseUrl = () => '',
  resolveWorkerRpcUrl = () => '',
  resolveWorkerRpcUrlMap = () => ({}),
  resolveWorkerFaucetConfig = () => ({}),
  parseAllowOriginsInput = () => [],
  signTypedAdminAction = async () => ({}),
  setDeployForm = () => undefined,
  updateDraftValue = () => undefined,
  updateDeploymentState = () => undefined,
  clearSelectedBundleFile = () => undefined,
  clearCachedWorkerSecretsAfterDeploy = () => undefined,
}: UseSessionWizardWorkerDeployOptions = {}) => {
  const { runtimeRef, resolvedWalletAccountRef, sponsoredBundleAppliedBundleRef } = refs;
  const deployRequestInFlightRef = useRef(false);

  const resolveConnectedAdminAddress = useCallback(async () => {
    const runtime = readRuntime(runtimeRef);
    const cachedResolved = toStr(resolvedWalletAccountRef?.current || runtime.account).trim();
    if (cachedResolved) return cachedResolved;

    const providerObj = cryptoUtils._getProvider(runtime.provider || 'wagmi');
    if (!providerObj) return '';

    let resolvedAddress = toStr(providerObj?.selectedAddress || providerObj?.address).trim();
    if (typeof providerObj.request === 'function') {
      try {
        const accounts = await providerObj.request({ method: 'eth_accounts' });
        if (Array.isArray(accounts) && accounts[0]) {
          resolvedAddress = toStr(accounts[0]).trim();
        }
      } catch (_) {}
    }

    if (resolvedAddress) {
      if (resolvedWalletAccountRef) {
        resolvedWalletAccountRef.current = resolvedAddress;
      }
      setDeployForm((prev) =>
        toStr(prev?.adminAddress).trim()
          ? prev
          : {
              ...(prev && typeof prev === 'object' ? prev : {}),
              adminAddress: resolvedAddress,
            },
      );
    }
    return resolvedAddress;
  }, [resolvedWalletAccountRef, runtimeRef, setDeployForm]);

  const handleDeployWorker = useCallback(
    async (options: { forceSponsoredAutoDeploy?: boolean } = {}) => {
      if (deployRequestInFlightRef.current) {
        const inFlightMessage = 'Worker deploy already in progress.';
        updateDeploymentState({ deployStatus: inFlightMessage });
        return { ok: false, skipped: true, error: inFlightMessage };
      }
      deployRequestInFlightRef.current = true;
      let helperBase = '';
      const forceSponsoredAutoDeploy = options?.forceSponsoredAutoDeploy === true;
      let effectiveBundleMode = 'upload';
      try {
        const runtime = readRuntime(runtimeRef);
        const currentDraft = runtime.draft && typeof runtime.draft === 'object' ? runtime.draft : {};
        const currentDeployForm =
          runtime.deployForm && typeof runtime.deployForm === 'object' ? runtime.deployForm : {};
        const rawSlug = toStr(currentDraft.slug).trim();
        const slugValidationError = getSessionSlugValidationError(rawSlug);
        if (slugValidationError) {
          updateDeploymentState({ deployStatus: slugValidationError });
          return { ok: false, error: slugValidationError };
        }
        if (runtime.loginComplete !== true) {
          const loginMessage = runtime.loginInProgress
            ? 'Finish logging in before deploying the worker.'
            : 'Connect your wallet to set the admin address.';
          if (typeof runtime.toggleLoginModal === 'function') runtime.toggleLoginModal(true);
          updateDeploymentState({ deployStatus: loginMessage });
          return { ok: false, error: loginMessage };
        }
        updateDeploymentState({
          deployStatus: 'Deploying worker…',
          deployInFlight: true,
          deployComplete: false,
          workerUrlAutoFilled: false,
        });
        const slug = normalizeSlug(rawSlug) || 'general';
        const resolvedAdmin = await resolveConnectedAdminAddress();
        if (!resolvedAdmin) {
          if (typeof runtime.toggleLoginModal === 'function') runtime.toggleLoginModal(true);
          throw new Error('Connect your wallet to set the admin address.');
        }
        const configuredWorkerUrlBeforeDeploy = normalizeWorkerUrl(toStr(currentDraft.corsWorkerUrl).trim());
        const modeRequirements = resolveSessionWizardModeRequirements(currentDraft.sessionModeProfile);
        const workerConfigError = getSessionWizardWorkerDeployValidationError({
          registryAddress: runtime.registryAddress,
          registryChainId: runtime.registryChainId,
          networkChainId: currentDraft.networkChainId,
          pathProvider: currentDraft?.rpc?.providers?.path || currentDraft?.rpc?.path || {},
          faucetRpcUrl: currentDraft?.faucet?.rpcUrl,
          requiresRegistry: !modeRequirements.selected || modeRequirements.publish.registerSession,
          requiresRpc: !modeRequirements.selected || modeRequirements.requiresRpc,
        });
        if (workerConfigError) {
          throw new Error(workerConfigError);
        }
        let currentWorkerSecrets = getCurrentWorkerSecrets();
        if (runtime.workerSecretsEnabled) {
          const missing = getMissingWorkerSecretsForDeploy(currentWorkerSecrets);
          if (missing.length) {
            throw new Error(`Missing required secrets before deploy: ${missing.join(', ')}`);
          }
        }
        // Regression guard: deploy-ready sponsored links still force the URL path
        // in normal mode, but manual retry must still be able to override that
        // path with an uploaded bundle file after a remote fetch failure.
        const sponsoredAutoDeployReady =
          runtime.workerMode !== 'default' &&
          resolveSessionWizardSponsoredAutoDeployReadiness({
            wizardMode: runtime.wizardMode,
            sponsoredBundle: sponsoredBundleAppliedBundleRef?.current || undefined,
            deployForm: currentDeployForm,
            workerSecretsEnabled: runtime.workerSecretsEnabled,
            currentWorkerSecrets,
            getMissingWorkerSecretsForDeploy,
            hasBundleFile: !!runtime.bundleFile,
            normalModeBundleUrlOverride: runtime.normalModeBundleUrlOverride,
          }).ready;
        effectiveBundleMode = resolveSessionWizardDeployBundleMode({
          wizardMode: runtime.wizardMode,
          bundleMode: runtime.bundleMode,
          bundleUrl: currentDeployForm.bundleUrl,
          sponsoredAutoDeployReady: forceSponsoredAutoDeploy || sponsoredAutoDeployReady,
          forceSponsoredAutoDeploy,
          forceManualBundleFile: runtime.forceManualBundleFile,
          hasBundleFile: !!runtime.bundleFile,
          normalModeBundleUrlOverride: runtime.normalModeBundleUrlOverride,
        });
        if (effectiveBundleMode === 'upload' && !runtime.bundleFile) {
          throw new Error(
            effectiveBundleMode === 'upload' && runtime.wizardMode === 'normal'
              ? 'Upload a worker bundle file before deploy.'
              : 'Upload a worker bundle file or switch to bundle URL.',
          );
        }
        const requestedBundleUrl = resolveSessionWizardBundleUrlForMode({
          wizardMode: runtime.wizardMode,
          bundleUrl: currentDeployForm.bundleUrl,
          normalModeBundleUrlOverride: runtime.normalModeBundleUrlOverride,
        });
        const { bundleText, bundleUrl } = await resolveSessionWizardDeployBundlePayload({
          effectiveBundleMode,
          bundleFile: runtime.bundleFile,
          bundleUrl: requestedBundleUrl,
        });
        const allDeploySecrets = runtime.workerSecretsEnabled ? buildWorkerSecretsPayload(currentWorkerSecrets) : {};
        const deploySecrets = modeRequirements.isWorkerCanonical
          ? Object.entries(allDeploySecrets).reduce<AnyRecord>((acc, [key, value]) => {
              const allowed =
                isAiProviderWorkerSecretField(key) ||
                (modeRequirements.requiresLit && key.startsWith('lit')) ||
                (modeRequirements.requiresRpc && (key === 'customRpcUrl' || key === 'customRpcKey'));
              if (allowed) acc[key] = value;
              return acc;
            }, {})
          : allDeploySecrets;
        const deployBlockLimits = normalizeBlockLimitsForConfig(currentDraft?.blockLimits, runtime.latestChainBlock);
        const deployStorageProfile = buildDeployStorageProfilePayload(currentDraft, {});
        const payload: AnyRecord = {
          workerName: currentDeployForm.workerName,
          sessionSlug: slug,
          bundleUrl,
          bundleText: bundleText || undefined,
          registryAddress: toStr(runtime.registryAddress).trim(),
          registryChainId: Number(runtime.registryChainId || currentDraft.networkChainId || 0) || 0,
          adminAddress: resolvedAdmin,
          rpcUrl: resolveWorkerRpcUrl(),
          rpcUrlsByChainId: resolveWorkerRpcUrlMap(),
          allowOrigins: parseAllowOriginsInput(),
          limits: Number(runtime.workerLimitPerWallet || 0)
            ? { perWalletPerDay: Number(runtime.workerLimitPerWallet) }
            : {},
          scopes: {},
          faucet: resolveWorkerFaucetConfig(),
          embeddedDeployHelperEnabled: runtime.embeddedDeployHelperEnabled,
        };
        const canonicalSeedConfig = buildSessionWizardWorkerConfigPayload({
          slug,
          draft: currentDraft,
          deployPayload: payload,
          workerSecrets: currentWorkerSecrets,
          account: resolvedAdmin,
          registryAddress: runtime.registryAddress,
          registryChainId: runtime.registryChainId,
          networkChainId: runtime.network?.id,
          sessionId: toStr(runtime.sessionId || '').trim(),
          latestChainBlock: runtime.latestChainBlock,
          resolveWorkerFaucetConfig,
        });
        [
          'sessionId',
          'sessionName',
          'sessionInfo',
          'sessionHeaderImg',
          'sessionModeProfile',
          'workerAuthority',
          'ai',
        ].forEach((key) => {
          if (canonicalSeedConfig[key] !== undefined) payload[key] = canonicalSeedConfig[key];
        });
        payload.configRevision =
          typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        if (deployBlockLimits) {
          payload.blockLimits = deployBlockLimits;
        }
        if (deployStorageProfile) {
          payload.storageProfile = deployStorageProfile;
        }
        if (modeRequirements.isWorkerCanonical) {
          delete payload.registryAddress;
          delete payload.registryChainId;
          delete payload.faucet;
          delete payload.blockLimits;
          if (!modeRequirements.requiresRpc) {
            delete payload.rpcUrl;
            delete payload.rpcUrlsByChainId;
          }
        }
        if (Object.keys(deploySecrets).length) {
          payload.secrets = deploySecrets;
        }
        const normalizedSponsoredBundle = normalizeSparseSponsoredBundlePayload(
          sponsoredBundleAppliedBundleRef?.current,
        );
        const sponsoredDeployGrantToken = toStr(normalizedSponsoredBundle?.deployGrantToken || '').trim();
        const sponsoredBootstrapWorkerUrl = resolveSponsoredBundleBootstrapWorkerUrl(normalizedSponsoredBundle);
        const submitDeployPayload = async (deployPayload: AnyRecord) => {
          if (
            (forceSponsoredAutoDeploy || sponsoredAutoDeployReady) &&
            sponsoredDeployGrantToken &&
            sponsoredBootstrapWorkerUrl
          ) {
            helperBase = sponsoredBootstrapWorkerUrl;
            const sponsoredDeployRes = await fetch(`${sponsoredBootstrapWorkerUrl}/sponsored/redeem-deploy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deployGrantToken: sponsoredDeployGrantToken,
                deployPayload,
              }),
            });
            const nextDeployStatusCode = sponsoredDeployRes.status;
            const nextData = await sponsoredDeployRes.json().catch(() => ({}));
            if (!sponsoredDeployRes.ok) {
              const err = new Error(
                nextData?.error || `Worker deploy failed (${sponsoredDeployRes.status}).`,
              ) as Error & AnyRecord;
              err.statusCode = sponsoredDeployRes.status;
              err.responseError = nextData?.error || '';
              err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
              err.responseOrphanResources = nextData?.orphanResources || null;
              throw err;
            }
            return {
              deployStatusCode: nextDeployStatusCode,
              data: nextData,
            };
          }

          helperBase = normalizeWorkerUrl(runtime.deployHelperUrl);
          if (!helperBase) throw new Error('Deploy-helper URL is missing.');
          if (!currentDeployForm.apiToken || !currentDeployForm.workerName) {
            throw new Error('Fill in API token and worker name.');
          }
          const res = await fetch(`${helperBase}/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...deployPayload,
              apiToken: currentDeployForm.apiToken,
              accountId: toStr(currentDeployForm.accountId || '').trim() || undefined,
            }),
          });
          const nextDeployStatusCode = res.status;
          const nextData = await res.json().catch(() => ({}));
          if (!res.ok) {
            const err = new Error(nextData?.error || `Worker deploy failed (${res.status}).`) as Error & AnyRecord;
            err.statusCode = res.status;
            err.responseError = nextData?.error || '';
            err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
            err.responseOrphanResources = nextData?.orphanResources || null;
            throw err;
          }
          return {
            deployStatusCode: nextDeployStatusCode,
            data: nextData,
          };
        };
        let deployStatusCode = 0;
        let data: AnyRecord = {};
        ({ deployStatusCode, data } = await submitDeployPayload(payload));
        const {
          resolvedDeployWorkerUrl,
          displayWorkerUrl,
          deployComplete: isDeployVerified,
        } = resolveDeployWorkerState({
          responseWorkerUrl: data?.workerUrl,
          configuredWorkerUrl: configuredWorkerUrlBeforeDeploy,
        });
        if (data?.workerUrl && resolvedDeployWorkerUrl) {
          updateDraftValue(['corsWorkerUrl'], resolvedDeployWorkerUrl);
          updateDeploymentState({
            workerMode: 'custom',
            workerUrlAutoFilled: true,
          });
        }
        let workerConfigPayload: AnyRecord = {
          ...buildSessionWizardWorkerConfigPayload({
            slug,
            draft: currentDraft,
            deployPayload: payload,
            workerSecrets: currentWorkerSecrets,
            account: toStr(resolvedAdmin || currentDeployForm.adminAddress || runtime.account).trim(),
            registryAddress: runtime.registryAddress,
            registryChainId: runtime.registryChainId,
            networkChainId: runtime.network?.id,
            sessionId: toStr(runtime.sessionId || '').trim(),
            latestChainBlock: runtime.latestChainBlock,
            workerUrl: resolvedDeployWorkerUrl,
            resolveWorkerFaucetConfig,
          }),
          corsWorkerUrl: resolvedDeployWorkerUrl,
        };
        const ensureWorkerSessionConfig = async ({ workerUrl, slug: targetSlug }: AnyRecord) => {
          const requestBody = {
            sessionSlug: targetSlug,
            adminAddress: workerConfigPayload.adminAddress || runtime.account || '',
            config: workerConfigPayload,
          };
          const auth = await signTypedAdminAction({
            action: 'set-config',
            body: requestBody,
            targetSlug,
            workerUrl,
            accountOverride: resolvedAdmin,
          });
          const configRes = await fetch(`${workerUrl}/admin/set-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...requestBody,
              adminAddress: requestBody.adminAddress || auth.address,
              ...auth,
            }),
          });
          const configData = await configRes.json().catch(() => ({}));
          if (!configRes.ok) {
            throw new Error(configData?.error || 'Failed to sync worker config after deploy.');
          }
        };
        let configSyncStatus: WorkerSecretSyncResult = { warning: '', note: '', synced: false, skipped: true };
        if (resolvedDeployWorkerUrl) {
          configSyncStatus = await syncWorkerConfigAfterPartialDeploy({
            deployResponse: data,
            workerUrl: resolvedDeployWorkerUrl,
            account: resolvedAdmin,
            slug,
            ensureSessionConfig: ensureWorkerSessionConfig,
          });
        } else {
          configSyncStatus = {
            warning: 'Worker URL unavailable - skipped config sync.',
            note: '',
            synced: false,
            skipped: true,
          };
        }
        let litBootstrapStatus: WorkerSecretSyncResult = { warning: '', note: '', synced: false, skipped: true };
        if (resolvedDeployWorkerUrl) {
          litBootstrapStatus = await syncWorkerLitSessionBootstrapAfterDeploy({
            workerUrl: resolvedDeployWorkerUrl,
            account: resolvedAdmin,
            slug,
            bootstrapRequest: buildSessionWizardLitBootstrapRequest(currentWorkerSecrets, {
              sessionName: currentDraft?.sessionName,
            }),
            signAdminAction: ({ action = 'lit-chipotle-bootstrap-session', targetSlug, workerUrl, body }) =>
              signTypedAdminAction({
                action,
                body,
                targetSlug,
                workerUrl,
                accountOverride: resolvedAdmin,
              }),
            postBootstrap: async ({ auth, requestBody, workerUrl, slug: targetSlug }) => {
              const requestBodyWithSlug = {
                sessionSlug: targetSlug,
                ...requestBody,
              };
              const bootstrapRes = await fetch(`${workerUrl}/admin/lit-chipotle-bootstrap-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...requestBodyWithSlug, ...auth }),
              });
              const bootstrapData = await bootstrapRes.json().catch(() => ({}));
              if (!bootstrapRes.ok) {
                throw new Error(bootstrapData?.error || 'Failed to auto-bootstrap the Lit session account.');
              }
              return bootstrapData;
            },
            ensureSessionConfig: ensureWorkerSessionConfig,
            applyBootstrappedConfig: async ({ apiBase, litActionCid, litGroupId, litPkpId, result }) => {
              const nextApiBase = toStr(apiBase || result?.apiBase || result?.litCredentials?.litApiBase).trim();
              const nextActionCid = toStr(litActionCid).trim();
              const nextGroupId = toStr(litGroupId).trim();
              const nextPkpId = toStr(litPkpId).trim();
              if (!(nextActionCid && nextGroupId && nextPkpId)) return;
              workerConfigPayload = {
                ...workerConfigPayload,
                litCredentials: {
                  ...(workerConfigPayload?.litCredentials && typeof workerConfigPayload.litCredentials === 'object'
                    ? workerConfigPayload.litCredentials
                    : {}),
                  ...(nextApiBase ? { litApiBase: nextApiBase } : {}),
                  litGroupId: nextGroupId,
                  litPkpId: nextPkpId,
                  litActionCid: nextActionCid,
                },
              };
              currentWorkerSecrets = {
                ...currentWorkerSecrets,
                litAccountApiKey: '',
                litUsageApiKey: '',
                ...(nextApiBase ? { litApiBase: nextApiBase } : {}),
                litGroupId: nextGroupId,
                litPkpId: nextPkpId,
                litActionCid: nextActionCid,
              };
              applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({
                ...prev,
                litAccountApiKey: '',
                litUsageApiKey: '',
                ...(nextApiBase ? { litApiBase: nextApiBase } : {}),
                litGroupId: nextGroupId,
                litPkpId: nextPkpId,
                litActionCid: nextActionCid,
              }));
            },
          });
        }
        let litProvisionStatus: WorkerSecretSyncResult = { warning: '', note: '', synced: false, skipped: true };
        if (resolvedDeployWorkerUrl) {
          litProvisionStatus = await syncWorkerLitActionProvisionAfterDeploy({
            workerUrl: resolvedDeployWorkerUrl,
            account: resolvedAdmin,
            slug,
            provisionRequest: buildSessionWizardLitProvisionRequest(currentWorkerSecrets),
            signAdminAction: ({ action = 'lit-chipotle-provision', targetSlug, workerUrl, body }) =>
              signTypedAdminAction({
                action,
                body,
                targetSlug,
                workerUrl,
                accountOverride: resolvedAdmin,
              }),
            postProvision: async ({ auth, requestBody, workerUrl, slug: targetSlug }) => {
              const requestBodyWithSlug = {
                sessionSlug: targetSlug,
                ...requestBody,
              };
              const provisionRes = await fetch(`${workerUrl}/admin/lit-chipotle-provision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...requestBodyWithSlug, ...auth }),
              });
              const provisionData = await provisionRes.json().catch(() => ({}));
              if (!provisionRes.ok) {
                throw new Error(provisionData?.error || 'Failed to auto-provision the Lit action.');
              }
              return provisionData;
            },
            ensureSessionConfig: ensureWorkerSessionConfig,
            applyProvisionedConfig: async ({ litActionCid, litGroupId }) => {
              const nextActionCid = toStr(litActionCid).trim();
              if (!nextActionCid) return;
              const nextGroupId = toStr(litGroupId).trim();
              workerConfigPayload = {
                ...workerConfigPayload,
                litCredentials: {
                  ...(workerConfigPayload?.litCredentials && typeof workerConfigPayload.litCredentials === 'object'
                    ? workerConfigPayload.litCredentials
                    : {}),
                  ...(nextGroupId ? { litGroupId: nextGroupId } : {}),
                  litActionCid: nextActionCid,
                },
              };
              currentWorkerSecrets = {
                ...currentWorkerSecrets,
                litActionCid: nextActionCid,
              };
              applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({
                ...prev,
                litActionCid: nextActionCid,
              }));
              await ensureWorkerSessionConfig({
                workerUrl: resolvedDeployWorkerUrl,
                slug,
                account: resolvedAdmin,
              });
            },
          });
        }
        let secretsSyncStatus: AnyRecord = { warning: '', note: '' };
        let helperWritesSecrets = false;
        if (resolvedDeployWorkerUrl && runtime.workerSecretsEnabled && Object.keys(deploySecrets).length) {
          helperWritesSecrets =
            data?.writesSessionSecrets === true || toStr(data?.sessionSecretsKey).startsWith('session:');
          secretsSyncStatus = await syncWorkerSecretsAfterDeploy({
            workerUrl: resolvedDeployWorkerUrl,
            account: resolvedAdmin,
            slug,
            deploySecrets,
            // Older deploy-helper revisions may not write session-prefixed keys.
            // If unknown, force a real sync attempt instead of assuming helper success.
            helperWritesSecrets,
            signAdminAction: ({
              targetSlug,
              workerUrl,
              body,
            }: {
              targetSlug: string;
              workerUrl: string;
              body: AnyRecord;
            }) =>
              signTypedAdminAction({
                action: 'set-secrets',
                body,
                targetSlug,
                workerUrl,
                accountOverride: resolvedAdmin,
              }),
            ensureSessionConfig: ensureWorkerSessionConfig,
            postSecrets: async ({
              auth,
              secrets,
              workerUrl,
              slug,
            }: {
              auth: AnyRecord;
              secrets: AnyRecord;
              workerUrl: string;
              slug: string;
            }) => {
              const requestBody = {
                sessionSlug: slug,
                secrets,
              };
              const secretsRes = await fetch(`${workerUrl}/admin/set-secrets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...requestBody, ...auth }),
              });
              const secretsData = await secretsRes.json().catch(() => ({}));
              if (!secretsRes.ok) {
                throw new Error(secretsData?.error || 'Failed to sync worker secrets after deploy.');
              }
            },
          });
        }
        cacheSessionWorkerConfigAfterDeploy({
          deployStatusCode,
          configSyncStatus,
          workerUrl: resolvedDeployWorkerUrl,
          slug,
          sessionIdHex: toStr(runtime.sessionIdHex || '').trim(),
          registryChainId: runtime.registryChainId,
          config: workerConfigPayload,
        });
        if (
          resolvedDeployWorkerUrl &&
          runtime.workerSecretsEnabled &&
          Object.keys(deploySecrets).length &&
          (helperWritesSecrets || secretsSyncStatus?.synced === true || secretsSyncStatus?.deferred === true)
        ) {
          updateDeploymentState({
            provisionedSponsoredContext: {
              sessionSlug: slug,
              workerUrl: resolvedDeployWorkerUrl,
              fields: buildSponsoredSessionFlagFields({
                secrets: sanitizeSessionWizardWorkerSecretsForLitMode(deploySecrets),
                workerSecretsEnabled: true,
              }),
            },
          });
        }
        const baseDeployStatus = withSessionWizardDeployHelperWorkersDevStatus(
          data?.workerUrl ? 'Worker deployed.' : 'Worker deployed (URL unavailable).',
          data,
        );
        const litDeployStatus = withLitProvisionSyncStatus(
          withLitBootstrapSyncStatus(baseDeployStatus, litBootstrapStatus),
          litProvisionStatus,
        );
        updateDeploymentState({
          deployWorkerUrl: displayWorkerUrl,
          deployStatus: withWorkerConfigSyncWarning(
            withSecretsSyncStatus(litDeployStatus, secretsSyncStatus),
            configSyncStatus.warning,
          ),
          deployComplete: isDeployVerified,
          forceManualBundleFile: false,
          normalModeBundleUrlOverride: '',
        });
        // Manual bundle uploads are one-off retries; clear the cached file so
        // later URL-mode deploys and sponsored publish flows don't reuse stale bytes.
        clearSelectedBundleFile();
        clearCachedWorkerSecretsAfterDeploy();
        return {
          ok: true,
          workerUrl: resolvedDeployWorkerUrl,
          deployComplete: isDeployVerified,
        };
      } catch (err) {
        const runtime = readRuntime(runtimeRef);
        if (
          shouldForceSessionWizardNormalModeManualBundleRetry({
            err,
            wizardMode: runtime.wizardMode,
            effectiveBundleMode,
            hasBundleFile: !!runtime.bundleFile,
          })
        ) {
          updateDeploymentState({ forceManualBundleFile: true });
        }
        const errorMessage = normalizeSessionWizardDeployErrorMessage({ err, helperBase });
        updateDeploymentState({ deployStatus: errorMessage });
        return {
          ok: false,
          error: errorMessage,
        };
      } finally {
        deployRequestInFlightRef.current = false;
        updateDeploymentState({ deployInFlight: false });
      }
    },
    [
      clearCachedWorkerSecretsAfterDeploy,
      clearSelectedBundleFile,
      applyWorkerSecretsUpdate,
      getCurrentWorkerSecrets,
      getMissingWorkerSecretsForDeploy,
      parseAllowOriginsInput,
      resolveConnectedAdminAddress,
      resolveWorkerFaucetConfig,
      resolveWorkerRpcUrl,
      resolveWorkerRpcUrlMap,
      runtimeRef,
      signTypedAdminAction,
      sponsoredBundleAppliedBundleRef,
      updateDeploymentState,
      updateDraftValue,
    ],
  );

  return {
    handleDeployWorker,
    resolveConnectedAdminAddress,
  };
};

export default useSessionWizardWorkerDeploy;
