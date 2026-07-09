import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';

import styles from './SBTPage.module.scss';

export type SbtPageActionTransactionLinkDisplay = {
  href: string;
  text: React.ReactNode;
};

export type SbtPageActionSuccessFeedbackDisplay = {
  message: string;
  show?: boolean;
  txLabel: string;
  txLink: SbtPageActionTransactionLinkDisplay;
};

export type SbtPageActionErrorFeedbackDisplay = {
  errorMessage: React.ReactNode;
  show?: boolean;
  txLink?: SbtPageActionTransactionLinkDisplay | null;
};

type SbtPageCopyIconState = {
  shouldRenderCopiedIcon?: boolean;
  shouldRenderDefaultIcon?: boolean;
};

type SbtPageActionFeedbackDisplayProps = {
  burnSuccess: SbtPageActionSuccessFeedbackDisplay;
  copyErrorButtonStyle?: React.CSSProperties;
  errorCopyIconState: SbtPageCopyIconState;
  mintSuccess: SbtPageActionSuccessFeedbackDisplay;
  onCopyError: React.MouseEventHandler<HTMLButtonElement>;
  transactionError: SbtPageActionErrorFeedbackDisplay;
};

const SbtPageActionTransactionLink = ({ href, text }: SbtPageActionTransactionLinkDisplay): React.ReactElement => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);

const SbtPageActionSuccessFeedback = ({
  message,
  show = false,
  txLabel,
  txLink,
}: SbtPageActionSuccessFeedbackDisplay): React.ReactElement | null => {
  if (!show) return null;
  return (
    <div className={styles.mintProcess}>
      <p className={styles.mintSuccess}>
        {message}
        <br />
        {txLabel} <SbtPageActionTransactionLink {...txLink} />
      </p>
    </div>
  );
};

const SbtPageActionFeedbackDisplay = ({
  burnSuccess,
  copyErrorButtonStyle,
  errorCopyIconState,
  mintSuccess,
  onCopyError,
  transactionError,
}: SbtPageActionFeedbackDisplayProps): React.ReactElement => (
  <>
    <SbtPageActionSuccessFeedback {...mintSuccess} />
    <SbtPageActionSuccessFeedback {...burnSuccess} />
    {transactionError.show && (
      <Alert color="danger" className={styles.txErrorAlert} fade={false}>
        <FontAwesomeIcon icon={faExclamationTriangle} /> Transaction Failed: {transactionError.errorMessage}
        <button
          onClick={onCopyError}
          aria-label="Copy error message"
          title="Copy error message"
          style={copyErrorButtonStyle}
        >
          {errorCopyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
          {errorCopyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
        </button>
        {transactionError.txLink && (
          <>
            <br />
            Tx Hash: <SbtPageActionTransactionLink {...transactionError.txLink} />
          </>
        )}
      </Alert>
    )}
  </>
);

export default SbtPageActionFeedbackDisplay;
