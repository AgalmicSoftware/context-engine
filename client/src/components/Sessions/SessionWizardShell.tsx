/** @file SessionWizardShell.tsx */
import React from 'react';

import styles from './SessionWizard.module.scss';
import EncryptionPanel from './EncryptionPanel';
import SessionMetadataEditor from './SessionMetadataEditor';
import SessionWizardPublishSection from './SessionWizardPublishSection';
import SessionWizardHeader from './SessionWizardHeader';
import SessionWizardIntroStatusRail from './SessionWizardIntroStatusRail';
import SessionWizardModals from './SessionWizardModals';
import WorkerDeployHelperToggle from './WorkerDeployHelperToggle';
import WorkerPanel, { type WorkerPanelProps } from './WorkerPanel';
import type { SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';
import { SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

type HeaderProps = React.ComponentProps<typeof SessionWizardHeader>;
type IntroStatusRailProps = React.ComponentProps<typeof SessionWizardIntroStatusRail>;
type EncryptionPanelBoundaryProps = React.ComponentProps<typeof EncryptionPanel>;
type MetadataEditorProps = React.ComponentProps<typeof SessionMetadataEditor>;
type PublishSectionProps = React.ComponentProps<typeof SessionWizardPublishSection>;
type WizardModalsProps = React.ComponentProps<typeof SessionWizardModals>;
type WorkerDeployHelperToggleBoundaryProps = React.ComponentProps<typeof WorkerDeployHelperToggle>;

type SessionWizardShellSectionKey = 'encryption' | 'metadata' | 'publish' | 'worker';

type SessionWizardShellCollapsedSections = Record<string, boolean> & Record<SessionWizardShellSectionKey, boolean>;

type SessionWizardShellDraft = Record<string, unknown> & {
  contracts?: Record<string, unknown>;
  corsWorkerUrl?: string;
  defaultSbtTags?: string;
  sessionModeProfile?: { preset?: unknown };
  slug?: string;
};

type SessionWizardShellRenderInfoTooltip = (options: {
  ariaLabel?: string;
  content?: React.ReactNode;
  id?: string;
  placement?: SessionWizardTooltipRenderOptions['placement'];
  testId?: string;
  [key: string]: unknown;
}) => React.ReactNode;

export type SessionWizardShellProps = {
  account: WizardModalsProps['account'];
  allowNativeWorkerVerification: WorkerPanelProps['allowNativeWorkerVerification'];
  activeCreateSbtTargetGate: EncryptionPanelBoundaryProps['activeCreateSbtTargetGate'];
  activeCreateSbtTargetGateId: EncryptionPanelBoundaryProps['activeCreateSbtTargetGateId'];
  activeNormalModeIndex: IntroStatusRailProps['activeNormalModeIndex'];
  addEncryptionGate: EncryptionPanelBoundaryProps['addEncryptionGate'];
  adminUrl: PublishSectionProps['adminUrl'];
  adminUrlStatus: PublishSectionProps['adminUrlStatus'];
  advancedBundleFileInputRef: WorkerPanelProps['advancedBundleFileInputRef'];
  bundleFile: PublishSectionProps['bundleFile'];
  bundleMode: WorkerPanelProps['bundleMode'];
  clearSelectedBundleFile: WorkerPanelProps['clearSelectedBundleFile'];
  clearWorkerSecretFields: WorkerPanelProps['clearWorkerSecretFields'];
  closeContractViewerModal: WizardModalsProps['closeContractViewerModal'];
  closeCreateSbtModal: WizardModalsProps['closeCreateSbtModal'];
  collapsedSections: SessionWizardShellCollapsedSections;
  contractViewerModalState: WizardModalsProps['contractViewerModalState'];
  createSbtModalArweaveJwkOverride: WizardModalsProps['createSbtModalArweaveJwkOverride'];
  createSbtModalChainId: WizardModalsProps['createSbtModalChainId'];
  createSbtModalNetwork: WizardModalsProps['createSbtModalNetwork'];
  createSbtModalSessionSlug: WizardModalsProps['createSbtModalSessionSlug'];
  createSbtModalState: WizardModalsProps['createSbtModalState'];
  defaultAllowedOrigins: WorkerPanelProps['defaultAllowedOrigins'];
  defaultGateId: WizardModalsProps['defaultGateId'];
  deployComplete: WorkerPanelProps['deployComplete'];
  deployForm: WorkerPanelProps['deployForm'];
  deployHelperUrl: WorkerPanelProps['deployHelperUrl'];
  deployStatusDisplayState: WorkerPanelProps['deployStatusDisplayState'];
  deployVerifiedInUi?: WorkerPanelProps['deployVerifiedInUi'];
  deployWorkerUrl: WorkerPanelProps['deployWorkerUrl'];
  displayedWorkerUrl: WorkerPanelProps['displayedWorkerUrl'];
  draft: SessionWizardShellDraft;
  embeddedDeployHelperEnabled: WorkerDeployHelperToggleBoundaryProps['checked'];
  encryptionGates: NonNullable<EncryptionPanelBoundaryProps['encryptionGates']>;
  ensureLightSbtUniverse: EncryptionPanelBoundaryProps['ensureLightSbtUniverse'];
  focusCreateSbtTargetGate: EncryptionPanelBoundaryProps['focusCreateSbtTargetGate'];
  focusNormalModeSection: IntroStatusRailProps['onFocusNormalModeSection'];
  getSessionWizardDefaultWorkerUrl: WorkerPanelProps['getDefaultWorkerUrl'];
  handleCopyAdminUrl: PublishSectionProps['onCopyAdminUrl'];
  handleGateAddSbt: EncryptionPanelBoundaryProps['handleGateAddSbt'];
  handleGateRemoveSbt: EncryptionPanelBoundaryProps['handleGateRemoveSbt'];
  handleDeployWorker: WorkerPanelProps['handleDeployWorker'];
  verifyNativeWorker?: WorkerPanelProps['verifyNativeWorker'];
  handleSavePendingSbtDraft: WizardModalsProps['handleSavePendingSbtDraft'];
  hasSponsoredBundleLink: HeaderProps['hasSponsoredBundleLink'];
  isNormalMode: boolean;
  isWorkerCanonical?: boolean;
  jsonCopied: MetadataEditorProps['jsonCopied'];
  launchCreateSbtModal: EncryptionPanelBoundaryProps['launchCreateSbtModal'];
  localWorkerBundleFallbackFilePath: PublishSectionProps['localWorkerBundleFallbackFilePath'];
  manualBundleUrlOverrideHelp: PublishSectionProps['manualBundleUrlOverrideHelp'];
  manualGasLimit: PublishSectionProps['manualGasLimit'];
  manualGasPriceGwei: PublishSectionProps['manualGasPriceGwei'];
  manualMaxFeePerGasGwei: PublishSectionProps['manualMaxFeePerGasGwei'];
  manualMaxPriorityFeePerGasGwei: PublishSectionProps['manualMaxPriorityFeePerGasGwei'];
  manualMetadataUrl: PublishSectionProps['manualMetadataUrl'];
  moreOptionsEntries: MetadataEditorProps['moreOptionsEntries'];
  moreOptionsOpen: MetadataEditorProps['moreOptionsOpen'];
  network: EncryptionPanelBoundaryProps['network'];
  newSessionFundingRequirementHref: IntroStatusRailProps['fundingRequirementHref'];
  newSessionFundingRequirementLabel: IntroStatusRailProps['fundingRequirementLabel'];
  newSessionRequiresLitCredential: IntroStatusRailProps['newSessionRequiresLitCredential'];
  newSessionRequiredAiProviderKeyLabels: IntroStatusRailProps['requiredAiProviderKeyLabels'];
  newSessionRequiredRequirementIds: IntroStatusRailProps['requiredRequirementIds'];
  normalizeSbtSelection: WizardModalsProps['normalizeSbtSelection'];
  normalModeBundleHelpText: WorkerPanelProps['normalModeBundleHelpText'];
  normalModeBundleUrl: WorkerPanelProps['normalModeBundleUrl'];
  normalModeBundleUrlOverride: PublishSectionProps['normalModeBundleUrlOverride'];
  normalModeBundleUrlOverrideValidationError: PublishSectionProps['normalModeBundleUrlOverrideValidationError'];
  normalModeCards: IntroStatusRailProps['normalModeCards'];
  normalModeManualBundleHelpText: WorkerPanelProps['normalModeManualBundleHelpText'];
  normalModePublishSummary: PublishSectionProps['normalModePublishSummary'];
  normalModeRetryBundleFileInputRef: WorkerPanelProps['normalModeRetryBundleFileInputRef'];
  onCloseDisplaySettings: HeaderProps['onCloseDisplaySettings'];
  onCloseSessionHeaderPreviewModal: WizardModalsProps['onCloseSessionHeaderPreviewModal'];
  onCopyDraftJson: MetadataEditorProps['onCopyDraftJson'];
  onCreateAnotherSession?: PublishSectionProps['onCreateAnotherSession'];
  onDismissNewSessionRequirementsBanner: IntroStatusRailProps['onDismissRequirements'];
  onEnterAdvancedMode: HeaderProps['onEnterAdvancedMode'];
  onEnterNormalMode: HeaderProps['onEnterNormalMode'];
  onManualGasLimitChange: PublishSectionProps['onManualGasLimitChange'];
  onManualGasPriceGweiChange: PublishSectionProps['onManualGasPriceGweiChange'];
  onManualMaxFeePerGasGweiChange: PublishSectionProps['onManualMaxFeePerGasGweiChange'];
  onManualMaxPriorityFeePerGasGweiChange: PublishSectionProps['onManualMaxPriorityFeePerGasGweiChange'];
  onManualMetadataUrlChange: PublishSectionProps['onManualMetadataUrlChange'];
  onNormalModeBundleUrlOverrideChange: PublishSectionProps['onNormalModeBundleUrlOverrideChange'];
  onNativeWorkerVerified?: WorkerPanelProps['onNativeWorkerVerified'];
  onPublish: PublishSectionProps['onPublish'];
  onRegistryChainIdChange: HeaderProps['onRegistryChainIdChange'];
  onRetrySponsoredBundle: IntroStatusRailProps['onRetrySponsoredBundle'];
  onSponsoredBundleKeyChange?: IntroStatusRailProps['onSponsoredBundleKeyChange'];
  onSubmitSponsoredBundleKey?: IntroStatusRailProps['onSubmitSponsoredBundleKey'];
  onToggleDisplaySettings: HeaderProps['onToggleDisplaySettings'];
  onToggleJsonPreview: MetadataEditorProps['onToggleJsonPreview'];
  onToggleMoreOptions: MetadataEditorProps['onToggleMoreOptions'];
  onTogglePublishAdvanced: PublishSectionProps['onTogglePublishAdvanced'];
  pendingSbtDrafts: EncryptionPanelBoundaryProps['pendingSbtDrafts'];
  pendingWorkerGroupDrafts: EncryptionPanelBoundaryProps['pendingWorkerGroupDrafts'];
  onAddPendingWorkerGroupDraft: EncryptionPanelBoundaryProps['onAddPendingWorkerGroupDraft'];
  onRemovePendingWorkerGroupDraft: EncryptionPanelBoundaryProps['onRemovePendingWorkerGroupDraft'];
  onUpdatePendingWorkerGroupDraft: EncryptionPanelBoundaryProps['onUpdatePendingWorkerGroupDraft'];
  pendingSbtSelectorOptions: EncryptionPanelBoundaryProps['pendingSbtSelectorOptions'];
  primaryDraftEntries: MetadataEditorProps['primaryEntries'];
  provider: WizardModalsProps['provider'];
  publishUiPlan: PublishSectionProps['publishUiPlan'];
  publishSettingsCapabilities: PublishSectionProps['publishSettingsCapabilities'];
  publishedPendingSbtLinks: PublishSectionProps['publishedPendingSbtLinks'];
  registerExplorerBaseUrl: PublishSectionProps['registerExplorerBaseUrl'];
  registerTxs: PublishSectionProps['registerTxs'];
  registryAddress: HeaderProps['registryAddress'];
  registryChainId: HeaderProps['registryChainId'];
  registryChainName: HeaderProps['registryChainName'];
  registryChainOptions: HeaderProps['registryChainOptions'];
  removeEncryptionGate: EncryptionPanelBoundaryProps['removeEncryptionGate'];
  removePendingSbtDraft: EncryptionPanelBoundaryProps['removePendingSbtDraft'];
  renderField: SessionWizardRenderField;
  renderResourceCard: WorkerPanelProps['renderResourceCard'];
  renderSessionWizardInfoTooltip: SessionWizardShellRenderInfoTooltip;
  resolvedActiveSessionSlug: WorkerPanelProps['resolvedActiveSessionSlug'];
  resolvedWorkerBaseUrl: PublishSectionProps['resolvedWorkerBaseUrl'];
  sbtCacheRevision: EncryptionPanelBoundaryProps['sbtCacheRevision'];
  selectedWizardContract: WizardModalsProps['selectedWizardContract'];
  selectedWizardContractHref: WizardModalsProps['selectedWizardContractHref'];
  selectorSourceChainId: EncryptionPanelBoundaryProps['selectorSourceChainId'];
  selectorSourceSessionConfig: EncryptionPanelBoundaryProps['selectorSourceSessionConfig'];
  sessionHeaderPreviewModalOpen: WizardModalsProps['sessionHeaderPreviewModalOpen'];
  sessionHeaderPreviewSrc: WizardModalsProps['sessionHeaderPreviewSrc'];
  sessionMetadataHeaderAccessory: MetadataEditorProps['headerAccessory'];
  sessionModeProfileControl?: React.ReactNode;
  sessionModeProfilePrivacyControl?: React.ReactNode;
  sessionModeProfileWorkerControl?: WorkerPanelProps['sessionModeProfileWorkerControl'];
  sessionModeProfilePublishControl?: PublishSectionProps['sessionModeProfilePublishControl'];
  sessionModeProfileStepComplete?: boolean;
  sessionUrl: PublishSectionProps['sessionUrl'];
  setBundleFile: WorkerPanelProps['setBundleFile'];
  setBundleMode: WorkerPanelProps['setBundleMode'];
  setDeployForm: WorkerPanelProps['setDeployForm'];
  setDeployHelperUrl: WorkerPanelProps['setDeployHelperUrl'];
  setNormalModeBundleUrlOverride: WorkerPanelProps['setNormalModeBundleUrlOverride'];
  setWorkerAllowOrigins: WorkerPanelProps['setWorkerAllowOrigins'];
  setWorkerMode: WorkerPanelProps['onWorkerModeChange'];
  setWorkerSecretsEnabled: WorkerPanelProps['setWorkerSecretsEnabled'];
  setWorkerUrlAutoFilled: WorkerPanelProps['setWorkerUrlAutoFilled'];
  shouldShowDeployHelperUrlInput: WorkerPanelProps['shouldShowDeployHelperUrlInput'];
  shouldUseSponsoredAutoDeployFlow: WorkerPanelProps['shouldUseSponsoredAutoDeployFlow'];
  showJsonPreview: MetadataEditorProps['showJsonPreview'];
  showNewSessionRequirementsBanner: IntroStatusRailProps['showNewSessionRequirementsBanner'];
  showNormalModeManualBundleControls: WorkerPanelProps['showNormalModeManualBundleControls'];
  showNormalModeWorkerStep: boolean;
  showSharedWorkerChoice: WorkerPanelProps['showSharedWorkerChoice'];
  showSponsoredBundleFallbackInput: PublishSectionProps['showSponsoredBundleFallbackInput'];
  showSponsoredDeployAccessNotice: WorkerPanelProps['showSponsoredDeployAccessNotice'];
  showWorkerUrlField: WorkerPanelProps['showWorkerUrlField'];
  showNetworkSelector?: boolean;
  showOnChainGateControls?: boolean;
  sponsoredBundleKey?: IntroStatusRailProps['sponsoredBundleKey'];
  sponsoredBundleStatus: IntroStatusRailProps['sponsoredBundleStatus'];
  sponsoredManualBundleRetryMessage: PublishSectionProps['sponsoredManualBundleRetryMessage'];
  sponsoredPublishBundleFileInputRef: PublishSectionProps['bundleFileInputRef'];
  status: PublishSectionProps['status'];
  signBootstrapAdminAction: WizardModalsProps['signBootstrapAdminAction'];
  t: WizardModalsProps['t'];
  toggleLoginModal: WizardModalsProps['toggleLoginModal'];
  toggleSection: (section: SessionWizardShellSectionKey) => void;
  updateDraftValue: (path: string[], value: unknown) => void;
  updateEncryptionGate: EncryptionPanelBoundaryProps['updateEncryptionGate'];
  visibleWorkerResourceKeys: NonNullable<WorkerPanelProps['workerResourceKeys']>;
  workerAllowOrigins: WorkerPanelProps['workerAllowOrigins'];
  workerMode: WorkerPanelProps['workerMode'];
  workerSecretsEnabled: WorkerPanelProps['workerSecretsEnabled'];
  workerUrlAutoFilled: WorkerPanelProps['workerUrlAutoFilled'];
  workerUrlSource: PublishSectionProps['workerUrlSource'];
  wizardDisplaySettingsOpen: HeaderProps['wizardDisplaySettingsOpen'];
  wizardMode: string;
};

const SessionWizardShell = ({
  account,
  allowNativeWorkerVerification,
  activeCreateSbtTargetGate,
  activeCreateSbtTargetGateId,
  activeNormalModeIndex,
  addEncryptionGate,
  adminUrl,
  adminUrlStatus,
  advancedBundleFileInputRef,
  bundleFile,
  bundleMode,
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
  deployStatusDisplayState,
  deployVerifiedInUi,
  deployWorkerUrl,
  displayedWorkerUrl,
  draft,
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
  verifyNativeWorker,
  handleSavePendingSbtDraft,
  hasSponsoredBundleLink,
  isNormalMode,
  isWorkerCanonical = false,
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
  newSessionRequiredAiProviderKeyLabels,
  newSessionRequiredRequirementIds,
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
  onCreateAnotherSession,
  onDismissNewSessionRequirementsBanner,
  onEnterAdvancedMode,
  onEnterNormalMode,
  onManualGasLimitChange,
  onManualGasPriceGweiChange,
  onManualMaxFeePerGasGweiChange,
  onManualMaxPriorityFeePerGasGweiChange,
  onManualMetadataUrlChange,
  onNormalModeBundleUrlOverrideChange,
  onNativeWorkerVerified,
  onPublish,
  onRegistryChainIdChange,
  onRetrySponsoredBundle,
  onSponsoredBundleKeyChange,
  onSubmitSponsoredBundleKey,
  onToggleDisplaySettings,
  onToggleJsonPreview,
  onToggleMoreOptions,
  onTogglePublishAdvanced,
  pendingSbtDrafts,
  pendingWorkerGroupDrafts,
  onAddPendingWorkerGroupDraft,
  onRemovePendingWorkerGroupDraft,
  onUpdatePendingWorkerGroupDraft,
  pendingSbtSelectorOptions,
  primaryDraftEntries,
  provider,
  publishUiPlan,
  publishSettingsCapabilities,
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
  sessionModeProfileControl = null,
  sessionModeProfilePrivacyControl = null,
  sessionModeProfileWorkerControl = null,
  sessionModeProfilePublishControl = null,
  sessionModeProfileStepComplete = true,
  sessionUrl,
  setBundleFile,
  setBundleMode,
  setDeployForm,
  setDeployHelperUrl,
  setNormalModeBundleUrlOverride,
  setWorkerAllowOrigins,
  setWorkerMode,
  setWorkerSecretsEnabled,
  setWorkerUrlAutoFilled,
  shouldShowDeployHelperUrlInput,
  shouldUseSponsoredAutoDeployFlow,
  showJsonPreview,
  showNewSessionRequirementsBanner,
  showNormalModeManualBundleControls,
  showNormalModeWorkerStep,
  showSharedWorkerChoice,
  showSponsoredBundleFallbackInput,
  showSponsoredDeployAccessNotice,
  showWorkerUrlField,
  showNetworkSelector = true,
  showOnChainGateControls = true,
  sponsoredBundleKey,
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
  visibleWorkerResourceKeys,
  workerAllowOrigins,
  workerMode,
  workerSecretsEnabled,
  workerUrlAutoFilled,
  workerUrlSource,
  wizardDisplaySettingsOpen,
  wizardMode,
}: SessionWizardShellProps) => {
  const showSessionModeProfileGate = !!sessionModeProfileControl && !sessionModeProfileStepComplete;
  const sessionModeProfileLabel = (() => {
    switch (draft.sessionModeProfile?.preset) {
      case SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE:
        return 'Centralized';
      case SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED:
        return 'Decentralized';
      case SESSION_MODE_PRESET_IDS.CUSTOM:
        return 'Custom';
      default:
        return '';
    }
  })();

  const header = (
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
      sessionModeProfileControl={sessionModeProfileControl}
      sessionModeProfileLabel={sessionModeProfileLabel}
      sessionModeProfileSelectionStep={showSessionModeProfileGate}
      wizardDisplaySettingsOpen={wizardDisplaySettingsOpen}
      wizardMode={wizardMode}
      showNetworkSelector={showNetworkSelector}
    />
  );

  if (showSessionModeProfileGate) {
    return <div className={styles.groupWizard}>{header}</div>;
  }

  return (
    <div className={styles.groupWizard}>
      {header}

      <SessionWizardIntroStatusRail
        activeNormalModeIndex={activeNormalModeIndex}
        cloudflareTokenSlug={draft.slug}
        collapsedSections={collapsedSections}
        fundingRequirementHref={newSessionFundingRequirementHref}
        fundingRequirementLabel={newSessionFundingRequirementLabel}
        isNormalMode={isNormalMode}
        newSessionRequiresLitCredential={newSessionRequiresLitCredential}
        normalModeCards={normalModeCards}
        onDismissRequirements={onDismissNewSessionRequirementsBanner}
        onFocusNormalModeSection={focusNormalModeSection}
        onRetrySponsoredBundle={onRetrySponsoredBundle}
        onSponsoredBundleKeyChange={onSponsoredBundleKeyChange}
        onSubmitSponsoredBundleKey={onSubmitSponsoredBundleKey}
        requiredAiProviderKeyLabels={newSessionRequiredAiProviderKeyLabels}
        requiredRequirementIds={newSessionRequiredRequirementIds}
        showNewSessionRequirementsBanner={showNewSessionRequirementsBanner}
        showNormalModeRail
        sponsoredBundleKey={sponsoredBundleKey}
        sponsoredBundleStatus={sponsoredBundleStatus}
      />

      <>
        {!isNormalMode ? sessionModeProfilePrivacyControl : null}

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
            pendingWorkerGroupDrafts={pendingWorkerGroupDrafts}
            onAddPendingWorkerGroupDraft={onAddPendingWorkerGroupDraft}
            onRemovePendingWorkerGroupDraft={onRemovePendingWorkerGroupDraft}
            onUpdatePendingWorkerGroupDraft={onUpdatePendingWorkerGroupDraft}
            removePendingSbtDraft={removePendingSbtDraft}
            isWorkerCanonical={isWorkerCanonical}
            showOnChainGateControls={showOnChainGateControls}
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
            allowNativeWorkerVerification={allowNativeWorkerVerification}
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
            deployVerifiedInUi={deployVerifiedInUi}
            workerSecretsEnabled={workerSecretsEnabled}
            setWorkerSecretsEnabled={setWorkerSecretsEnabled}
            clearWorkerSecretFields={clearWorkerSecretFields}
            workerResourceKeys={visibleWorkerResourceKeys}
            renderResourceCard={renderResourceCard}
            workerAllowOrigins={workerAllowOrigins}
            setWorkerAllowOrigins={setWorkerAllowOrigins}
            defaultAllowedOrigins={defaultAllowedOrigins}
            shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
            deployForm={deployForm}
            deployHelperToggle={
              <WorkerDeployHelperToggle
                checked={embeddedDeployHelperEnabled}
                onChange={(nextValue) => updateDraftValue(['embeddedDeployHelperEnabled'], nextValue)}
                renderInfoTooltip={renderSessionWizardInfoTooltip}
              />
            }
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
            toggleLoginModal={toggleLoginModal}
            resolvedActiveSessionSlug={resolvedActiveSessionSlug}
            setDeployForm={setDeployForm}
            handleDeployWorker={handleDeployWorker}
            deployStatusDisplayState={deployStatusDisplayState}
            showWorkerUrlField={showWorkerUrlField}
            displayedWorkerUrl={displayedWorkerUrl}
            renderField={renderField}
            workerUrlAutoFilled={workerUrlAutoFilled}
            sessionModeProfileWorkerControl={isNormalMode ? null : sessionModeProfileWorkerControl}
            onNativeWorkerVerified={onNativeWorkerVerified}
            verifyNativeWorker={verifyNativeWorker}
          />
        )}

        <SessionWizardPublishSection
          isCollapsed={collapsedSections.publish}
          isNormalMode={isNormalMode}
          onToggleCollapsed={() => toggleSection('publish')}
          normalModePublishSummary={normalModePublishSummary}
          onCreateAnotherSession={onCreateAnotherSession}
          onPublish={onPublish}
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
          publishUiPlan={publishUiPlan}
          publishSettingsCapabilities={publishSettingsCapabilities}
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
          sessionModeProfilePublishControl={isNormalMode ? null : sessionModeProfilePublishControl}
        />

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
      </>
    </div>
  );
};

export default SessionWizardShell;
