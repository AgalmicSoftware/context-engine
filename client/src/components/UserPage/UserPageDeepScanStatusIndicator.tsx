import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import UserPageDeepScanProgressPanel from './UserPageDeepScanProgressPanel';
import type { UserPageDeepScanProgressRow } from './userPageDeepScanHelpers';
import styles from './UserPage.module.scss';

type UserPageDeepScanStatusIndicatorProps = {
  onSpinnerEvent?: (event: React.MouseEvent<HTMLElement | SVGSVGElement>) => unknown;
  progressRows?: UserPageDeepScanProgressRow[] | null;
  targetId: string;
  titleText: string;
  tooltipLines?: string[] | null;
};

const renderDeepScanTooltipContent = (
  tooltipLines: string[] | null | undefined,
  progressRows: UserPageDeepScanProgressRow[] | null | undefined,
): React.ReactNode => {
  if (Array.isArray(progressRows) && progressRows.length > 0) {
    return (
      <UserPageDeepScanProgressPanel
        headerText="Deep scan in progress"
        progressRows={progressRows}
        showScannedText={true}
        styles={styles}
      />
    );
  }

  if (!Array.isArray(tooltipLines) || tooltipLines.length === 0) return null;
  return tooltipLines.map((line, index) => <div key={`deepScanTextLine_${index}`}>{line}</div>);
};

const renderDeepScanTooltip = (
  targetId: string,
  tooltipLines: string[] | null | undefined,
  progressRows: UserPageDeepScanProgressRow[] | null | undefined,
): React.ReactNode => {
  if (
    (!Array.isArray(tooltipLines) || tooltipLines.length === 0) &&
    (!Array.isArray(progressRows) || progressRows.length === 0)
  )
    return null;
  return (
    <CETooltip
      placement="right"
      target={targetId}
      className={styles.deepScanTooltip}
      innerClassName={styles.deepScanTooltipInner}
      trigger="hover focus click"
      autohide={false}
    >
      {renderDeepScanTooltipContent(tooltipLines, progressRows)}
    </CETooltip>
  );
};

const UserPageDeepScanStatusIndicator = ({
  onSpinnerEvent,
  progressRows,
  targetId,
  titleText,
  tooltipLines,
}: UserPageDeepScanStatusIndicatorProps): React.ReactElement => {
  const handleSpinnerEvent = (event: React.MouseEvent<HTMLElement | SVGSVGElement>): void => {
    onSpinnerEvent?.(event);
  };

  return (
    <>
      <span className={styles.cornerLoadingStatus} onClick={handleSpinnerEvent} onMouseDown={handleSpinnerEvent}>
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className={styles.cornerSpinner}
          id={targetId}
          title={titleText || undefined}
          onClick={handleSpinnerEvent}
          onMouseDown={handleSpinnerEvent}
        />
      </span>
      {renderDeepScanTooltip(targetId, tooltipLines, progressRows)}
    </>
  );
};

export default UserPageDeepScanStatusIndicator;
