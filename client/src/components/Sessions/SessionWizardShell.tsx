/** @file SessionWizardShell.tsx */
import React from 'react';

import styles from './SessionWizard.module.scss';
import EncryptionPanel from './EncryptionPanel';
import SessionMetadataEditor from './SessionMetadataEditor';
import SessionPublishSummary from './SessionPublishSummary';
import SessionWizardHeader from './SessionWizardHeader';
import SessionWizardModals from './SessionWizardModals';
import SessionWizardNormalModeRail from './SessionWizardNormalModeRail';
import SessionWizardRequirementsBanner from './SessionWizardRequirementsBanner';
import SessionWizardSponsoredStatus from './SessionWizardSponsoredStatus';
import WorkerDeployHelperToggle from './WorkerDeployHelperToggle';
import WorkerPanel from './WorkerPanel';

type SessionWizardShellProps = {
  [key: string]: any;
};

const SessionWizardShell = ({
  account,
  activeCreateSbtTargetGate,
  activeCreateSbtTargetGateId,
  activeNormalModeIndex,
  addEncryptionGate,
  adminUrl,
  adminUrlStatus,
  advancedBundleFileInputRef,
  bundleFile,
  bundleMode,
  canPublishNow,
  clearSelectedBundleFile,
  clearWorkerSecretFields,
  closeContractViewerModal,
  closeCreateSbtModal,
  collapsedSections,
  contractViewerModalState,
  createSbtModalArweaveJwkOverride,
  createSbtModalChainId,
  createSbtModalNetwork,
  createSbtModalSessionSlug,
  createSbtModalState,
  defaultAllowedOrigins,
  defaultGateId,
  deployComplete,
  deployForm,
  deployHelperUrl,
  deployInFlight,
  deployStatus,
  deployStatusIsError,
  deployWorkerUrl,
  devPersistWorkerSecrets,
  displayedWorkerUrl,
  draft,
  effectivePersistWorkerSecrets,
  embeddedDeployHelperEnabled,
  encryptionGates,
  ensureLightSbtUniverse,
  focusCreateSbtTargetGate,
  focusNormalModeSection,
  getSessionWizardDefaultWorkerUrl,
  handleCopyAdminUrl,
  handleGateAddSbt,
  handleGateRemoveSbt,
  handleDeployWorker,
  handleSavePendingSbtDraft,
  hasSponsoredBundleLink,
  isNormalMode,
  jsonCopied,
  launchCreateSbtModal,
  localWorkerBundleFallbackFilePath,
  manualBundleUrlOverrideHelp,
  manualGasLimit,
  manualGasPriceGwei,
  manualMaxFeePerGasGwei,
  manualMaxPriorityFeePerGasGwei,
  manualMetadataUrl,
  moreOptionsEntries,
  moreOptionsOpen,
  network,
  newSessionFundingRequirementHref,
  newSessionFundingRequirementLabel,
  newSessionRequiresLitCredential,
  normalizeSbtSelection,
  normalModeBundleHelpText,
  normalModeBundleUrl,
  normalModeBundleUrlOverride,
  normalModeBundleUrlOverrideValidationError,
  normalModeCards,
  normalModeManualBundleHelpText,
  normalModePublishSummary,
  normalModeRetryBundleFileInputRef,
  onCloseDisplaySettings,
  onCloseSessionHeaderPreviewModal,
  onCopyDraftJson,
  onDismissNewSessionRequirementsBanner,
  onEnterAdvancedMode,
  onEnterNormalMode,
  onManualGasLimitChange,
  onManualGasPriceGweiChange,
  onManualMaxFeePerGasGweiChange,
  onManualMaxPriorityFeePerGasGweiChange,
  onManualMetadataUrlChange,
  onNormalModeBundleUrlOverrideChange,
  onPublish,
  onRegistryChainIdChange,
  onRetrySponsoredBundle,
  onToggleDisplaySettings,
  onToggleJsonPreview,
  onToggleMoreOptions,
  onTogglePublishAdvanced,
  pendingSbtDrafts,
  pendingSbtSelectorOptions,
  persistWorkerSecrets,
  primaryDraftEntries,
  provider,
  publishAdvancedOpen,
  publishBusy,
  publishMetadataDisplayState,
  publishProgressDisplayState,
  publishStep,
  publishedPendingSbtLinks,
  registerExplorerBaseUrl,
  registerTxs,
  registryAddress,
  registryChainId,
  registryChainName,
  registryChainOptions,
  removeEncryptionGate,
  removePendingSbtDraft,
  renderField,
  renderResourceCard,
  renderSessionWizardInfoTooltip,
  resolvedActiveSessionSlug,
  resolvedWorkerBaseUrl,
  sbtCacheRevision,
  selectedWizardContract,
  selectedWizardContractHref,
  selectorSourceChainId,
  selectorSourceSessionConfig,
  sessionHeaderPreviewModalOpen,
  sessionHeaderPreviewSrc,
  sessionMetadataHeaderAccessory,
  sessionUrl,
  setBundleFile,
  setBundleMode,
  setDeployForm,
  setDeployHelperUrl,
  setNormalModeBundleUrlOverride,
  setPersistWorkerSecrets,
  setWorkerAllowOrigins,
  setWorkerMode,
  setWorkerSecretsEnabled,
  setWorkerUrlAutoFilled,
  shouldShowDeployHelperUrlInput,
  shouldUseSponsoredAutoDeployFlow,
  showUploadBlockedReason,
  showJsonPreview,
  showNewSessionRequirementsBanner,
  showNormalModeManualBundleControls,
  showNormalModeWorkerStep,
  showSharedWorkerChoice,
  showSponsoredBundleFallbackInput,
  showSponsoredDeployAccessNotice,
  showWorkerUrlField,
  sponsoredBundleStatus,
  sponsoredManualBundleRetryMessage,
  sponsoredPublishBundleFileInputRef,
  status,
  signBootstrapAdminAction,
  t,
  toggleLoginModal,
  toggleSection,
  updateDraftValue,
  updateEncryptionGate,
  uploadBlockedReason,
  visibleWorkerResourceKeys,
  workerAllowOrigins,
  workerMode,
  workerSecretsEnabled,
  workerUrlAutoFilled,
  workerUrlSource,
  wizardDisplaySettingsOpen,
  wizardMode,
}: SessionWizardShellProps) => (
  <div className={styles.groupWizard}>
    <SessionWizardHeader
      hasSponsoredBundleLink={hasSponsoredBundleLink}
      isNormalMode={isNormalMode}
      onCloseDisplaySettings={onCloseDisplaySettings}
      onEnterAdvancedMode={onEnterAdvancedMode}
      onEnterNormalMode={onEnterNormalMode}
      onRegistryChainIdChange={onRegistryChainIdChange}
      onToggleDisplaySettings={onToggleDisplaySettings}
      registryAddress={registryAddress}
      registryChainId={registryChainId}
      registryChainName={registryChainName}
      registryChainOptions={registryChainOptions}
      renderInfoTooltip={renderSessionWizardInfoTooltip}
      wizardDisplaySettingsOpen={wizardDisplaySettingsOpen}
      wizardMode={wizardMode}
    />

    {showNewSessionRequirementsBanner ? (
      <SessionWizardRequirementsBanner
        fundingRequirementHref={newSessionFundingRequirementHref}
        fundingRequirementLabel={newSessionFundingRequirementLabel}
        newSessionRequiresLitCredential={newSessionRequiresLitCredential}
        onDismiss={onDismissNewSessionRequirementsBanner}
      />
    ) : null}

    <SessionWizardSponsoredStatus
      onRetry={onRetrySponsoredBundle}
      status={sponsoredBundleStatus}
    />

    {isNormalMode && (
      <SessionWizardNormalModeRail
        activeNormalModeIndex={activeNormalModeIndex}
        collapsedSections={collapsedSections}
        normalModeCards={normalModeCards}
        onFocusSection={focusNormalModeSection}
      />
    )}

    {(!isNormalMode || !collapsedSections.encryption) && (
      <EncryptionPanel
        isNormalMode={isNormalMode}
        t={t}
        renderSessionWizardInfoTooltip={renderSessionWizardInfoTooltip}
        isCollapsed={collapsedSections.encryption}
        onToggleCollapsed={() => toggleSection('encryption')}
        launchCreateSbtModal={launchCreateSbtModal}
        activeCreateSbtTargetGateId={activeCreateSbtTargetGateId}
        activeCreateSbtTargetGate={activeCreateSbtTargetGate}
        encryptionGates={encryptionGates}
        focusCreateSbtTargetGate={focusCreateSbtTargetGate}
        updateEncryptionGate={updateEncryptionGate}
        removeEncryptionGate={removeEncryptionGate}
        normalizeSbtSelection={normalizeSbtSelection}
        handleGateAddSbt={handleGateAddSbt}
        handleGateRemoveSbt={handleGateRemoveSbt}
        network={network}
        pendingSbtSelectorOptions={pendingSbtSelectorOptions}
        selectorSourceChainId={selectorSourceChainId}
        selectorSourceSessionConfig={selectorSourceSessionConfig}
        resolvedActiveSessionSlug={resolvedActiveSessionSlug}
        sbtCacheRevision={sbtCacheRevision}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
        addEncryptionGate={addEncryptionGate}
        pendingSbtDrafts={pendingSbtDrafts}
        removePendingSbtDraft={removePendingSbtDraft}
      />
    )}

    {(!isNormalMode || !collapsedSections.metadata) && (
      <SessionMetadataEditor
        isNormalMode={isNormalMode}
        wizardMode={wizardMode}
        isCollapsed={collapsedSections.metadata}
        onToggleCollapsed={() => toggleSection('metadata')}
        headerAccessory={sessionMetadataHeaderAccessory}
        primaryEntries={primaryDraftEntries}
        moreOptionsEntries={moreOptionsEntries}
        moreOptionsOpen={moreOptionsOpen}
        onToggleMoreOptions={onToggleMoreOptions}
        renderField={renderField}
        draft={draft}
        showJsonPreview={showJsonPreview}
        onToggleJsonPreview={onToggleJsonPreview}
        onCopyDraftJson={onCopyDraftJson}
        jsonCopied={jsonCopied}
      />
    )}

    {(!isNormalMode || (showNormalModeWorkerStep && !collapsedSections.worker)) && (
      <WorkerPanel
        isNormalMode={isNormalMode}
        t={t}
        renderSessionWizardInfoTooltip={renderSessionWizardInfoTooltip}
        isCollapsed={collapsedSections.worker}
        onToggleCollapsed={() => toggleSection('worker')}
        showSharedWorkerChoice={showSharedWorkerChoice}
        workerMode={workerMode}
        onWorkerModeChange={setWorkerMode}
        setWorkerUrlAutoFilled={setWorkerUrlAutoFilled}
        updateDraftValue={updateDraftValue}
        getDefaultWorkerUrl={getSessionWizardDefaultWorkerUrl}
        draft={draft}
        deployWorkerUrl={deployWorkerUrl}
        deployComplete={deployComplete}
        devPersistWorkerSecrets={devPersistWorkerSecrets}
        persistWorkerSecrets={persistWorkerSecrets}
        setPersistWorkerSecrets={setPersistWorkerSecrets}
        workerSecretsEnabled={workerSecretsEnabled}
        setWorkerSecretsEnabled={setWorkerSecretsEnabled}
        clearWorkerSecretFields={clearWorkerSecretFields}
        effectivePersistWorkerSecrets={effectivePersistWorkerSecrets}
        workerResourceKeys={visibleWorkerResourceKeys}
        renderResourceCard={renderResourceCard}
        workerAllowOrigins={workerAllowOrigins}
        setWorkerAllowOrigins={setWorkerAllowOrigins}
        defaultAllowedOrigins={defaultAllowedOrigins}
        shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
        deployForm={deployForm}
        deployHelperToggle={(
          <WorkerDeployHelperToggle
            checked={embeddedDeployHelperEnabled}
            onChange={(nextValue) => updateDraftValue(['embeddedDeployHelperEnabled'], nextValue)}
            renderInfoTooltip={renderSessionWizardInfoTooltip}
          />
        )}
        shouldShowDeployHelperUrlInput={shouldShowDeployHelperUrlInput}
        deployHelperUrl={deployHelperUrl}
        setDeployHelperUrl={setDeployHelperUrl}
        bundleMode={bundleMode}
        setBundleMode={setBundleMode}
        normalModeBundleUrl={normalModeBundleUrl}
        normalModeBundleHelpText={normalModeBundleHelpText}
        showNormalModeManualBundleControls={showNormalModeManualBundleControls}
        normalModeBundleUrlOverride={normalModeBundleUrlOverride}
        setNormalModeBundleUrlOverride={setNormalModeBundleUrlOverride}
        normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
        manualBundleUrlOverrideHelp={manualBundleUrlOverrideHelp}
        normalModeRetryBundleFileInputRef={normalModeRetryBundleFileInputRef}
        setBundleFile={setBundleFile}
        clearSelectedBundleFile={clearSelectedBundleFile}
        bundleFile={bundleFile}
        normalModeManualBundleHelpText={normalModeManualBundleHelpText}
        localWorkerBundleFallbackFilePath={localWorkerBundleFallbackFilePath}
        advancedBundleFileInputRef={advancedBundleFileInputRef}
        showSponsoredDeployAccessNotice={showSponsoredDeployAccessNotice}
        account={account}
        resolvedActiveSessionSlug={resolvedActiveSessionSlug}
        setDeployForm={setDeployForm}
        handleDeployWorker={handleDeployWorker}
        deployInFlight={deployInFlight}
        deployStatus={deployStatus}
        deployStatusIsError={deployStatusIsError}
        showWorkerUrlField={showWorkerUrlField}
        displayedWorkerUrl={displayedWorkerUrl}
        renderField={renderField}
        workerUrlAutoFilled={workerUrlAutoFilled}
      />
    )}

    {(!isNormalMode || !collapsedSections.publish) && (
      <SessionPublishSummary
        isNormalMode={isNormalMode}
        wizardMode={wizardMode}
        isCollapsed={collapsedSections.publish}
        onToggleCollapsed={() => toggleSection('publish')}
        normalModePublishSummary={normalModePublishSummary}
        onPublish={onPublish}
        publishBusy={publishBusy}
        canPublishNow={canPublishNow}
        publishAdvancedOpen={publishAdvancedOpen}
        onTogglePublishAdvanced={() => onTogglePublishAdvanced()}
        showSponsoredBundleFallbackInput={showSponsoredBundleFallbackInput}
        normalModeBundleUrlOverride={normalModeBundleUrlOverride}
        onNormalModeBundleUrlOverrideChange={onNormalModeBundleUrlOverrideChange}
        normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
        manualBundleUrlOverrideHelp={manualBundleUrlOverrideHelp}
        bundleFileInputRef={sponsoredPublishBundleFileInputRef}
        onBundleFileChange={setBundleFile}
        onClearBundleFile={clearSelectedBundleFile}
        bundleFile={bundleFile}
        localWorkerBundleFallbackFilePath={localWorkerBundleFallbackFilePath}
        sponsoredManualBundleRetryMessage={sponsoredManualBundleRetryMessage}
        publishMetadataDisplayState={publishMetadataDisplayState}
        showPublishProgress={publishProgressDisplayState.showPublishProgress}
        activePublishProgressStepLabel={publishProgressDisplayState.activePublishProgressStepLabel}
        publishProgressPercent={publishProgressDisplayState.publishProgressPercent}
        publishProgressPercentRounded={publishProgressDisplayState.publishProgressPercentRounded}
        publishStep={publishStep}
        publishProgressSteps={publishProgressDisplayState.publishProgressSteps}
        uploadBlockedReason={uploadBlockedReason}
        showUploadBlockedReason={showUploadBlockedReason}
        renderInfoTooltip={renderSessionWizardInfoTooltip}
        resolvedWorkerBaseUrl={resolvedWorkerBaseUrl}
        workerUrlSource={workerUrlSource}
        manualMetadataUrl={manualMetadataUrl}
        onManualMetadataUrlChange={onManualMetadataUrlChange}
        manualGasLimit={manualGasLimit}
        onManualGasLimitChange={onManualGasLimitChange}
        manualGasPriceGwei={manualGasPriceGwei}
        onManualGasPriceGweiChange={onManualGasPriceGweiChange}
        manualMaxFeePerGasGwei={manualMaxFeePerGasGwei}
        onManualMaxFeePerGasGweiChange={onManualMaxFeePerGasGweiChange}
        manualMaxPriorityFeePerGasGwei={manualMaxPriorityFeePerGasGwei}
        onManualMaxPriorityFeePerGasGweiChange={onManualMaxPriorityFeePerGasGweiChange}
        registerTxs={registerTxs}
        registerExplorerBaseUrl={registerExplorerBaseUrl}
        sessionUrl={sessionUrl}
        adminUrl={adminUrl}
        publishedPendingSbtLinks={publishedPendingSbtLinks}
        onCopyAdminUrl={handleCopyAdminUrl}
        adminUrlStatus={adminUrlStatus}
        status={status}
      />
    )}

    <SessionWizardModals
      account={account}
      provider={provider}
      createSbtModalState={createSbtModalState}
      closeCreateSbtModal={closeCreateSbtModal}
      createSbtModalNetwork={createSbtModalNetwork}
      toggleLoginModal={toggleLoginModal}
      createSbtModalSessionSlug={createSbtModalSessionSlug}
      draft={draft}
      createSbtModalChainId={createSbtModalChainId}
      createSbtModalArweaveJwkOverride={createSbtModalArweaveJwkOverride}
      encryptionGates={encryptionGates}
      normalizeSbtSelection={normalizeSbtSelection}
      defaultGateId={defaultGateId}
      signBootstrapAdminAction={signBootstrapAdminAction}
      handleSavePendingSbtDraft={handleSavePendingSbtDraft}
      contractViewerModalState={contractViewerModalState}
      selectedWizardContract={selectedWizardContract}
      closeContractViewerModal={closeContractViewerModal}
      selectedWizardContractHref={selectedWizardContractHref}
      sessionHeaderPreviewModalOpen={sessionHeaderPreviewModalOpen}
      onCloseSessionHeaderPreviewModal={onCloseSessionHeaderPreviewModal}
      sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
      t={t}
    />
  </div>
);

export default SessionWizardShell;
