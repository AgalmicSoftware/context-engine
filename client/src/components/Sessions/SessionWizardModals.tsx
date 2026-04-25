import React from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import CreateSBTGroup from '../SBTs/CreateSBTGroup';
import ContractViewer from '../ContractPage/ContractViewer';
import { WIZARD_CONTRACT_MODAL_TESTID } from '../ContractPage/contractMetadata.js';

type GateLike = {
  id?: string;
  label?: string;
  color?: string;
  mode?: string;
  sbts?: unknown[];
};

type ContractViewerModalState = {
  open?: boolean;
};

type CreateSbtModalState = {
  open?: boolean;
};

type SessionWizardModalsProps = {
  account?: string;
  provider?: unknown;
  createSbtModalState: CreateSbtModalState;
  closeCreateSbtModal: () => void;
  createSbtModalNetwork: unknown;
  toggleLoginModal?: (() => void) | null;
  createSbtModalSessionSlug: string;
  draft: Record<string, any>;
  createSbtModalChainId: number | null;
  createSbtModalArweaveJwkOverride: string;
  encryptionGates: GateLike[];
  normalizeSbtSelection: (value: unknown[]) => Array<{ address?: string }>;
  defaultGateId: string;
  signBootstrapAdminAction: (...args: any[]) => unknown;
  handleSavePendingSbtDraft: (...args: any[]) => unknown;
  contractViewerModalState: ContractViewerModalState;
  selectedWizardContract: any;
  closeContractViewerModal: () => void;
  selectedWizardContractHref: string;
  sessionHeaderPreviewModalOpen: boolean;
  onCloseSessionHeaderPreviewModal: () => void;
  sessionHeaderPreviewSrc: string;
  t: (value: string) => string;
};

const SessionWizardModals = ({
  account,
  provider,
  createSbtModalState,
  closeCreateSbtModal,
  createSbtModalNetwork,
  toggleLoginModal,
  createSbtModalSessionSlug,
  draft,
  createSbtModalChainId,
  createSbtModalArweaveJwkOverride,
  encryptionGates,
  normalizeSbtSelection,
  defaultGateId,
  signBootstrapAdminAction,
  handleSavePendingSbtDraft,
  contractViewerModalState,
  selectedWizardContract,
  closeContractViewerModal,
  selectedWizardContractHref,
  sessionHeaderPreviewModalOpen,
  onCloseSessionHeaderPreviewModal,
  sessionHeaderPreviewSrc,
  t,
}: SessionWizardModalsProps) => (
  <>
    <Modal
      isOpen={createSbtModalState.open}
      toggle={closeCreateSbtModal}
      className={styles.createSbtModal}
      size="xl"
      scrollable
    >
      <ModalHeader toggle={closeCreateSbtModal} className={styles.createSbtModalHeader}>
        {`Add ${t('sbt')} to Session`}
      </ModalHeader>
      <ModalBody className={styles.createSbtModalBody}>
        <CreateSBTGroup
          account={account}
          provider={provider}
          network={createSbtModalNetwork}
          loginComplete={!!account}
          toggleLoginModal={toggleLoginModal}
          sessionSlug={createSbtModalSessionSlug}
          sessionConfigOverride={{
            ...(draft && typeof draft === 'object' ? draft : {}),
            slug: createSbtModalSessionSlug,
            networkChainId: createSbtModalChainId,
            contracts: (draft && typeof draft.contracts === 'object') ? draft.contracts : {},
          }}
          arweaveJwkOverride={createSbtModalArweaveJwkOverride}
          encryptionGates={encryptionGates.map((gate) => ({
            id: gate.id,
            gateId: gate.id,
            label: gate.label,
            name: gate.label,
            color: gate.color,
            mode: gate.mode,
            requireAll: gate.mode === 'all',
            sbtAddresses: normalizeSbtSelection(gate.sbts || []).map((entry) => entry.address),
            chainId: createSbtModalChainId,
          }))}
          defaultGateId={defaultGateId || encryptionGates[0]?.id || ''}
          defaultSbtTags={draft?.defaultSbtTags || ''}
          deferredDeploy={true}
          attemptImmediateDeferredUpload={false}
          hideNetworkSelector={true}
          signAdminAction={signBootstrapAdminAction}
          onSaveDraft={handleSavePendingSbtDraft}
        />
      </ModalBody>
    </Modal>

    <Modal
      isOpen={contractViewerModalState.open && !!selectedWizardContract}
      toggle={closeContractViewerModal}
      className={styles.contractViewerModal}
      contentClassName={styles.contractViewerModalContent}
      centered
    >
      <ModalBody
        className={styles.contractViewerModalBody}
        data-testid={WIZARD_CONTRACT_MODAL_TESTID}
      >
        {selectedWizardContract ? (
          <ContractViewer
            variant="compact"
            contracts={[selectedWizardContract]}
            onClose={closeContractViewerModal}
            renderSourceHeaderActions={(contract) => (
              <a
                href={selectedWizardContractHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.contractViewerFullPageLink}
                aria-label={`Open full Contracts page for ${contract.name}`}
                title={`Open full Contracts page for ${contract.name}`}
                data-testid="ce-wizard-contract-modal-full-link"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                <span>Full page</span>
              </a>
            )}
          />
        ) : null}
      </ModalBody>
    </Modal>

    <Modal
      isOpen={sessionHeaderPreviewModalOpen}
      toggle={onCloseSessionHeaderPreviewModal}
      centered
      size="xl"
      contentClassName={styles.sessionHeaderPreviewModalContent}
    >
      <ModalBody
        className={styles.sessionHeaderPreviewModalBody}
        onClick={onCloseSessionHeaderPreviewModal}
      >
        {sessionHeaderPreviewSrc ? (
          <img src={sessionHeaderPreviewSrc} alt="Expanded session header preview" />
        ) : null}
      </ModalBody>
    </Modal>
  </>
);

export default SessionWizardModals;
