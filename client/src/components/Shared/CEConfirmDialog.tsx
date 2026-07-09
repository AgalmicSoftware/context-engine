import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from 'reactstrap';
import styles from './CEConfirmDialog.module.scss';

type CEConfirmDialogProps = {
  isOpen?: boolean;
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  testId?: string;
};

const joinClasses = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const CEConfirmDialog = ({
  isOpen,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  testId = 'ce-confirm-dialog',
}: CEConfirmDialogProps) => {
  const handleCancel = () => {
    if (typeof onCancel === 'function') onCancel();
  };

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={handleCancel}
      centered
      className={styles.dialog}
      contentClassName={styles.content}
      data-testid={testId}
      labelledBy={`${testId}-title`}
    >
      <ModalHeader
        toggle={handleCancel}
        className={styles.header}
        id={`${testId}-title`}
        data-testid={`${testId}-title`}
      >
        {title}
      </ModalHeader>
      <ModalBody className={styles.body} data-testid={`${testId}-body`}>
        {body}
      </ModalBody>
      <ModalFooter className={styles.footer}>
        <Button
          type="button"
          color="secondary"
          outline
          className={styles.cancelButton}
          onClick={handleCancel}
          data-testid={`${testId}-cancel`}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          color={danger ? 'danger' : 'primary'}
          className={joinClasses(styles.confirmButton, danger && styles.dangerButton)}
          onClick={handleConfirm}
          data-testid={`${testId}-confirm`}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default CEConfirmDialog;
