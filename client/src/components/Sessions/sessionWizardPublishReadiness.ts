import { normalizeSessionWizardArweaveUri, parseSessionWizardArweaveTxId } from './sessionWizardUrlSupport';
import {
  buildSessionWizardPublishExecutionPlan,
  resolveSessionWizardPublishProgressDisplayState,
  type SessionWizardPublishProgressDisplayState,
} from './sessionWizardPublishFlow';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';

export type SessionWizardPublishReadinessInput = {
  resolvedWorkerBaseUrl: string;
  workerMode: string;
  usesDefaultWorkerUrl: boolean;
  deployVerifiedInUi: boolean;
  deployWorkerMatchesConfiguredUrl: boolean;
  canUseSponsoredAutoDeployNow: boolean;
  manualMetadataUrl: string;
  metadataUrl: string;
  sessionModeProfile?: SessionModeProfile | null;
};

export type SessionWizardPublishReadinessDescriptor = {
  canUploadMetadataNow: boolean;
  uploadBlockedReason: string;
  hasManualMetadata: boolean;
  hasUploadedMetadata: boolean;
  canPublishNow: boolean;
  readinessKind: SessionWizardPublishReadinessKind;
  showUploadBlockedReason: boolean;
};

export type SessionWizardPublishReadinessKind =
  'blocked' | 'manual-metadata' | 'sponsored-auto-deploy' | 'uploaded-metadata' | 'worker-config' | 'worker-upload';

export type SessionWizardPublishUiPlanInput = SessionWizardPublishReadinessInput & {
  buildMetadataGatewayUrl?: SessionWizardPublishMetadataGatewayUrlBuilder | null;
  deployComplete?: boolean;
  effectiveMetadataGatewayUrl?: string;
  effectiveMetadataTxId?: string;
  hasPendingDrafts?: boolean;
  isNormalMode?: boolean;
  publishAdvancedOpen?: boolean;
  publishBusy?: boolean;
  publishCompleted?: boolean;
  publishStep?: number;
  publishStepElapsedMs?: number;
  sbtsLabel?: unknown;
};

export type SessionWizardPublishMetadataDisplayState = {
  effectiveMetadataGatewayUrl: string;
  effectiveMetadataTxId: string;
  manualMetadataDisplayUri: string;
  metadataUri: string;
  metadataUriLabel: 'Metadata URI' | 'Uploaded metadata URI' | '';
  showArweaveTx: boolean;
  showManualMetadataUri: boolean;
  showMetadataUri: boolean;
};

export type SessionWizardPublishMetadataGatewayUrlBuilder = (txId: string) => unknown;

export type SessionWizardPublishMetadataIdentityState = {
  effectiveMetadataGatewayUrl: string;
  effectiveMetadataTxId: string;
  effectiveMetadataUri: string;
};

export type SessionWizardPublishActionDisplayMode = 'advanced' | 'normal';

export type SessionWizardPublishActionDisplayState = {
  canPublishNow: boolean;
  displayMode: SessionWizardPublishActionDisplayMode;
  publishAdvancedOpen: boolean;
  publishBusy: boolean;
  publishButtonDisabled: boolean;
  publishButtonLabel: 'Deploy Session' | 'Publish' | 'Session Created';
  settingsButtonActive: boolean;
};

export type SessionWizardPublishUiPlan = {
  publishActionDisplayState: SessionWizardPublishActionDisplayState;
  publishReadiness: SessionWizardPublishReadinessDescriptor;
  publishExecutionPlan: ReturnType<typeof buildSessionWizardPublishExecutionPlan>;
  publishMetadataDisplayState: SessionWizardPublishMetadataDisplayState;
  publishProgressDisplayState: SessionWizardPublishProgressDisplayState;
};

export type SessionWizardPublishRequestPendingDraft = {
  deployed?: boolean;
};

