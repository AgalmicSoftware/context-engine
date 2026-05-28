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

type SbtPageActionsSectionProps = {
  actionFeedbackState: SbtPageActionFeedbackState;
  burnButton: React.ReactNode;
  burnLabel: string;
  burnSuccessHref: string;
  burnSuccessText: React.ReactNode;
  burnedLowerLabel: string;
  copyErrorButtonStyle?: React.CSSProperties;
  errorCopyIconState: SbtPageCopyIconState;
  errorMessage: React.ReactNode;
  isOpen: boolean;
  mintButton: React.ReactNode;
  mintLabel: string;
  mintSuccessHref: string;
  mintSuccessText: React.ReactNode;
  mintedLowerLabel: string;
  onCopyError: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: React.MouseEventHandler<HTMLHeadingElement>;
  sbtLabel: string;
  sectionHeaderClassName: string;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
  transactionErrorHref: string;
  transactionErrorText: React.ReactNode;
};

const SbtPageActionsSection = ({
  actionFeedbackState,
  burnButton,
  burnLabel,
  burnSuccessHref,
  burnSuccessText,
  burnedLowerLabel,
  copyErrorButtonStyle,
  errorCopyIconState,
  errorMessage,
  isOpen,
  mintButton,
  mintLabel,
  mintSuccessHref,
  mintSuccessText,
  mintedLowerLabel,
  onCopyError,
  onToggle,
  sbtLabel,
  sectionHeaderClassName,
  shouldRenderClosedIcon,
  shouldRenderOpenIcon,
  transactionErrorHref,
  transactionErrorText,
}: SbtPageActionsSectionProps): React.ReactElement => (
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

export default SbtPageActionsSection;
