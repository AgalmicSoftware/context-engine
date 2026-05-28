import { normalizeSessionWizardArweaveUri } from './sessionWizardUrlSupport';

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
