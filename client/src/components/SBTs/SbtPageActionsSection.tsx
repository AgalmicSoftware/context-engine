import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';
import SbtPageActionFeedbackDisplay from './SbtPageActionFeedbackDisplay';
import { resolveSbtPageActionFeedbackDisplayDescriptor } from './sbtPageActionFeedbackDisplayState';

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
  const { isOpen = false, shouldRenderClosedIcon = false, shouldRenderOpenIcon = false } = toggleState;
  const feedbackDisplayDescriptor = resolveSbtPageActionFeedbackDisplayDescriptor({
    actionFeedbackState,
    errorMessage,
    getExplorerLink,
    labels: {
      burnLabel,
      burnedLowerLabel,
      mintLabel,
      mintedLowerLabel,
      sbtLabel,
    },
    transactionState,
  });

  return (
    <div className={styles.actionsSection}>
      <h2 className={sectionHeaderClassName} onClick={onToggle}>
        ACTIONS {shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
        {shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
      </h2>
      {isOpen && (
        <div className={styles.actions}>
          {mintButton}
          {burnButton}
          <SbtPageActionFeedbackDisplay
            burnSuccess={feedbackDisplayDescriptor.burnSuccess}
            copyErrorButtonStyle={copyErrorButtonStyle}
            errorCopyIconState={errorCopyIconState}
            mintSuccess={feedbackDisplayDescriptor.mintSuccess}
            onCopyError={onCopyError}
            transactionError={feedbackDisplayDescriptor.transactionError}
          />
        </div>
      )}
    </div>
  );
};

export default SbtPageActionsSection;
