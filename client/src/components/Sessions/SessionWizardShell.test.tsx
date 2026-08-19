import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionWizardShell, { type SessionWizardShellProps } from './SessionWizardShell';

jest.mock('./SessionWizardHeader', () => (props: any) => (
  <div
    data-testid="shell-header"
    data-mode={props.wizardMode}
    data-profile-label={props.sessionModeProfileLabel || ''}
    data-profile-selection-step={String(!!props.sessionModeProfileSelectionStep)}
  >
    {props.sessionModeProfileControl}
    <button type="button" onClick={props.onEnterAdvancedMode}>
      advanced
    </button>
    <button type="button" onClick={props.onEnterNormalMode}>
      normal
    </button>
    <button type="button" onClick={props.onToggleDisplaySettings}>
      display
    </button>
    <button type="button" onClick={props.onCloseDisplaySettings}>
      close display
    </button>
    <button type="button" onClick={() => props.onRegistryChainIdChange('11155420')}>
      chain
    </button>
  </div>
));

jest.mock('./SessionWizardRequirementsBanner', () => (props: any) => (
  <div
    data-testid="shell-requirements"
    data-funding-href={props.fundingRequirementHref || ''}
    data-requirement-ids={(props.requiredRequirementIds || []).join(',')}
  >
    <span>{props.fundingRequirementLabel}</span>
    <button type="button" onClick={props.onDismiss}>
      dismiss requirements
    </button>
  </div>
));

jest.mock('./SessionWizardSponsoredStatus', () => (props: any) => (
  <div data-testid="shell-sponsored-status" data-tone={props.status?.tone || ''}>
    <span>{props.status?.message || ''}</span>
    <button type="button" onClick={props.onRetry}>
      retry sponsored bundle
    </button>
  </div>
));

jest.mock('./SessionWizardNormalModeRail', () => (props: any) => (
  <div data-testid="shell-normal-rail" data-active-index={props.activeNormalModeIndex}>
    <button type="button" onClick={() => props.onFocusSection('worker')}>
      focus worker
    </button>
  </div>
));

jest.mock('./EncryptionPanel', () => (props: any) => (
  <section data-testid="shell-encryption" data-collapsed={String(props.isCollapsed)}>
    <button type="button" onClick={props.onToggleCollapsed}>
      toggle encryption
    </button>
    <button type="button" onClick={() => props.launchCreateSbtModal('gate-1')}>
      create sbt
    </button>
  </section>
));

jest.mock('./SessionMetadataEditor', () => (props: any) => (
  <section data-testid="shell-metadata" data-collapsed={String(props.isCollapsed)}>
    {props.headerAccessory}
    <button type="button" onClick={props.onToggleCollapsed}>
      toggle metadata
    </button>
    <button type="button" onClick={props.onToggleMoreOptions}>
      more metadata
    </button>
    <button type="button" onClick={props.onToggleJsonPreview}>
      json preview
    </button>
    <button type="button" onClick={props.onCopyDraftJson}>
      copy draft
    </button>
  </section>
));

jest.mock('./WorkerPanel', () => (props: any) => (
  <section data-testid="shell-worker" data-worker-url={props.displayedWorkerUrl || ''}>
    {props.sessionModeProfileWorkerControl}
    {props.deployHelperToggle}
    <button type="button" onClick={props.onToggleCollapsed}>
      toggle worker
    </button>
    <button
      type="button"
      onClick={props.handleDeployWorker}
      disabled={!!props.deployStatusDisplayState?.deployButtonDisabled}
    >
      deploy worker
    </button>
  </section>
));

jest.mock('./SessionPublishSummary', () => (props: any) => (
  <section
    data-testid="shell-publish"
    data-metadata-label={props.publishUiPlan?.publishMetadataDisplayState?.metadataUriLabel || ''}
    data-metadata-uri={props.publishUiPlan?.publishMetadataDisplayState?.metadataUri || ''}
    data-publish-advanced-open={String(props.publishUiPlan?.publishActionDisplayState?.publishAdvancedOpen || false)}
    data-worker-source={props.workerUrlSource || ''}
  >
    {props.sessionModeProfilePublishControl}
    <button type="button" onClick={props.onToggleCollapsed}>
      toggle publish
    </button>
    <button type="button" onClick={props.onTogglePublishAdvanced}>
      publish advanced
    </button>
    <button
      type="button"
      data-testid="ce-wizard-publish"
      onClick={props.onPublish}
      disabled={!!props.publishUiPlan?.publishActionDisplayState?.publishButtonDisabled}
    >
      publish
    </button>
    <button type="button" onClick={props.onCopyAdminUrl}>
      copy admin
    </button>
  </section>
));

