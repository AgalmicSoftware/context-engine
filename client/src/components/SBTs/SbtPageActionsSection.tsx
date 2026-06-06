import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faChevronDown,
  faChevronUp,
  faCopy,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';

import { getShortenedTransactionHash } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';

type SbtPageActionFeedbackState = {
  showBurnSuccess?: boolean;
  showErrorTransactionHash?: boolean;
  showMintSuccess?: boolean;
  showTransactionError?: boolean;
};

type SbtPageCopyIconState = {
  shouldRenderCopiedIcon?: boolean;
  shouldRenderDefaultIcon?: boolean;
};

type SbtPageActionsToggleState = {
  isOpen?: boolean;
  shouldRenderClosedIcon?: boolean;
  shouldRenderOpenIcon?: boolean;
};

type SbtPageActionsTransactionState = {
  lastBurnTxHash?: unknown;
  lastMintTxHash?: unknown;
  transactionHash?: unknown;
};

type SbtPageActionsSectionProps = {
  actionFeedbackState: SbtPageActionFeedbackState;
  burnButton: React.ReactNode;
  burnLabel: string;
  burnedLowerLabel: string;
  copyErrorButtonStyle?: React.CSSProperties;
  errorCopyIconState: SbtPageCopyIconState;
  errorMessage: React.ReactNode;
  getExplorerLink: (hash: unknown) => string;
  mintButton: React.ReactNode;
  mintLabel: string;
  mintedLowerLabel: string;
  onCopyError: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: React.MouseEventHandler<HTMLHeadingElement>;
  sbtLabel: string;
  sectionHeaderClassName: string;
  toggleState?: SbtPageActionsToggleState;
  transactionState?: SbtPageActionsTransactionState;
};

const SbtPageActionsSection = ({
  actionFeedbackState,
  burnButton,
  burnLabel,
  burnedLowerLabel,
  copyErrorButtonStyle,
  errorCopyIconState,
  errorMessage,
  getExplorerLink,
  mintButton,
  mintLabel,
  mintedLowerLabel,
  onCopyError,
  onToggle,
  sbtLabel,
  sectionHeaderClassName,
  toggleState = {},
  transactionState = {},
}: SbtPageActionsSectionProps): React.ReactElement => {
  const {
    isOpen = false,
    shouldRenderClosedIcon = false,
    shouldRenderOpenIcon = false,
  } = toggleState;
  const {
    lastBurnTxHash = '',
    lastMintTxHash = '',
    transactionHash = '',
  } = transactionState;
  const burnSuccessHref = actionFeedbackState.showBurnSuccess ? getExplorerLink(lastBurnTxHash) : '';
  const burnSuccessText = actionFeedbackState.showBurnSuccess ? getShortenedTransactionHash(lastBurnTxHash) : '';
  const mintSuccessHref = actionFeedbackState.showMintSuccess ? getExplorerLink(lastMintTxHash) : '';
  const mintSuccessText = actionFeedbackState.showMintSuccess ? getShortenedTransactionHash(lastMintTxHash) : '';
  const transactionErrorHref = actionFeedbackState.showErrorTransactionHash ? getExplorerLink(transactionHash) : '';
  const transactionErrorText = actionFeedbackState.showErrorTransactionHash ? getShortenedTransactionHash(transactionHash) : '';

  return (
    <div className={styles.actionsSection}>
      <h2 className={sectionHeaderClassName} onClick={onToggle}>
        ACTIONS{' '}
        {shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
        {shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
      </h2>
      {isOpen && (
        <div className={styles.actions}>
          {mintButton}
          {burnButton}
          {actionFeedbackState.showMintSuccess && (
            <div className={styles.mintProcess}>
              <p className={styles.mintSuccess}>
                {`${sbtLabel} successfully ${mintedLowerLabel}!`}
                <br />
                {`${mintLabel} Tx Hash:`}{' '}
                <a
                  href={mintSuccessHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {mintSuccessText}
                </a>
              </p>
            </div>
          )}
          {actionFeedbackState.showBurnSuccess && (
            <div className={styles.mintProcess}>
              <p className={styles.mintSuccess}>
                {`${sbtLabel} successfully ${burnedLowerLabel}!`}
                <br />
                {`${burnLabel} Tx Hash:`}{' '}
                <a
                  href={burnSuccessHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {burnSuccessText}
                </a>
              </p>
            </div>
          )}
          {actionFeedbackState.showTransactionError && (
            <Alert color="danger" className={styles.txErrorAlert} fade={false}>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Transaction Failed: {errorMessage}
              <button
                onClick={onCopyError}
                aria-label="Copy error message"
                title="Copy error message"
                style={copyErrorButtonStyle}
              >
                {errorCopyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
                {errorCopyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
              </button>
              {actionFeedbackState.showErrorTransactionHash && (
                <>
                  <br />
                  Tx Hash:{' '}
                  <a href={transactionErrorHref} target="_blank" rel="noopener noreferrer">
                    {transactionErrorText}
                  </a>
                </>
              )}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

export default SbtPageActionsSection;
