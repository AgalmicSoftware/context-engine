import React from 'react';

import {
  buildUserPageDeepScanProgressRowDisplayState,
  type UserPageDeepScanProgressRow,
} from './userPageDeepScanHelpers';

type UserPageDeepScanProgressPanelStyles = Record<string, string>;

export type UserPageDeepScanProgressPanelOptions = {
  headerText?: string;
  showScannedText?: boolean;
};

type UserPageDeepScanProgressPanelProps = UserPageDeepScanProgressPanelOptions & {
  progressRows?: UserPageDeepScanProgressRow[] | null;
  styles: UserPageDeepScanProgressPanelStyles;
};

export const UserPageDeepScanProgressPanel = ({
  headerText = 'Deep scan in progress',
  progressRows,
  showScannedText = true,
  styles,
}: UserPageDeepScanProgressPanelProps): JSX.Element | null => {
  if (!Array.isArray(progressRows) || progressRows.length === 0) return null;

  return (
    <div className={styles.deepScanProgressPanel}>
      {headerText ? <div className={styles.deepScanProgressHeader}>{headerText}</div> : null}
      {progressRows.map((row, index) => {
        const { indeterminateText, progressFillStyle, remainingText, rowKey, scannedText, shouldRenderScannedText } =
          buildUserPageDeepScanProgressRowDisplayState({
            index,
            row,
            showScannedText,
          });

        return (
          <div key={rowKey} className={styles.deepScanProgressRow}>
            <div className={styles.deepScanProgressLabel}>{row.label}</div>
            {row.isDeterminate ? (
              <>
                <div className={styles.deepScanProgressBar}>
                  <div className={styles.deepScanProgressFill} style={progressFillStyle} />
                </div>
                <div className={styles.deepScanProgressStats}>{remainingText}</div>
                {shouldRenderScannedText ? <div className={styles.deepScanProgressStats}>{scannedText}</div> : null}
              </>
            ) : (
              <div className={styles.deepScanIndeterminate}>{indeterminateText}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UserPageDeepScanProgressPanel;
