import type { MutableRefObject } from 'react';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
import { buildWorkerSecretsPayload, syncWorkerSecretsAfterDeploy } from './sessionWizardSecrets.js';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import {
  buildSessionWizardWorkerRequirementProof,
  resolveSessionWizardWorkerRequirementReadiness,
  resolveSessionWizardWorkerSecretSelection,
} from './sessionWizardWorkerRequirementProof';
import { SESSION_WIZARD_WORKER_CONFIG_VISIBILITY_RETRY_DELAYS_MS } from './sessionWizardWorkerConfigPersistence';
import { parseSessionWizardAllowOriginsInput } from './sessionWizardWorkerRuntimeSupport';
import { verifySessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';
import { buildSessionWizardWorkerVerificationConfig } from './sessionWizardWorkerVerificationConfig';
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
  // True when this tab generated the template setup values for this Worker.
  deployedFromTemplate?: boolean;
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

export type SessionWizardVerifiedWorkerConnection = {
  config: AnyRecord;
  configRevision: string;
  sessionId: string;
  sessionSlug: string;
  workerOrigin: string;
};

const readRuntime = (
  runtimeRef?: MutableRefObject<SessionWizardWorkerDeployRuntime | null>,
): SessionWizardWorkerDeployRuntime => {
  const current = runtimeRef?.current;
  return current && typeof current === 'object' ? current : {};
};

// The Cloudflare template sets DEPLOY_HELPER_ENABLED to "0", so a Worker
// deployed from it cannot run sponsored deploys. Say so in its config;
// otherwise the sponsor page offers deploy grants that this Worker rejects.
// No route reports the binding, so an attached existing Worker keeps the
// draft's value.
const withoutEmbeddedDeployHelper = (runtime: SessionWizardWorkerDeployRuntime): SessionWizardWorkerDeployRuntime => ({
  ...runtime,
  embeddedDeployHelperEnabled: false,
});

export const verifyNativeSessionWorker = async ({
  runtimeRef,
  sessionSlug,
  workerQueryValue,
  deployedFromTemplate = false,
  getCurrentWorkerSecrets,
  getMissingWorkerSecretsForDeploy,
  parseAllowOriginsInput,
  resolveConnectedAdminAddress,
  signTypedAdminAction,
  updateDeploymentState,
  updateDraftValue,
}: NativeWorkerVerificationArgs): Promise<SessionWizardVerifiedWorkerConnection> => {
  const withTemplateHelperFlag = (runtime: SessionWizardWorkerDeployRuntime): SessionWizardWorkerDeployRuntime =>
    deployedFromTemplate ? withoutEmbeddedDeployHelper(runtime) : runtime;
  const runtime = readRuntime(runtimeRef);
  const currentDraft = runtime.draft && typeof runtime.draft === 'object' ? runtime.draft : {};
  const slug = normalizeSlug(toStr(sessionSlug || currentDraft.slug).trim());
  const workerUrl = normalizeWorkerUrl(workerQueryValue);
  const initialDraftWorkerUrl = normalizeWorkerUrl(currentDraft.corsWorkerUrl);
  const modeRequirements = resolveSessionWizardModeRequirements(currentDraft.sessionModeProfile, {
    sessionConfig: currentDraft,
  });
  if (!slug || slug !== normalizeSlug(currentDraft.slug)) {
    throw new Error('The Worker URL must be verified against the current session slug.');
  }
  if (!workerUrl) throw new Error('Paste a valid HTTPS Session Worker origin before verification.');
  if (initialDraftWorkerUrl && initialDraftWorkerUrl !== workerUrl) {
    throw new Error('The Worker URL must match the current draft Worker URL before verification.');
  }
  if (!modeRequirements.selected || !modeRequirements.usesWorkerRuntime) {
    throw new Error('Native Session Worker verification requires a selected Worker-runtime profile.');
  }
  if (modeRequirements.requiresLit) {
    throw new Error(
      'Advanced Lit hybrid setup still requires the legacy/manual bootstrap flow; the native dashboard handoff supports Worker-native encryption and on-chain SBT checks without Lit.',
    );
  }
  if (runtime.loginComplete !== true) {
    if (typeof runtime.toggleLoginModal === 'function') runtime.toggleLoginModal(true);
    throw new Error('Connect or sign in as the session admin before verifying the Worker.');
  }

  const resolvedAdmin = await resolveConnectedAdminAddress();
  if (!resolvedAdmin) throw new Error('Connect or sign in as the session admin before verifying the Worker.');
  if (runtimeRef?.current) {
    runtimeRef.current = {
      ...runtimeRef.current,
      resolvedAdminAddress: resolvedAdmin,
    };
  }
  const currentWorkerSecrets = getCurrentWorkerSecrets();
  if (runtime.workerSecretsEnabled === false) {
    throw new Error('Enable Worker secrets and enter the required AI provider key before verification.');
  }
  const missing = getMissingWorkerSecretsForDeploy(currentWorkerSecrets);
  if (missing.length) throw new Error(`Missing required secrets before verification: ${missing.join(', ')}`);
  const allSecrets = buildWorkerSecretsPayload(currentWorkerSecrets);
  const { selectedSecrets: deploySecrets, requiredSecretFields } = resolveSessionWizardWorkerSecretSelection({
    sessionConfig: currentDraft,
    sessionModeProfile: currentDraft.sessionModeProfile,
    sessionAi: currentDraft.ai,
    workerSecrets: allSecrets,
  });
  if (!Object.keys(deploySecrets).length) {
    throw new Error('Enter the required AI provider key before verifying the Worker.');
  }

  updateDeploymentState({
    deployStatus: 'Writing and verifying Session Worker config…',
    deployInFlight: true,
    deployComplete: false,
    workerMode: 'custom',
    workerUrlAutoFilled: false,
  });
  try {
    const allowOrigins =
      runtime.workerAllowOrigins == null
        ? parseAllowOriginsInput()
        : parseSessionWizardAllowOriginsInput(runtime.workerAllowOrigins);
    const workerConfig = buildSessionWizardWorkerVerificationConfig({
      runtime: withTemplateHelperFlag(runtime),
      draft: currentDraft,
      adminAddress: resolvedAdmin,
      workerUrl,
      allowOrigins,
      workerSecrets: currentWorkerSecrets,
    });
    const verifiedConfig = await verifySessionWizardWorkerPublicDeployment({
      workerUrl,
      slug,
      sessionId: runtime.sessionId || runtime.sessionIdHex,
      adminAddress: resolvedAdmin,
      config: workerConfig,
      isWorkerCanonical: modeRequirements.isWorkerCanonical,
      signAdminAction: (input) => signTypedAdminAction({ ...input, accountOverride: resolvedAdmin }),
    });
    const secretsSyncStatus = await syncWorkerSecretsAfterDeploy({
      workerUrl,
      account: resolvedAdmin,
      slug,
      sessionId: modeRequirements.isWorkerCanonical
        ? normalizeWorkerCanonicalSessionIdHex(runtime.sessionId || runtime.sessionIdHex)
        : '',
      deploySecrets,
      helperWritesSecrets: false,
      retryDelaysMs: SESSION_WIZARD_WORKER_CONFIG_VISIBILITY_RETRY_DELAYS_MS,
      signAdminAction: ({ targetSlug, workerUrl: targetWorkerUrl, body }) =>
        signTypedAdminAction({
          action: 'set-secrets',
          body,
          targetSlug,
          workerUrl: targetWorkerUrl,
          accountOverride: resolvedAdmin,
        }),
      postSecrets: async ({ auth, body, workerUrl: targetWorkerUrl }) => {
        const response = await fetch(`${targetWorkerUrl}/admin/set-secrets`, {
          method: 'POST',
          credentials: 'omit',
          redirect: 'error',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, ...body }),
        });
        const responseBody = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseBody?.error || `Worker secret sync failed (${response.status}).`);
        }
        if (responseBody?.ok !== true) {
          throw new Error('Worker secret write did not confirm acceptance.');
        }
      },
    });
    if (secretsSyncStatus.synced !== true) {
      throw new Error(secretsSyncStatus.warning || 'Worker secrets could not be verified.');
    }

    if (currentDraft.sessionModeProfile?.surfaces?.agentHttp === true) {
      const response = await fetch(`${workerUrl}/capabilities?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const capabilities = await response.json().catch(() => ({}));
      if (
        !response.ok ||
        !capabilities.features?.includes('agent_http_v1') ||
        capabilities.agentHttp?.ready !== true ||
        capabilities.agentSessionWrapped?.origin !== new URL(workerUrl).origin
      ) {
        throw new Error(
          'Agent HTTP is not ready. Configure a fresh AGENT_MANAGED_ROOT_SECRET in the Session Worker dashboard, then verify again.',
        );
      }
      // Registry verification may return the input config itself. Keep the
      // capability projection out of the signed-config fingerprint used below.
      verifiedConfig.publicConfig = {
        ...verifiedConfig.publicConfig,
        agentSessionWrapped: capabilities.agentSessionWrapped,
      };
    }

    // Verify has already checked the public readback and identity. Publication
    // creates the revision later; the participant bootstrap requires that revision.
    const bootstrap: SessionWizardVerifiedWorkerConnection = {
      config: verifiedConfig.publicConfig,
      configRevision: verifiedConfig.configRevision,
      sessionId: normalizeWorkerCanonicalSessionIdHex(runtime.sessionId || runtime.sessionIdHex),
      sessionSlug: slug,
      workerOrigin: verifiedConfig.workerOrigin,
    };
    const proof = buildSessionWizardWorkerRequirementProof({
      workerUrl: bootstrap.workerOrigin,
      sessionSlug: slug,
      sessionId: bootstrap.sessionId,
      sessionConfig: currentDraft,
      sessionModeProfile: currentDraft.sessionModeProfile,
      sessionAi: currentDraft.ai,
      workerAllowOrigins: workerConfig.allowOrigins,
      workerSecrets: currentWorkerSecrets,
      requiredSecretFields,
      workerConfig,
    });
    if (!proof) throw new Error('Worker requirement verification could not be recorded.');

    const liveRuntime = readRuntime(runtimeRef);
    const liveDraft = liveRuntime.draft && typeof liveRuntime.draft === 'object' ? liveRuntime.draft : {};
    const liveDraftWorkerUrl = normalizeWorkerUrl(liveDraft.corsWorkerUrl);
    const liveAdminAddress = toStr(liveRuntime.account || liveRuntime.resolvedAdminAddress).trim();
    const liveAllowOrigins =
      liveRuntime.workerAllowOrigins == null
        ? parseAllowOriginsInput()
        : parseSessionWizardAllowOriginsInput(liveRuntime.workerAllowOrigins);
    const liveWorkerSecrets = getCurrentWorkerSecrets();
    const liveWorkerConfig = buildSessionWizardWorkerVerificationConfig({
      runtime: withTemplateHelperFlag(liveRuntime),
      draft: liveDraft,
      adminAddress: liveAdminAddress,
      workerUrl,
      allowOrigins: liveAllowOrigins,
      workerSecrets: liveWorkerSecrets,
    });
    const liveReadiness = resolveSessionWizardWorkerRequirementReadiness({
      proof,
      workerUrl: bootstrap.workerOrigin,
      sessionSlug: liveDraft.slug,
      sessionId: liveRuntime.sessionId || liveRuntime.sessionIdHex,
      sessionConfig: liveDraft,
      sessionModeProfile: liveDraft.sessionModeProfile,
      sessionAi: liveDraft.ai,
      workerAllowOrigins: liveAllowOrigins,
      workerSecrets: liveWorkerSecrets,
      workerSecretsEnabled: liveRuntime.workerSecretsEnabled !== false,
      workerConfig: liveWorkerConfig,
    });
    if (
      liveDraftWorkerUrl !== initialDraftWorkerUrl ||
      liveRuntime.loginComplete !== true ||
      !liveAdminAddress ||
      !liveReadiness.verified
    ) {
      throw new Error('Session settings changed while Worker verification was in progress. Verify the Worker again.');
    }

    const agentSessionWrapped = bootstrap.config.agentSessionWrapped;
    if (agentSessionWrapped) updateDraftValue(['agentSessionWrapped'], agentSessionWrapped);
    updateDraftValue(['corsWorkerUrl'], bootstrap.workerOrigin);
    if (deployedFromTemplate) {
      // Publication rebuilds this config from the draft; keep it matching the
      // verified one.
      updateDraftValue(['embeddedDeployHelperEnabled'], false);
    }
    publishVerifiedRuntime(runtimeRef, currentDraft, bootstrap.workerOrigin, bootstrap.workerOrigin, true, proof, {
      ...(deployedFromTemplate ? { embeddedDeployHelperEnabled: false } : {}),
      ...(agentSessionWrapped ? { agentSessionWrapped } : {}),
    });
    if (runtimeRef?.current) runtimeRef.current = withTemplateHelperFlag(runtimeRef.current);
    updateDeploymentState({
      deployStatus: bootstrap.configRevision
        ? `Session Worker verified at canonical config revision ${bootstrap.configRevision}.`
        : 'Session Worker verified.',
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
