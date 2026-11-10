/** @file GroupAgentModal.tsx: the Group Agent's placeholder, which says it is coming. */
import { useId } from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './GroupAgentModal.module.scss';

type Props = { onClose: () => void };

// Only admins see its launcher until the Group Agent itself ships.
export default function GroupAgentModal({ onClose }: Props) {
  const titleId = `ce-group-agent-${useId().replace(/:/g, '')}-title`;
  return (
    <Modal isOpen toggle={onClose} centered contentClassName={styles.content} labelledBy={titleId}>
      <ModalHeader toggle={onClose} className={styles.header}>
        <span id={titleId}>Group Agent</span>
      </ModalHeader>
      <ModalBody className={styles.body} data-testid="ce-group-agent">
        <p>Coming soon: ask questions about this session and get answers from its material.</p>
        <p>Only admins see this for now.</p>
      </ModalBody>
    </Modal>
  );
}