export type SessionWizardPublishRequestDescriptorInput = {
  pendingDraftSnapshot?: readonly SessionWizardPublishRequestPendingDraft[];
  manualMetadataUrl?: string;
  workerMode?: string;
  sponsoredAutoDeployReady?: boolean;
  deployComplete?: boolean;
  canUploadMetadataNow?: boolean;
  sessionModeProfile?: SessionModeProfile | null;
};

export type SessionWizardPublishRequestDescriptor = {
  pendingDraftSnapshot: readonly SessionWizardPublishRequestPendingDraft[];
  hasPendingDrafts: boolean;
  hasManualMetadata: boolean;
  publishExecutionPlan: ReturnType<typeof buildSessionWizardPublishExecutionPlan>;
};

export function resolveSessionWizardPublishReadiness({
  resolvedWorkerBaseUrl,
  workerMode,
  usesDefaultWorkerUrl,
  deployVerifiedInUi,
  deployWorkerMatchesConfiguredUrl,
  canUseSponsoredAutoDeployNow,
  manualMetadataUrl,
  metadataUrl,
  sessionModeProfile = null,
}: SessionWizardPublishReadinessInput): SessionWizardPublishReadinessDescriptor {
  const modeRequirements = resolveSessionWizardModeRequirements(sessionModeProfile);
  const hasCompatibleWorkerRuntime =
    !!resolvedWorkerBaseUrl &&
    ((workerMode === 'default' && usesDefaultWorkerUrl) ||
      (deployVerifiedInUi && deployWorkerMatchesConfiguredUrl));
  const canUploadMetadataNow = hasCompatibleWorkerRuntime;
  const uploadBlockedReason = !resolvedWorkerBaseUrl
    ? 'Set a worker URL before uploading metadata.'
    : workerMode !== 'default' && !usesDefaultWorkerUrl && !deployVerifiedInUi
      ? 'Custom worker mode requires a successful deploy in this run before metadata upload.'
      : workerMode !== 'default' && !usesDefaultWorkerUrl && deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl
        ? 'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.'
        : 'Deploy the worker and ensure the worker URL is set before uploading metadata.';
  const hasManualMetadata = !!normalizeSessionWizardArweaveUri(manualMetadataUrl);
  const hasUploadedMetadata = !!normalizeSessionWizardArweaveUri(metadataUrl);
  // Regression guard: a URL only proves where a custom worker lives. It does
  // not prove that post-deploy config and required secrets reached that worker.
  const canPersistWorkerConfigNow =
    modeRequirements.isWorkerCanonical &&
    hasCompatibleWorkerRuntime;
  const workerRuntimeReady = !modeRequirements.usesWorkerRuntime || hasCompatibleWorkerRuntime;
  const canPublishNow = modeRequirements.isWorkerCanonical
    ? canPersistWorkerConfigNow || canUseSponsoredAutoDeployNow
    : modeRequirements.selected
      ? (workerRuntimeReady && (canUploadMetadataNow || hasManualMetadata || hasUploadedMetadata)) ||
        canUseSponsoredAutoDeployNow
      : canUploadMetadataNow || canUseSponsoredAutoDeployNow || hasManualMetadata || hasUploadedMetadata;
  const readinessKind: SessionWizardPublishReadinessKind = modeRequirements.isWorkerCanonical
    ? canPersistWorkerConfigNow
      ? 'worker-config'
      : canUseSponsoredAutoDeployNow
        ? 'sponsored-auto-deploy'
        : 'blocked'
    : modeRequirements.usesWorkerRuntime && !hasCompatibleWorkerRuntime && !canUseSponsoredAutoDeployNow
      ? 'blocked'
      : hasManualMetadata
      ? 'manual-metadata'
      : hasUploadedMetadata
        ? 'uploaded-metadata'
        : canUploadMetadataNow
          ? 'worker-upload'
          : canUseSponsoredAutoDeployNow
            ? 'sponsored-auto-deploy'
            : 'blocked';
  const showUploadBlockedReason =
    !modeRequirements.isWorkerCanonical &&
    !canPublishNow &&
    (modeRequirements.usesWorkerRuntime || (!hasManualMetadata && !hasUploadedMetadata));

  return {
    canUploadMetadataNow,
    uploadBlockedReason,
    hasManualMetadata,
    hasUploadedMetadata,
    canPublishNow,
    readinessKind,
    showUploadBlockedReason,
  };
}

