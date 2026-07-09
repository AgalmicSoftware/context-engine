import React from 'react';
import { Modal, ModalBody } from 'reactstrap';

import styles from './SessionWizard.module.scss';

export type SessionHeaderPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  previewSrc: string;
};

const SessionHeaderPreviewModal = ({ isOpen, onClose, previewSrc }: SessionHeaderPreviewModalProps) => (
  <Modal isOpen={isOpen} toggle={onClose} centered size="xl" contentClassName={styles.sessionHeaderPreviewModalContent}>
    <ModalBody className={styles.sessionHeaderPreviewModalBody} onClick={onClose}>
      {previewSrc ? <img src={previewSrc} alt="Expanded session header preview" /> : null}
    </ModalBody>
  </Modal>
);

export default SessionHeaderPreviewModal;
