import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';
import styles from './CEConfirmDialog.module.scss';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

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
}) => {
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

CEConfirmDialog.propTypes = {
  isOpen: PropTypes.bool,
  title: PropTypes.node.isRequired,
  body: PropTypes.node.isRequired,
  confirmLabel: PropTypes.node,
  cancelLabel: PropTypes.node,
  danger: PropTypes.bool,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  testId: PropTypes.string,
};

export default CEConfirmDialog;
