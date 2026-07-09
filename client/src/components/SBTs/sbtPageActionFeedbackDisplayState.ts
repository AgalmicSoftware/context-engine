import type React from 'react';

import { getShortenedTransactionHash } from '../../utilities/ui/displayHelpers.js';
import type {
  SbtPageActionErrorFeedbackDisplay,
  SbtPageActionSuccessFeedbackDisplay,
} from './SbtPageActionFeedbackDisplay';

type SbtPageActionFeedbackState = {
  showBurnSuccess?: boolean;
  showErrorTransactionHash?: boolean;
  showMintSuccess?: boolean;
  showTransactionError?: boolean;
};

type SbtPageActionsTransactionState = {
  lastBurnTxHash?: unknown;
  lastMintTxHash?: unknown;
  transactionHash?: unknown;
};

export type SbtPageActionFeedbackLabels = {
  burnLabel: string;
  burnedLowerLabel: string;
  mintLabel: string;
  mintedLowerLabel: string;
  sbtLabel: string;
};

export type SbtPageActionFeedbackDisplayDescriptor = {
  burnSuccess: SbtPageActionSuccessFeedbackDisplay;
  mintSuccess: SbtPageActionSuccessFeedbackDisplay;
  transactionError: SbtPageActionErrorFeedbackDisplay;
};

const buildTransactionLink = ({
  getExplorerLink,
  hash,
  show,
}: {
  getExplorerLink: (hash: unknown) => string;
  hash: unknown;
  show?: boolean;
}) => ({
  href: show ? getExplorerLink(hash) : '',
  text: show ? getShortenedTransactionHash(hash) : '',
});

export const resolveSbtPageActionFeedbackDisplayDescriptor = ({
  actionFeedbackState,
  errorMessage,
  getExplorerLink,
  labels,
  transactionState = {},
}: {
  actionFeedbackState: SbtPageActionFeedbackState;
  errorMessage: React.ReactNode;
  getExplorerLink: (hash: unknown) => string;
  labels: SbtPageActionFeedbackLabels;
  transactionState?: SbtPageActionsTransactionState;
}): SbtPageActionFeedbackDisplayDescriptor => {
  const { lastBurnTxHash = '', lastMintTxHash = '', transactionHash = '' } = transactionState;
  const mintSuccess = {
    message: `${labels.sbtLabel} successfully ${labels.mintedLowerLabel}!`,
    show: actionFeedbackState.showMintSuccess,
    txLabel: `${labels.mintLabel} Tx Hash:`,
    txLink: buildTransactionLink({
      getExplorerLink,
      hash: lastMintTxHash,
      show: actionFeedbackState.showMintSuccess,
    }),
  };
  const burnSuccess = {
    message: `${labels.sbtLabel} successfully ${labels.burnedLowerLabel}!`,
    show: actionFeedbackState.showBurnSuccess,
    txLabel: `${labels.burnLabel} Tx Hash:`,
    txLink: buildTransactionLink({
      getExplorerLink,
      hash: lastBurnTxHash,
      show: actionFeedbackState.showBurnSuccess,
    }),
  };
  const errorTxLink = actionFeedbackState.showErrorTransactionHash
    ? buildTransactionLink({
        getExplorerLink,
        hash: transactionHash,
        show: true,
      })
    : null;

  return {
    burnSuccess,
    mintSuccess,
    transactionError: {
      errorMessage,
      show: actionFeedbackState.showTransactionError,
      txLink: errorTxLink,
    },
  };
};
