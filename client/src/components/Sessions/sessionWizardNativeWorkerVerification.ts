import type { MutableRefObject } from 'react';
import {
  fetchWorkerCanonicalSessionBootstrap,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
import { buildWorkerSecretsPayload, syncWorkerSecretsAfterDeploy } from './sessionWizardSecrets.js';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import {
  buildSessionWizardWorkerRequirementProof,
  resolveSessionWizardWorkerSecretSelection,
} from './sessionWizardWorkerRequirementProof';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization.js';
import { persistAndVerifySessionWizardWorkerConfig } from './sessionWizardWorkerConfigPersistence';
import { publishVerifiedRuntime } from './sessionWizardWorkerState';
import {
  normalizeSessionWizardSlug as normalizeSlug,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
} from './sessionWizardUrlSupport';
import type {
  SessionWizardWorkerDeployRuntime,
  SessionWizardWorkerDeployStateUpdate,
} from './hooks/useSessionWizardWorkerDeploy';

type NativeWorkerVerificationArgs = {
  runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>;
  sessionSlug: string;
  workerQueryValue: unknown;
  getCurrentWorkerSecrets: () => WorkerSecretsLike;
  getMissingWorkerSecretsForDeploy: (secretsSnapshot?: WorkerSecretsLike) => string[];
  parseAllowOriginsInput: () => string[];
  resolveConnectedAdminAddress: () => Promise<string>;
  resolveWorkerFaucetConfig: () => AnyRecord;
  signTypedAdminAction: (options?: {
    action?: string;
    body?: AnyRecord;
    targetSlug?: string;
    workerUrl?: string;
    accountOverride?: string;
  }) => Promise<AnyRecord>;
  updateDeploymentState: (nextState?: SessionWizardWorkerDeployStateUpdate) => void;
  updateDraftValue: (path: string[], value: unknown) => void;
};

const readRuntime = (
  runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>,
): SessionWizardWorkerDeployRuntime => {
  const current = runtimeRef?.current;
  return current && typeof current === 'object' ? current : {};
};

export const verifyNativeSessionWorker = async ({
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
}: NativeWorkerVerificationArgs): Promise<WorkerCanonicalSessionBootstrap> => {
  const runtime = readRuntime(runtimeRef);
  const currentDraft = runtime.draft && typeof runtime.draft === 'object' ? runtime.draft : {};
  const slug = normalizeSlug(toStr(sessionSlug || currentDraft.slug).trim());
  const workerUrl = normalizeWorkerUrl(workerQueryValue);
  const modeRequirements = resolveSessionWizardModeRequirements(currentDraft.sessionModeProfile);
  if (!slug || slug !== normalizeSlug(currentDraft.slug)) {
    throw new Error('The Worker URL must be verified against the current session slug.');
  }
  if (!workerUrl) throw new Error('Paste a valid HTTPS Session Worker origin before verification.');
  if (currentDraft.sessionModeProfile?.surfaces?.agentHttp === true) {
    throw new Error(
      'Agent Session Wrapped requires the legacy/manual deploy-helper flow; native Cloudflare dashboard verification cannot provision its dedicated Bridge.',
    );
  }
  if (!modeRequirements.isWorkerCanonical) {
    throw new Error('Native Cloudflare verification is available only for worker-canonical sessions.');
  }
  if (modeRequirements.requiresLit) {
    throw new Error(
      'Advanced Lit hybrid setup still requires the legacy/manual bootstrap flow; the native dashboard handoff supports Worker-native encryption and on-chain SBT checks without Lit.',
    );
  }
  if (runtime.loginComplete !== true) {
    if (typeof runtime.toggleLoginModal === 'function') runtime.toggleLoginModal(true);
    throw new Error('Sign in with the session admin passkey before verifying the Worker.');
  }

  const resolvedAdmin = await resolveConnectedAdminAddress();
  if (!resolvedAdmin) throw new Error('Sign in with the session admin passkey before verifying the Worker.');
  const currentWorkerSecrets = getCurrentWorkerSecrets();
  if (runtime.workerSecretsEnabled === false) {
    throw new Error('Enable Worker secrets and enter the required AI provider key before verification.');
  }
  const missing = getMissingWorkerSecretsForDeploy(currentWorkerSecrets);
  if (missing.length) throw new Error(`Missing required secrets before verification: ${missing.join(', ')}`);
  const allSecrets = buildWorkerSecretsPayload(currentWorkerSecrets);
  const { selectedSecrets: deploySecrets, requiredSecretFields } = resolveSessionWizardWorkerSecretSelection({
    sessionModeProfile: currentDraft.sessionModeProfile,
    sessionAi: currentDraft.ai,
    workerSecrets: allSecrets,
  });
  if (!Object.keys(deploySecrets).length) {
    throw new Error('Enter the required AI provider key before verifying the Worker.');
  }

  updateDeploymentState({
    deployStatus: 'Writing and verifying canonical Worker config…',
    deployInFlight: true,
    deployComplete: false,
    workerMode: 'custom',
    workerUrlAutoFilled: false,
  });
  try {
    const workerConfig = buildSessionWizardWorkerConfigPayload({
      slug,
      draft: currentDraft,
      deployPayload: {
        adminAddress: resolvedAdmin,
        allowOrigins: parseAllowOriginsInput(),
        limits: Number(runtime.workerLimitPerWallet || 0)
          ? { perWalletPerDay: Number(runtime.workerLimitPerWallet) }
          : {},
        scopes: {},
        embeddedDeployHelperEnabled: runtime.embeddedDeployHelperEnabled,
      },
      workerSecrets: currentWorkerSecrets,
      account: resolvedAdmin,
      registryAddress: runtime.registryAddress,
      registryChainId: runtime.registryChainId,
      networkChainId: currentDraft.networkChainId,
      sessionId: toStr(runtime.sessionId || runtime.sessionIdHex).trim(),
      latestChainBlock: runtime.latestChainBlock,
      workerUrl,
      resolveWorkerFaucetConfig,
    });
    await persistAndVerifySessionWizardWorkerConfig({
      workerUrl,
      slug,
      sessionId: runtime.sessionId || runtime.sessionIdHex,
      adminAddress: resolvedAdmin,
      config: workerConfig,
      signAdminAction: (input) => signTypedAdminAction({ ...input, accountOverride: resolvedAdmin }),
    });
    const secretsSyncStatus = await syncWorkerSecretsAfterDeploy({
      workerUrl,
      account: resolvedAdmin,
      slug,
      deploySecrets,
      helperWritesSecrets: false,
      signAdminAction: ({ targetSlug, workerUrl: targetWorkerUrl, body }) =>
        signTypedAdminAction({
          action: 'set-secrets',
          body,
          targetSlug,
          workerUrl: targetWorkerUrl,
          accountOverride: resolvedAdmin,
        }),
      postSecrets: async ({ auth, secrets, workerUrl: targetWorkerUrl, slug: targetSlug }) => {
        const response = await fetch(`${targetWorkerUrl}/admin/set-secrets`, {
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...auth,
            sessionSlug: targetSlug,
            secrets,
          }),
        });
        const responseBody = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseBody?.error || `Worker secret sync failed (${response.status}).`);
        }
      },
    });
    if (secretsSyncStatus.synced !== true) {
      throw new Error(secretsSyncStatus.warning || 'Worker secrets could not be verified.');
    }

    const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
      sessionSlug: slug,
      workerQueryValue: workerUrl,
    });
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl: bootstrap.workerOrigin,
      sessionSlug: slug,
      sessionId: bootstrap.sessionId,
      sessionModeProfile: currentDraft.sessionModeProfile,
      sessionAi: currentDraft.ai,
      workerSecrets: currentWorkerSecrets,
      requiredSecretFields,
    });
    if (!proof) throw new Error('Worker requirement verification could not be recorded.');

    updateDraftValue(['corsWorkerUrl'], bootstrap.workerOrigin);
    publishVerifiedRuntime(runtimeRef, currentDraft, bootstrap.workerOrigin, bootstrap.workerOrigin, true, proof);
    updateDeploymentState({
      deployStatus: `Session Worker verified at canonical config revision ${bootstrap.configRevision}.`,
      deployComplete: true,
      deployWorkerUrl: bootstrap.workerOrigin,
      workerRequirementProof: proof,
      workerMode: 'custom',
      workerUrlAutoFilled: false,
    });
    return bootstrap;
  } finally {
    updateDeploymentState({ deployInFlight: false });
  }
};
