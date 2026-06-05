import { normalizeSessionWizardArweaveUri } from './sessionWizardUrlSupport';
import {
  buildSessionWizardPublishExecutionPlan,
  resolveSessionWizardPublishProgressDisplayState,
  type SessionWizardPublishProgressDisplayState,
} from './sessionWizardPublishFlow';

export type SessionWizardPublishReadinessInput = {
  resolvedWorkerBaseUrl: string;
  workerMode: string;
  usesDefaultWorkerUrl: boolean;
  deployVerifiedInUi: boolean;
  deployWorkerMatchesConfiguredUrl: boolean;
  canUseSponsoredAutoDeployNow: boolean;
  manualMetadataUrl: string;
  metadataUrl: string;
};

export type SessionWizardPublishReadinessDescriptor = {
  canUploadMetadataNow: boolean;
  uploadBlockedReason: string;
  hasManualMetadata: boolean;
  hasUploadedMetadata: boolean;
  canPublishNow: boolean;
  showUploadBlockedReason: boolean;
};

export type SessionWizardPublishUiPlanInput = SessionWizardPublishReadinessInput & {
  deployComplete?: boolean;
  effectiveMetadataGatewayUrl?: string;
  effectiveMetadataTxId?: string;
  hasPendingDrafts?: boolean;
  publishBusy?: boolean;
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

export type SessionWizardPublishUiPlan = {
  publishReadiness: SessionWizardPublishReadinessDescriptor;
  publishExecutionPlan: ReturnType<typeof buildSessionWizardPublishExecutionPlan>;
  publishMetadataDisplayState: SessionWizardPublishMetadataDisplayState;
  publishProgressDisplayState: SessionWizardPublishProgressDisplayState;
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
}: SessionWizardPublishReadinessInput): SessionWizardPublishReadinessDescriptor {
  const canUploadMetadataNow = !!resolvedWorkerBaseUrl && (
    workerMode === 'default' ||
    usesDefaultWorkerUrl ||
    (deployVerifiedInUi && deployWorkerMatchesConfiguredUrl)
  );
  const uploadBlockedReason = !resolvedWorkerBaseUrl
    ? 'Set a worker URL before uploading metadata.'
    : (workerMode !== 'default' && !usesDefaultWorkerUrl && !deployVerifiedInUi)
      ? 'Custom worker mode requires a successful deploy in this run before metadata upload.'
      : (workerMode !== 'default' && !usesDefaultWorkerUrl && deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl)
        ? 'Configured worker URL differs from the last successful deploy URL; re-deploy or reset to the verified URL.'
        : 'Deploy the worker and ensure the worker URL is set before uploading metadata.';
  const hasManualMetadata = !!normalizeSessionWizardArweaveUri(manualMetadataUrl);
  const hasUploadedMetadata = !!normalizeSessionWizardArweaveUri(metadataUrl);
  const canPublishNow = (
    canUploadMetadataNow ||
    canUseSponsoredAutoDeployNow ||
    hasManualMetadata ||
    hasUploadedMetadata
  );
  const showUploadBlockedReason = !canPublishNow && !hasManualMetadata && !hasUploadedMetadata;

  return {
    canUploadMetadataNow,
    uploadBlockedReason,
    hasManualMetadata,
    hasUploadedMetadata,
    canPublishNow,
    showUploadBlockedReason,
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
    metadataUriLabel: showMetadataUri
      ? (showManualMetadataUri ? 'Uploaded metadata URI' : 'Metadata URI')
      : '',
    showArweaveTx: !!normalizedTxId && !!normalizedGatewayUrl,
    showManualMetadataUri,
    showMetadataUri,
  };
}

export function resolveSessionWizardPublishUiPlan({
  deployComplete = false,
  effectiveMetadataGatewayUrl = '',
  effectiveMetadataTxId = '',
  hasPendingDrafts = false,
  publishBusy = false,
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
  });
  const publishProgressDisplayState = resolveSessionWizardPublishProgressDisplayState({
    elapsedMs: publishStepElapsedMs,
    publishBusy,
    publishStep,
    publishSteps: publishExecutionPlan.steps,
    sbtsLabel,
  });
  const publishMetadataDisplayState = resolveSessionWizardPublishMetadataDisplayState({
    effectiveMetadataGatewayUrl,
    effectiveMetadataTxId,
    manualMetadataUrl: readinessInput.manualMetadataUrl,
    metadataUrl: readinessInput.metadataUrl,
  });

  return {
    publishReadiness,
    publishExecutionPlan,
    publishMetadataDisplayState,
    publishProgressDisplayState,
  };
}
