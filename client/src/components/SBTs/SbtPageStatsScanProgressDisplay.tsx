import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';

type SbtPageStatsScanProgressDisplayProps = {
  scanProgressFillStyle?: React.CSSProperties;
  scanProgressPct: number;
  scanProgressSessionText?: string | null;
  scanProgressText?: string | null;
  showScanProgress: boolean;
};

const SbtPageStatsScanProgressDisplay = ({
  scanProgressFillStyle,
  scanProgressPct,
  scanProgressSessionText = null,
  scanProgressText = '',
  showScanProgress,
}: SbtPageStatsScanProgressDisplayProps): React.ReactElement | null => {
  if (!showScanProgress) return null;

  return (
    <div className={styles.scanProgress}>
      <FontAwesomeIcon icon={faSpinner} spin className={styles.scanSpinner} />
      <div className={styles.scanProgressContent}>
        <span className={styles.scanProgressText}>{scanProgressText}</span>
        {scanProgressSessionText ? <span className={styles.scanProgressSession}>{scanProgressSessionText}</span> : null}
        <div
          className={styles.scanProgressBar}
          role="progressbar"
          aria-valuenow={scanProgressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={styles.scanProgressFill} style={scanProgressFillStyle} />
        </div>
      </div>
    </div>
  );
};

export default SbtPageStatsScanProgressDisplay;
