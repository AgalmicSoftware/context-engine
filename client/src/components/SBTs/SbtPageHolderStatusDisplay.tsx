import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUser } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';
import SbtPageStatsScanProgressDisplay from './SbtPageStatsScanProgressDisplay';

export type SbtPageHolderCountStatus = {
  isInitialLoading: boolean;
  isRefreshing: boolean;
  maxTokensDisplay: string | number;
  mintedCountTitle?: string;
  mintedLabel: string;
  netMinted: string | number;
  refreshIndicatorStyle?: React.CSSProperties;
};

export type SbtPageHolderScanProgressDisplay = {
  scanProgressFillStyle?: React.CSSProperties;
  scanProgressPct: number;
  scanProgressSessionText?: string | null;
  scanProgressText?: string | null;
  showScanProgress: boolean;
};

type SbtPageHolderStatusDisplayProps = {
  countStatus: SbtPageHolderCountStatus;
  onOpenMintedModal: React.MouseEventHandler<HTMLButtonElement>;
  scanProgressDisplay: SbtPageHolderScanProgressDisplay;
};

const SbtPageHolderStatusDisplay = ({
  countStatus,
  onOpenMintedModal,
  scanProgressDisplay,
}: SbtPageHolderStatusDisplayProps): React.ReactElement => {
  const {
    isInitialLoading,
    isRefreshing,
    maxTokensDisplay,
    mintedCountTitle,
    mintedLabel,
    netMinted,
    refreshIndicatorStyle,
  } = countStatus;
  const {
    scanProgressFillStyle,
    scanProgressPct,
    scanProgressSessionText = null,
    scanProgressText = '',
    showScanProgress,
  } = scanProgressDisplay;

  return (
    <>
      <p>
        <span className={styles.label}>{`${mintedLabel}:`}</span>
        {isInitialLoading ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          <span title={mintedCountTitle}>{`${netMinted} / ${maxTokensDisplay}`}</span>
        )}
        {isRefreshing && (
          <span style={refreshIndicatorStyle} title="Refreshing...">
            <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        )}

        <button type="button" onClick={onOpenMintedModal} className={styles.expandButton}>
          <FontAwesomeIcon icon={faUser} />
        </button>
      </p>
      <SbtPageStatsScanProgressDisplay
        scanProgressFillStyle={scanProgressFillStyle}
        scanProgressPct={scanProgressPct}
        scanProgressSessionText={scanProgressSessionText}
        scanProgressText={scanProgressText}
        showScanProgress={showScanProgress}
      />
    </>
  );
};

export default SbtPageHolderStatusDisplay;