jest.mock('./SessionWizardModals', () => (props: any) => (
  <div data-testid="shell-modals" data-session-slug={props.createSbtModalSessionSlug || ''}>
    <button type="button" onClick={props.closeCreateSbtModal}>
      close create sbt
    </button>
    <button type="button" onClick={props.closeContractViewerModal}>
      close contract
    </button>
    <button type="button" onClick={props.onCloseSessionHeaderPreviewModal}>
      close preview
    </button>
  </div>
));

const baseProps = (): SessionWizardShellProps => ({
  account: '0x00000000000000000000000000000000000000aa',
  activeCreateSbtTargetGate: null,
  activeCreateSbtTargetGateId: '',
  activeNormalModeIndex: 1,
  addEncryptionGate: jest.fn(),
  adminUrl: '/admin/session',
  adminUrlStatus: 'copied',
  advancedBundleFileInputRef: React.createRef<HTMLInputElement>(),
  bundleFile: null,
  bundleMode: 'url',
  clearSelectedBundleFile: jest.fn(),
  clearWorkerSecretFields: jest.fn(),
  closeContractViewerModal: jest.fn(),
  closeCreateSbtModal: jest.fn(),
  collapsedSections: {
    encryption: false,
    metadata: false,
    publish: false,
    worker: false,
  },
  contractViewerModalState: {},
  createSbtModalArweaveJwkOverride: '',
  createSbtModalChainId: 11155420,
  createSbtModalNetwork: { id: 11155420, name: 'OP Sepolia' },
  createSbtModalSessionSlug: 'demo-session',
  createSbtModalState: {},
  defaultAllowedOrigins: 'https://example.test',
  defaultGateId: 'gate-1',
  deployComplete: false,
  deployForm: {},
  deployHelperUrl: 'https://deploy.example.test',
  deployStatusDisplayState: {
    deployButtonDisabled: false,
    deployStatusText: '',
    isError: false,
  },
  deployWorkerUrl: '',
  displayedWorkerUrl: 'https://worker.example.test',
  draft: { sessionModeProfile: { preset: 'fast_cheap_cloudflare' } },
  embeddedDeployHelperEnabled: true,
  encryptionGates: [],
  ensureLightSbtUniverse: jest.fn(),
  focusCreateSbtTargetGate: jest.fn(),
  focusNormalModeSection: jest.fn(),
  getSessionWizardDefaultWorkerUrl: jest.fn(() => 'https://default-worker.example.test'),
  handleCopyAdminUrl: jest.fn(),
  handleDeployWorker: jest.fn(),
  handleGateAddSbt: jest.fn(),
  handleGateRemoveSbt: jest.fn(),
  handleSavePendingSbtDraft: jest.fn(),
  hasSponsoredBundleLink: false,
  isNormalMode: true,
  jsonCopied: false,
  launchCreateSbtModal: jest.fn(),
  localWorkerBundleFallbackFilePath: 'dist/sessionCorsWorker.bundle.js',
  manualBundleUrlOverrideHelp: 'manual help',
  manualGasLimit: '',
  manualGasPriceGwei: '',
  manualMaxFeePerGasGwei: '',
  manualMaxPriorityFeePerGasGwei: '',
  manualMetadataUrl: '',
  moreOptionsEntries: [],
  moreOptionsOpen: false,
  network: { id: 11155420 },
  newSessionFundingRequirementHref: 'https://faucet.example.test',
  newSessionFundingRequirementLabel: 'OP Sepolia ETH',
  newSessionRequiresLitCredential: true,
  newSessionRequiredRequirementIds: ['cloudflareApiToken', 'aiProviderKey'],
  normalModeBundleHelpText: 'bundle help',
  normalModeBundleUrl: 'https://bundle.example.test',
  normalModeBundleUrlOverride: '',
  normalModeBundleUrlOverrideValidationError: '',
  normalModeCards: [{ key: 'worker', title: 'Worker' }],
  normalModeManualBundleHelpText: 'manual bundle help',
  normalModePublishSummary: [{ label: 'Worker', value: 'Ready' }],
  normalModeRetryBundleFileInputRef: React.createRef<HTMLInputElement>(),
  onCloseDisplaySettings: jest.fn(),
  onCloseSessionHeaderPreviewModal: jest.fn(),
  onCopyDraftJson: jest.fn(),
  onDismissNewSessionRequirementsBanner: jest.fn(),
  onEnterAdvancedMode: jest.fn(),
  onEnterNormalMode: jest.fn(),
  onManualGasLimitChange: jest.fn(),
  onManualGasPriceGweiChange: jest.fn(),
  onManualMaxFeePerGasGweiChange: jest.fn(),
  onManualMaxPriorityFeePerGasGweiChange: jest.fn(),
  onManualMetadataUrlChange: jest.fn(),
  onNormalModeBundleUrlOverrideChange: jest.fn(),
  onPublish: jest.fn(),
  onRegistryChainIdChange: jest.fn(),
  onRetrySponsoredBundle: jest.fn(),
  onToggleDisplaySettings: jest.fn(),
  onToggleJsonPreview: jest.fn(),
  onToggleMoreOptions: jest.fn(),
  onTogglePublishAdvanced: jest.fn(),
  pendingSbtDrafts: [],
  pendingSbtSelectorOptions: [],
  primaryDraftEntries: [],
  provider: null,
  publishUiPlan: {
    publishActionDisplayState: {
      canPublishNow: true,
      displayMode: 'advanced',
      publishAdvancedOpen: false,
      publishBusy: false,
      publishButtonDisabled: false,
      publishButtonLabel: 'Publish',
      settingsButtonActive: false,
    },
    publishExecutionPlan: {
      shouldAutoDeployWorker: false,
      shouldDeployPendingSbts: false,
      shouldRegisterSession: true,
      shouldUploadMetadata: false,
      stepNumbers: {},
      steps: [],
    },
    publishMetadataDisplayState: {
      effectiveMetadataGatewayUrl: '',
      effectiveMetadataTxId: '',
      manualMetadataDisplayUri: '',
      metadataUri: 'ar://metadata-tx',
      metadataUriLabel: 'Metadata URI',
      showArweaveTx: false,
      showManualMetadataUri: false,
      showMetadataUri: true,
    },
    publishProgressDisplayState: {
      activePublishProgressStepLabel: '',
      publishProgressPercent: 0,
      publishProgressPercentRounded: 0,
      publishProgressSteps: [],
      showPublishProgress: false,
    },
    publishReadiness: {
      canPublishNow: true,
      canUploadMetadataNow: true,
      hasManualMetadata: false,
      hasUploadedMetadata: false,
      readinessKind: 'worker-upload',
      showUploadBlockedReason: false,
      uploadBlockedReason: '',
    },
  },
  publishSettingsCapabilities: {
    showArweaveMetadataControls: true,
    showGasOverrideControls: true,
  },
  publishedPendingSbtLinks: [],
  registerExplorerBaseUrl: '',
  registerTxs: [],
  registryAddress: '0xRegistry',
  registryChainId: 11155420,
  registryChainName: 'OP Sepolia',
  registryChainOptions: [],
  removeEncryptionGate: jest.fn(),
  removePendingSbtDraft: jest.fn(),
  renderField: jest.fn(() => null),
  renderResourceCard: jest.fn(() => <div data-testid="shell-resource-card" />),
  renderSessionWizardInfoTooltip: jest.fn(() => null),
  resolvedActiveSessionSlug: 'demo-session',
  resolvedWorkerBaseUrl: 'https://worker.example.test',
  sbtCacheRevision: 1,
  selectedWizardContract: null,
  selectedWizardContractHref: '',
  selectorSourceChainId: 11155420,
  selectorSourceSessionConfig: null,
  sessionHeaderPreviewModalOpen: false,
  sessionHeaderPreviewSrc: '',
  sessionMetadataHeaderAccessory: <span data-testid="shell-session-id">session-id</span>,
  sessionModeProfileControl: <section data-testid="shell-mode-profile">mode profile</section>,
  sessionModeProfilePrivacyControl: <section data-testid="shell-mode-profile-privacy">profile privacy</section>,
  sessionModeProfileWorkerControl: <section data-testid="shell-mode-profile-worker">profile worker</section>,
  sessionModeProfilePublishControl: <section data-testid="shell-mode-profile-publish">profile publish</section>,
  sessionModeProfileStepComplete: true,
  sessionUrl: '/session/demo-session',
  setBundleFile: jest.fn(),
  setBundleMode: jest.fn(),
  setDeployForm: jest.fn(),
  setDeployHelperUrl: jest.fn(),
  setNormalModeBundleUrlOverride: jest.fn(),
  setWorkerAllowOrigins: jest.fn(),
  setWorkerMode: jest.fn(),
  setWorkerSecretsEnabled: jest.fn(),
  setWorkerUrlAutoFilled: jest.fn(),
  shouldShowDeployHelperUrlInput: false,
  shouldUseSponsoredAutoDeployFlow: false,
  showJsonPreview: false,
  showNewSessionRequirementsBanner: true,
  showNormalModeManualBundleControls: false,
  showNormalModeWorkerStep: true,
  showSharedWorkerChoice: false,
  showSponsoredBundleFallbackInput: false,
  showSponsoredDeployAccessNotice: false,
  signBootstrapAdminAction: jest.fn(),
  sponsoredBundleStatus: {
    message: 'Sponsored bundle loaded.',
    retryable: true,
    tone: 'success',
  },
  sponsoredManualBundleRetryMessage: 'retry message',
  sponsoredPublishBundleFileInputRef: React.createRef<HTMLInputElement>(),
  status: 'Ready',
  t: (key: string) => key,
  toggleLoginModal: jest.fn(),
  toggleSection: jest.fn(),
  updateDraftValue: jest.fn(),
  updateEncryptionGate: jest.fn(),
  visibleWorkerResourceKeys: [],
  workerAllowOrigins: '',
  workerMode: 'custom',
  workerSecretsEnabled: false,
  workerUrlAutoFilled: false,
  workerUrlSource: 'custom worker URL',
  wizardDisplaySettingsOpen: false,
  wizardMode: 'normal',
  normalizeSbtSelection: jest.fn(() => []),
});

