import React from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import ContractViewer, { type ContractViewerContract } from '../DocsPage/ContractViewer';
import { WIZARD_CONTRACT_MODAL_TESTID } from '../DocsPage/contractMetadata.js';

type ContractViewerModalState = {
  open?: boolean;
};

export type SessionWizardContractViewerModalProps = {
  contractViewerModalState: ContractViewerModalState;
  selectedWizardContract: ContractViewerContract | null;
  closeContractViewerModal: () => void;
  selectedWizardContractHref: string;
};

const SessionWizardContractViewerModal = ({
  contractViewerModalState,
  selectedWizardContract,
  closeContractViewerModal,
  selectedWizardContractHref,
}: SessionWizardContractViewerModalProps) => (
  <Modal
    isOpen={contractViewerModalState.open && !!selectedWizardContract}
    toggle={closeContractViewerModal}
    className={styles.contractViewerModal}
    contentClassName={styles.contractViewerModalContent}
    centered
  >
    <ModalBody className={styles.contractViewerModalBody} data-testid={WIZARD_CONTRACT_MODAL_TESTID}>
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
);

export default SessionWizardContractViewerModal;