export function resolveSessionWizardPublishRequestDescriptor({
  pendingDraftSnapshot = [],
  manualMetadataUrl = '',
  workerMode = 'default',
  sponsoredAutoDeployReady = false,
  deployComplete = false,
  canUploadMetadataNow = false,
  sessionModeProfile = null,
}: SessionWizardPublishRequestDescriptorInput = {}): SessionWizardPublishRequestDescriptor {
  const normalizedPendingDraftSnapshot = Array.isArray(pendingDraftSnapshot) ? pendingDraftSnapshot : [];
  const hasPendingDrafts = normalizedPendingDraftSnapshot.some((entry) => entry?.deployed !== true);
  const hasManualMetadata = Boolean(normalizeSessionWizardArweaveUri(manualMetadataUrl));
  const publishExecutionPlan = buildSessionWizardPublishExecutionPlan({
    workerMode,
    sponsoredAutoDeployReady,
    deployComplete,
    hasPendingDrafts,
    hasManualMetadata,
    canUploadMetadataNow,
    sessionModeProfile,
  });

  return {
    pendingDraftSnapshot: normalizedPendingDraftSnapshot,
    hasPendingDrafts,
    hasManualMetadata,
    publishExecutionPlan,
  };
}

export function resolveSessionWizardPublishMetadataIdentityState({
  buildGatewayUrl,
  manualMetadataUrl = '',
  metadataUrl = '',
}: {
  buildGatewayUrl?: SessionWizardPublishMetadataGatewayUrlBuilder | null;
  manualMetadataUrl?: unknown;
  metadataUrl?: unknown;
} = {}): SessionWizardPublishMetadataIdentityState {
  const normalizedManualMetadataUri = normalizeSessionWizardArweaveUri(manualMetadataUrl);
  const uploadedMetadataUri = String(metadataUrl || '').trim();
  const effectiveMetadataUri = normalizedManualMetadataUri || uploadedMetadataUri;
  const effectiveMetadataTxId = parseSessionWizardArweaveTxId(effectiveMetadataUri);
  const effectiveMetadataGatewayUrl =
    effectiveMetadataTxId && typeof buildGatewayUrl === 'function'
      ? String(buildGatewayUrl(effectiveMetadataTxId) || '').trim()
      : '';

  return {
    effectiveMetadataGatewayUrl,
    effectiveMetadataTxId,
    effectiveMetadataUri,
  };
}

export function resolveSessionWizardPublishMetadataDisplayState({
  effectiveMetadataGatewayUrl = '',
  effectiveMetadataTxId = '',
  manualMetadataUrl = '',
  metadataUrl = '',
}: {
  effectiveMetadataGatewayUrl?: unknown;
  effectiveMetadataTxId?: unknown;
  manualMetadataUrl?: unknown;
  metadataUrl?: unknown;
} = {}): SessionWizardPublishMetadataDisplayState {
  const normalizedManualMetadataUri = normalizeSessionWizardArweaveUri(manualMetadataUrl);
  const normalizedMetadataUri = normalizeSessionWizardArweaveUri(metadataUrl);
  const normalizedGatewayUrl = String(effectiveMetadataGatewayUrl || '').trim();
  const normalizedTxId = String(effectiveMetadataTxId || '').trim();
  const showMetadataUri = !!normalizedMetadataUri;
  const showManualMetadataUri = !!normalizedManualMetadataUri;
  return {
    effectiveMetadataGatewayUrl: normalizedGatewayUrl,
    effectiveMetadataTxId: normalizedTxId,
    manualMetadataDisplayUri: normalizedManualMetadataUri,
    metadataUri: normalizedMetadataUri || String(metadataUrl || '').trim(),
    metadataUriLabel: showMetadataUri ? (showManualMetadataUri ? 'Uploaded metadata URI' : 'Metadata URI') : '',
    showArweaveTx: !!normalizedTxId && !!normalizedGatewayUrl,
    showManualMetadataUri,
    showMetadataUri,
  };
}