describe('SessionWizardShell', () => {
  it('renders moved sections in order and preserves handler wiring', () => {
    const props = baseProps();

    render(<SessionWizardShell {...props} />);

    const header = screen.getByTestId('shell-header');
    const requirements = screen.getByTestId('shell-requirements');
    const sponsoredStatus = screen.getByTestId('shell-sponsored-status');
    const rail = screen.getByTestId('shell-normal-rail');
    const encryption = screen.getByTestId('shell-encryption');
    const metadata = screen.getByTestId('shell-metadata');
    const worker = screen.getByTestId('shell-worker');
    const publish = screen.getByTestId('shell-publish');
    const modals = screen.getByTestId('shell-modals');

    const modeProfile = screen.getByTestId('shell-mode-profile');
    expect(header).toContainElement(modeProfile);
    expect(header).toHaveAttribute('data-profile-label', 'Centralized');
    expect(header.compareDocumentPosition(requirements) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(requirements.compareDocumentPosition(sponsoredStatus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sponsoredStatus.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rail.compareDocumentPosition(encryption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(encryption.compareDocumentPosition(metadata) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(metadata.compareDocumentPosition(worker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(worker.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publish.compareDocumentPosition(modals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(requirements).toHaveTextContent('OP Sepolia ETH');
    expect(requirements).toHaveAttribute('data-requirement-ids', 'cloudflareApiToken,aiProviderKey');
    expect(worker).toHaveAttribute('data-worker-url', 'https://worker.example.test');
    expect(publish).toHaveAttribute('data-worker-source', 'custom worker URL');
    expect(publish).toHaveAttribute('data-metadata-label', 'Metadata URI');
    expect(publish).toHaveAttribute('data-metadata-uri', 'ar://metadata-tx');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).not.toBeDisabled();

    fireEvent.click(screen.getByText('advanced'));
    fireEvent.click(screen.getByText('normal'));
    fireEvent.click(screen.getByText('display'));
    fireEvent.click(screen.getByText('close display'));
    fireEvent.click(screen.getByText('chain'));
    fireEvent.click(screen.getByText('dismiss requirements'));
    fireEvent.click(screen.getByText('retry sponsored bundle'));
    fireEvent.click(screen.getByText('focus worker'));
    fireEvent.click(screen.getByText('toggle encryption'));
    fireEvent.click(screen.getByText('create sbt'));
    fireEvent.click(screen.getByText('toggle metadata'));
    fireEvent.click(screen.getByText('more metadata'));
    fireEvent.click(screen.getByText('json preview'));
    fireEvent.click(screen.getByText('copy draft'));
    fireEvent.click(screen.getByText('toggle worker'));
    fireEvent.click(screen.getByText('deploy worker'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED));
    fireEvent.click(screen.getByText('toggle publish'));
    fireEvent.click(screen.getByText('publish advanced'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));
    fireEvent.click(screen.getByText('copy admin'));
    fireEvent.click(screen.getByText('close create sbt'));
    fireEvent.click(screen.getByText('close contract'));
    fireEvent.click(screen.getByText('close preview'));

    expect(props.onEnterAdvancedMode).toHaveBeenCalledTimes(1);
    expect(props.onEnterNormalMode).toHaveBeenCalledTimes(1);
    expect(props.onToggleDisplaySettings).toHaveBeenCalledTimes(1);
    expect(props.onCloseDisplaySettings).toHaveBeenCalledTimes(1);
    expect(props.onRegistryChainIdChange).toHaveBeenCalledWith('11155420');
    expect(props.onDismissNewSessionRequirementsBanner).toHaveBeenCalledTimes(1);
    expect(props.onRetrySponsoredBundle).toHaveBeenCalledTimes(1);
    expect(props.focusNormalModeSection).toHaveBeenCalledWith('worker');
    expect(props.toggleSection).toHaveBeenCalledWith('encryption');
    expect(props.launchCreateSbtModal).toHaveBeenCalledWith('gate-1');
    expect(props.toggleSection).toHaveBeenCalledWith('metadata');
    expect(props.onToggleMoreOptions).toHaveBeenCalledTimes(1);
    expect(props.onToggleJsonPreview).toHaveBeenCalledTimes(1);
    expect(props.onCopyDraftJson).toHaveBeenCalledTimes(1);
    expect(props.toggleSection).toHaveBeenCalledWith('worker');
    expect(props.handleDeployWorker).toHaveBeenCalledTimes(1);
    expect(props.updateDraftValue).toHaveBeenCalledWith(['embeddedDeployHelperEnabled'], false);
    expect(props.toggleSection).toHaveBeenCalledWith('publish');
    expect(props.onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(props.onPublish).toHaveBeenCalledTimes(1);
    expect(props.handleCopyAdminUrl).toHaveBeenCalledTimes(1);
    expect(props.closeCreateSbtModal).toHaveBeenCalledTimes(1);
    expect(props.closeContractViewerModal).toHaveBeenCalledTimes(1);
    expect(props.onCloseSessionHeaderPreviewModal).toHaveBeenCalledTimes(1);
  });

  it('keeps the compact header visible while the profile gates setup sections', () => {
    const props = baseProps();
    props.sessionModeProfileStepComplete = false;

    render(<SessionWizardShell {...props} />);

    expect(screen.getByTestId('shell-mode-profile')).toBeInTheDocument();
    expect(screen.getByTestId('shell-header')).toHaveAttribute('data-profile-selection-step', 'true');
    expect(screen.queryByTestId('shell-requirements')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-sponsored-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-normal-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-encryption')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-metadata')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-worker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-publish')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-modals')).not.toBeInTheDocument();
  });

  it('places custom profile settings in the relevant flow sections and keeps privacy ahead of access rules', () => {
    const normalProps = baseProps();
    const { unmount } = render(<SessionWizardShell {...normalProps} />);

    expect(screen.queryByTestId('shell-mode-profile-privacy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-mode-profile-worker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-mode-profile-publish')).not.toBeInTheDocument();
    unmount();

    const advancedProps = baseProps();
    advancedProps.isNormalMode = false;
    advancedProps.wizardMode = 'advanced';
    render(<SessionWizardShell {...advancedProps} />);

    const privacySettings = screen.getByTestId('shell-mode-profile-privacy');
    const encryptionPanel = screen.getByTestId('shell-encryption');
    expect(encryptionPanel).not.toContainElement(privacySettings);
    expect(privacySettings.compareDocumentPosition(encryptionPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('shell-worker')).toContainElement(screen.getByTestId('shell-mode-profile-worker'));
    expect(screen.getByTestId('shell-publish')).toContainElement(screen.getByTestId('shell-mode-profile-publish'));
  });

  it('preserves section visibility and publish disabled state', () => {
    const props = baseProps();
    props.showNewSessionRequirementsBanner = false;
    props.publishUiPlan = {
      ...props.publishUiPlan,
      publishActionDisplayState: {
        ...props.publishUiPlan.publishActionDisplayState,
        canPublishNow: false,
        publishButtonDisabled: true,
      },
      publishReadiness: {
        ...props.publishUiPlan.publishReadiness,
        canPublishNow: false,
        readinessKind: 'blocked',
      },
    };
    props.collapsedSections = {
      encryption: true,
      metadata: true,
      publish: false,
      worker: true,
    };

    render(<SessionWizardShell {...props} />);

    expect(screen.queryByTestId('shell-requirements')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-normal-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('shell-encryption')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-metadata')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-worker')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-publish')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));
    expect(props.onPublish).not.toHaveBeenCalled();
  });
});
