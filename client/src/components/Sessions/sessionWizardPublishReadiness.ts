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
};

export type SessionWizardPublishUiPlanInput = SessionWizardPublishReadinessInput & {
  deployComplete?: boolean;
  hasPendingDrafts?: boolean;
  publishBusy?: boolean;
  publishStep?: number;
  publishStepElapsedMs?: number;
  sbtsLabel?: unknown;
};

export type SessionWizardPublishUiPlan = {
  publishReadiness: SessionWizardPublishReadinessDescriptor;
  publishExecutionPlan: ReturnType<typeof buildSessionWizardPublishExecutionPlan>;
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

  return {
    canUploadMetadataNow,
    uploadBlockedReason,
    hasManualMetadata,
    hasUploadedMetadata,
    canPublishNow,
  };
}

export function resolveSessionWizardPublishUiPlan({
  deployComplete = false,
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

  return {
    publishReadiness,
    publishExecutionPlan,
    publishProgressDisplayState,
  };
}
