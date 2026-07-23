import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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
import { buildSessionWizardWorkerConfigPayload } from '../sessionWizardWriteNormalization.js';
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
import { publishVerifiedRuntime, resolveDeployWorkerState } from '../sessionWizardWorkerState';
import { getSessionSlugValidationError } from '../sessionWizardSlugValidation';
import {
  cacheSessionWorkerConfigAfterDeploy,
  resolveSponsoredBundleBootstrapWorkerUrl,
} from '../sessionWizardSponsoredBundleSupport';
import {
  resolveSessionWizardWorkerRuntimeReadiness,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from '../sessionWizardWorkerSecretSupport';
import {
  buildSessionWizardWorkerRequirementProof,
  resolveSessionWizardWorkerSecretSelection,
  type SessionWizardWorkerRequirementProof,
} from '../sessionWizardWorkerRequirementProof';
import {
  buildSessionWizardLitBootstrapRecovery,
  createSessionWizardEnsureWorkerSessionConfig,
  matchesSessionWizardLitBootstrapRecovery,
  mergeRecoveredSessionWizardLitRuntime,
  resolveCompleteSessionWizardLitRuntime,
  syncSessionWizardLitRuntimeConfigAfterDeploy,
  type SessionWizardLitBootstrapRecovery,
} from '../sessionWizardWorkerDeployLitRuntime';
import { getSessionWizardWorkerDeployValidationError } from '../sessionWizardWorkerRpc';
import { resolveSessionWizardModeRequirements } from '../sessionWizardModeRequirements';
import {
  requireSessionWizardAgentSessionWrappedCapability,
  resolveSessionWizardAgentSessionWrappedDeployment,
} from '../sessionWizardAgentSessionWrappedDeploy';
import { buildSessionWizardDeployStorageProfilePayload } from '../sessionWizardWorkerDeployStorage';
import {
  advanceSessionWizardDeployAttemptGeneration,
  isStructuredSessionWizardDeployAttemptConflict,
  markSessionWizardDeployAttemptCompleted,
  resolveSessionWizardDeployAttemptIdentity,
  shouldRetainSessionWizardDeployAttemptIdentity,
} from '../sessionWizardDeployAttemptIdentity';
import {
  normalizeSessionWizardSlug as normalizeSlug,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
} from '../sessionWizardUrlSupport';
import { verifyNativeSessionWorker } from '../sessionWizardNativeWorkerVerification';
import type { AnyRecord, ChainIdLike, NetworkLike, WorkerSecretSyncResult, WorkerSecretsLike } from '../../shellTypes';
type DeployFormLike = AnyRecord & {
  apiToken?: string;
  workerName?: string;
  adminAddress?: string;
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
  workerCanonicalPublishCompleted?: boolean;
  deployComplete?: boolean;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
  draft?: DraftLike | null;
  deployForm?: DeployFormLike | null;
};

export type SessionWizardWorkerDeployStateUpdate = {
  deployForm?: DeployFormLike;
  deployStatus?: string;
  deployInFlight?: boolean;
  deployComplete?: boolean;
  workerUrlAutoFilled?: boolean;
  workerMode?: string;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
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
  const litBootstrapRecoveryRef = useRef<SessionWizardLitBootstrapRecovery | null>(null);

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
      const runtimeAtStart = readRuntime(runtimeRef);
      if (runtimeAtStart.workerCanonicalPublishCompleted === true) {
        // Regression guard: publication rotates the form session ID. Checking the
        // live identity here would let that new ID provision an unpublishable orphan.
        const terminalMessage =
          'This worker-canonical session is already published. Choose Create another session before deploying a new worker.';
        updateDeploymentState({ deployStatus: terminalMessage });
        return { ok: false, skipped: true, error: terminalMessage };
      }
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
        if (currentDraft.sessionModeProfile != null && !modeRequirements.selected) {
          throw new Error('Session mode configuration is invalid. Review the selected mode before deployment.');
        }
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
        const { bundleText, bundleUrl, bundleManifestUrl, bundleSha256 } =
          await resolveSessionWizardDeployBundlePayload({
            effectiveBundleMode,
            bundleFile: runtime.bundleFile,
            bundleUrl: requestedBundleUrl,
          });
        const allDeploySecrets = runtime.workerSecretsEnabled ? buildWorkerSecretsPayload(currentWorkerSecrets) : {};
        const { selectedSecrets: deploySecrets, requiredSecretFields: requiredWorkerSecretFields } =
          resolveSessionWizardWorkerSecretSelection({
            sessionModeProfile: currentDraft.sessionModeProfile,
            sessionAi: currentDraft.ai,
            workerSecrets: allDeploySecrets,
          });
        const deployBlockLimits = normalizeBlockLimitsForConfig(currentDraft?.blockLimits, runtime.latestChainBlock);
        const deployStorageProfile = buildSessionWizardDeployStorageProfilePayload(currentDraft, {});
        const normalizedSponsoredBundle = normalizeSparseSponsoredBundlePayload(
          sponsoredBundleAppliedBundleRef?.current,
        );
        const sponsoredDeployGrantToken = toStr(normalizedSponsoredBundle?.deployGrantToken || '').trim();
        const sponsoredBootstrapWorkerUrl = resolveSponsoredBundleBootstrapWorkerUrl(normalizedSponsoredBundle);
        const usesSponsoredDeploy =
          (forceSponsoredAutoDeploy || sponsoredAutoDeployReady) &&
          !!sponsoredDeployGrantToken &&
          !!sponsoredBootstrapWorkerUrl;
        // Persist only a digest-keyed generation counter. The scope deliberately
        // excludes tokens, secrets, and mutable config so an ambiguous response
        // cannot become a second deployment merely because the draft was edited.
        const deployAttemptIdentity = resolveSessionWizardDeployAttemptIdentity({
          scope: {
            slug,
            sessionId: toStr(runtime.sessionIdHex || runtime.sessionId)
              .trim()
              .toLowerCase(),
            workerName: toStr(currentDeployForm.workerName).trim().toLowerCase(),
            adminAddress: resolvedAdmin.toLowerCase(),
            deployTarget: usesSponsoredDeploy
              ? sponsoredBootstrapWorkerUrl
              : normalizeWorkerUrl(runtime.deployHelperUrl),
          },
        });
        const payload: AnyRecord = {
          deploymentRequestId: deployAttemptIdentity.deploymentRequestId,
          workerName: currentDeployForm.workerName,
          sessionSlug: slug,
          bundleUrl,
          bundleText: bundleText || undefined,
          bundleManifestUrl,
          bundleSha256,
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
        const agentSessionWrappedDeployment = resolveSessionWizardAgentSessionWrappedDeployment({
          draft: currentDraft,
          registryChainId: runtime.registryChainId,
          networkChainId: currentDraft.networkChainId,
          sessionId: runtime.sessionId,
          sessionIdHex: runtime.sessionIdHex,
          slug,
        });
        Object.assign(payload, agentSessionWrappedDeployment.payload);
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
        payload.configRevision = deployAttemptIdentity.configRevision;
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
          // Worker-canonical RPC values stay in the dedicated session-secrets
          // record. Keeping them out of canonical config also keeps bootstrap
          // reads non-secret while Chipotle resolves customRpcUrl from secrets.
          delete payload.rpcUrl;
          delete payload.rpcUrlsByChainId;
        }
        if (Object.keys(deploySecrets).length) {
          payload.secrets = deploySecrets;
        }
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
              if (!shouldRetainSessionWizardDeployAttemptIdentity(sponsoredDeployRes.status, nextData)) {
                // Only the coordinator's structured terminal conflict may reopen
                // a locally completed scope; generic failures can be stale peer callbacks.
                advanceSessionWizardDeployAttemptGeneration(deployAttemptIdentity, {
                  allowCompletedTerminalConflict: isStructuredSessionWizardDeployAttemptConflict(nextData),
                });
              }
              const err = new Error(
                nextData?.error || `Worker deploy failed (${sponsoredDeployRes.status}).`,
              ) as Error & AnyRecord;
              err.statusCode = sponsoredDeployRes.status;
              err.responseError = nextData?.error || '';
              err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
              err.responseOrphanResources = nextData?.orphanResources || null;
              err.responseDeploymentRequestConflict = nextData?.deploymentRequestConflict === true;
              err.responseDeploymentRequestTerminal = nextData?.deploymentRequestTerminal === true;
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
            }),
          });
          const nextDeployStatusCode = res.status;
          const nextData = await res.json().catch(() => ({}));
          if (!res.ok) {
            if (!shouldRetainSessionWizardDeployAttemptIdentity(res.status, nextData)) {
              // Keep direct and sponsored retries on the same narrow authority:
              // both structured flags are required to supersede completed state.
              advanceSessionWizardDeployAttemptGeneration(deployAttemptIdentity, {
                allowCompletedTerminalConflict: isStructuredSessionWizardDeployAttemptConflict(nextData),
              });
            }
            const err = new Error(nextData?.error || `Worker deploy failed (${res.status}).`) as Error & AnyRecord;
            err.statusCode = res.status;
            err.responseError = nextData?.error || '';
            err.responseBundleDiagnostics = nextData?.bundleDiagnostics || null;
            err.responseOrphanResources = nextData?.orphanResources || null;
            err.responseDeploymentRequestConflict = nextData?.deploymentRequestConflict === true;
            err.responseDeploymentRequestTerminal = nextData?.deploymentRequestTerminal === true;
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
        const agentSessionWrapped = requireSessionWizardAgentSessionWrappedCapability({
          requested: agentSessionWrappedDeployment.requested,
          value: data?.agentSessionWrapped,
        });
        if (agentSessionWrapped) {
          updateDraftValue(['agentSessionWrapped'], agentSessionWrapped);
        }
        // The helper's successful response makes this scope terminal. Persist that
        // fact before any later config/secret synchronization can yield or fail.
        if (!markSessionWizardDeployAttemptCompleted(deployAttemptIdentity)) {
          throw new Error('Could not durably record the completed worker deployment.');
        }
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
          ...(agentSessionWrapped ? { agentSessionWrapped } : {}),
        };
        const ensureWorkerSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
          getWorkerConfig: () => workerConfigPayload,
          getAdminAddress: () => toStr(runtime.account).trim(),
          signTypedAdminAction: (input) => signTypedAdminAction({ ...input, accountOverride: resolvedAdmin }),
        });
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
        const litRuntimeConfigSyncStatus = await syncSessionWizardLitRuntimeConfigAfterDeploy({
          requiresLit: modeRequirements.requiresLit,
          workerUrl: resolvedDeployWorkerUrl,
          slug,
          litCredentials: workerConfigPayload?.litCredentials,
          ensureSessionConfig: ensureWorkerSessionConfig,
        });
        // Regression guard: hidden stale Lit credentials must not provision
        // resources for a selected non-Lit mode; profile-less legacy flows remain supported.
        const shouldSyncLitAfterDeploy = !modeRequirements.selected || modeRequirements.requiresLit;
        let litBootstrapStatus: WorkerSecretSyncResult = { warning: '', note: '', synced: false, skipped: true };
        if (resolvedDeployWorkerUrl && shouldSyncLitAfterDeploy) {
          const recoveredBootstrap = matchesSessionWizardLitBootstrapRecovery({
            recovery: litBootstrapRecoveryRef.current,
            workerUrl: resolvedDeployWorkerUrl,
            slug,
            litCredentials: currentWorkerSecrets,
          });
          litBootstrapStatus = recoveredBootstrap
            ? { warning: '', note: 'Lit bootstrap recovery verified.', synced: true, skipped: true }
            : await syncWorkerLitSessionBootstrapAfterDeploy({
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
                  const recoveredLitCredentials = resolveCompleteSessionWizardLitRuntime({
                    ...(workerConfigPayload?.litCredentials || {}),
                    litApiBase: apiBase || result?.apiBase || result?.litCredentials?.litApiBase,
                    litActionCid,
                    litGroupId,
                    litPkpId,
                  });
                  if (!recoveredLitCredentials) return;
                  workerConfigPayload = {
                    ...workerConfigPayload,
                    litCredentials: recoveredLitCredentials,
                  };
                  currentWorkerSecrets = mergeRecoveredSessionWizardLitRuntime(
                    currentWorkerSecrets,
                    recoveredLitCredentials,
                  );
                  litBootstrapRecoveryRef.current = buildSessionWizardLitBootstrapRecovery({
                    workerUrl: resolvedDeployWorkerUrl,
                    slug,
                    litCredentials: recoveredLitCredentials,
                  });
                  applyWorkerSecretsUpdate((prev: WorkerSecretsLike) =>
                    mergeRecoveredSessionWizardLitRuntime(prev, recoveredLitCredentials),
                  );
                },
              });
        }
        let litProvisionStatus: WorkerSecretSyncResult = { warning: '', note: '', synced: false, skipped: true };
        if (resolvedDeployWorkerUrl && shouldSyncLitAfterDeploy) {
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
            typeof data?.writesSessionSecrets === 'boolean'
              ? data.writesSessionSecrets
              : toStr(data?.sessionSecretsKey).startsWith('session:');
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
        const { requiredLitRuntimeReady, requiredWorkerSecretsReady } = resolveSessionWizardWorkerRuntimeReadiness({
          requiredWorkerSecretFields,
          deploySecrets,
          helperWritesSecrets,
          secretsSyncStatus,
          requiresLit: modeRequirements.requiresLit,
          litCredentials: workerConfigPayload?.litCredentials,
          litRuntimeConfigSynced: litRuntimeConfigSyncStatus?.synced === true,
          litBootstrapSynced: litBootstrapStatus?.synced === true,
          litProvisionSynced: litProvisionStatus?.synced === true,
        });
        // Regression guard: manual and forced deploys must keep the publish step
        // open until selected-profile secrets are remote; the same terminal request
        // ID then resumes signed sync without provisioning a second worker.
        const remoteWorkerReady = isDeployVerified && requiredWorkerSecretsReady;
        const workerRequirementProof =
          remoteWorkerReady && modeRequirements.isWorkerCanonical
            ? buildSessionWizardWorkerRequirementProof({
                workerUrl: resolvedDeployWorkerUrl,
                sessionSlug: slug,
                sessionId: runtime.sessionId || runtime.sessionIdHex,
                sessionModeProfile: currentDraft.sessionModeProfile,
                sessionAi: currentDraft.ai,
                workerSecrets: deploySecrets,
                requiredSecretFields: requiredWorkerSecretFields,
                remoteManagedSecretFields: litBootstrapStatus?.synced === true ? ['litAccountApiKey'] : [],
                litRuntimeConfig: workerConfigPayload?.litCredentials,
              })
            : null;
        // A worker-canonical deploy is publish-safe only when the exact remote
        // secret/requirement evidence can be compared against later edits.
        const publishSafeDeployComplete =
          remoteWorkerReady && (!modeRequirements.isWorkerCanonical || !!workerRequirementProof);
        if (publishSafeDeployComplete && litBootstrapStatus?.synced === true) {
          // Keep bootstrap authority through every post-deploy write. Clearing it
          // earlier makes a failed AI/RPC secret sync impossible to resume safely.
          const verifiedLitCredentials =
            workerConfigPayload?.litCredentials && typeof workerConfigPayload.litCredentials === 'object'
              ? workerConfigPayload.litCredentials
              : {};
          applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({
            ...prev,
            ...verifiedLitCredentials,
            litAccountApiKey: '',
            litUsageApiKey: '',
          }));
        }
        cacheSessionWorkerConfigAfterDeploy({
          deployStatusCode,
          deployPartial: data?.partial === true,
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
        publishVerifiedRuntime(
          runtimeRef,
          currentDraft,
          resolvedDeployWorkerUrl,
          displayWorkerUrl,
          publishSafeDeployComplete,
          workerRequirementProof,
        );
        updateDeploymentState({
          deployWorkerUrl: displayWorkerUrl,
          deployStatus: withWorkerConfigSyncWarning(
            withSecretsSyncStatus(litDeployStatus, secretsSyncStatus),
            litRuntimeConfigSyncStatus.warning || configSyncStatus.warning,
          ),
          deployComplete: publishSafeDeployComplete,
          workerRequirementProof,
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
          deployComplete: publishSafeDeployComplete,
          requiredLitRuntimeReady,
          requiredWorkerSecretsReady,
          requiredWorkerSecretFields,
          workerRequirementProof,
          agentSessionWrapped,
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

  const verifyNativeWorker = useCallback(
    ({ sessionSlug, workerQueryValue }: { sessionSlug: string; workerQueryValue: unknown }) =>
      verifyNativeSessionWorker({
        runtimeRef,
        sessionSlug,
        workerQueryValue,
        getCurrentWorkerSecrets,
        getMissingWorkerSecretsForDeploy,
        parseAllowOriginsInput,
        resolveConnectedAdminAddress,
        resolveWorkerFaucetConfig,
        signTypedAdminAction,
        updateDeploymentState,
        updateDraftValue,
      }),
    [
      getCurrentWorkerSecrets,
      getMissingWorkerSecretsForDeploy,
      parseAllowOriginsInput,
      resolveConnectedAdminAddress,
      resolveWorkerFaucetConfig,
      runtimeRef,
      signTypedAdminAction,
      updateDeploymentState,
      updateDraftValue,
    ],
  );

  return {
    handleDeployWorker,
    resolveConnectedAdminAddress,
    verifyNativeWorker,
  };
};

export default useSessionWizardWorkerDeploy;