export function resolveSessionWizardPublishActionDisplayState({
  canPublishNow = false,
  isNormalMode = false,
  publishAdvancedOpen = false,
  publishBusy = false,
  publishCompleted = false,
}: {
  canPublishNow?: boolean;
  isNormalMode?: boolean;
  publishAdvancedOpen?: boolean;
  publishBusy?: boolean;
  publishCompleted?: boolean;
} = {}): SessionWizardPublishActionDisplayState {
  return {
    canPublishNow,
    displayMode: isNormalMode ? 'normal' : 'advanced',
    publishAdvancedOpen,
    publishBusy,
    publishButtonDisabled: publishCompleted || publishBusy || !canPublishNow,
    publishButtonLabel: publishCompleted ? 'Session Created' : isNormalMode ? 'Deploy Session' : 'Publish',
    settingsButtonActive: publishAdvancedOpen,
  };
}

export function resolveSessionWizardPublishUiPlan({
  buildMetadataGatewayUrl,
  deployComplete = false,
  effectiveMetadataGatewayUrl: effectiveMetadataGatewayUrlOverride = '',
  effectiveMetadataTxId: effectiveMetadataTxIdOverride = '',
  hasPendingDrafts = false,
  isNormalMode = false,
  publishAdvancedOpen = false,
  publishBusy = false,
  publishCompleted = false,
  publishStep = 0,
  publishStepElapsedMs = 0,
  sbtsLabel = 'SBTs',
  ...readinessInput
}: SessionWizardPublishUiPlanInput): SessionWizardPublishUiPlan {
  const publishReadiness = resolveSessionWizardPublishReadiness(readinessInput);
  const publishExecutionPlan = buildSessionWizardPublishExecutionPlan({
    workerMode: readinessInput.workerMode,
    sponsoredAutoDeployReady: readinessInput.canUseSponsoredAutoDeployNow,
    deployComplete,
    hasPendingDrafts,
    hasManualMetadata: publishReadiness.hasManualMetadata,
    canUploadMetadataNow: publishReadiness.canUploadMetadataNow,
    sessionModeProfile: readinessInput.sessionModeProfile,
  });
  const publishProgressDisplayState = resolveSessionWizardPublishProgressDisplayState({
    elapsedMs: publishStepElapsedMs,
    publishBusy,
    publishStep,
    publishSteps: publishExecutionPlan.steps,
    sbtsLabel,
  });
  const publishMetadataIdentityState = resolveSessionWizardPublishMetadataIdentityState({
    buildGatewayUrl: buildMetadataGatewayUrl,
    manualMetadataUrl: readinessInput.manualMetadataUrl,
    metadataUrl: readinessInput.metadataUrl,
  });
  const publishMetadataDisplayState = resolveSessionWizardPublishMetadataDisplayState({
    effectiveMetadataGatewayUrl:
      effectiveMetadataGatewayUrlOverride || publishMetadataIdentityState.effectiveMetadataGatewayUrl,
    effectiveMetadataTxId: effectiveMetadataTxIdOverride || publishMetadataIdentityState.effectiveMetadataTxId,
    manualMetadataUrl: readinessInput.manualMetadataUrl,
    metadataUrl: readinessInput.metadataUrl,
  });
  const publishActionDisplayState = resolveSessionWizardPublishActionDisplayState({
    canPublishNow: publishReadiness.canPublishNow,
    isNormalMode,
    publishAdvancedOpen,
    publishBusy,
    publishCompleted,
  });

  return {
    publishActionDisplayState,
    publishReadiness,
    publishExecutionPlan,
    publishMetadataDisplayState,
    publishProgressDisplayState,
  };
}
