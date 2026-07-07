import React from 'react';
import type { ReactElement } from 'react';
import styles from './SurveyTool.module.scss';
import type { SliderMode } from './surveyToolSliderState.js';

type ConvictionImportanceLabelProps = {
  importanceToggleEnabled?: boolean;
  sliderMode: SliderMode;
  isExpanded: boolean;
  convictionValue: number;
  importanceValue: number;
  onSelectMode: (mode: SliderMode) => void;
};

export const buildConvictionImportanceToggleLineClassName = ({
  activeClassName = '',
  baseClassName = '',
  isActive = false,
}: {
  activeClassName?: unknown;
  baseClassName?: unknown;
  isActive?: unknown;
} = {}): string =>
  [String(baseClassName || ''), isActive ? String(activeClassName || '') : ''].filter(Boolean).join(' ');

const ConvictionImportanceLabel = ({
  importanceToggleEnabled = false,
  sliderMode,
  isExpanded,
  convictionValue,
  importanceValue,
  onSelectMode,
}: ConvictionImportanceLabelProps): ReactElement => {
  if (!importanceToggleEnabled) {
    return (
      <h6 className={`${styles.importanceText} ${styles.convictionValueRow}`}>
        <span className={styles.convictionToggleLabel}>Conviction</span>
        <span className={styles.convictionToggleValue}>{convictionValue}</span>
      </h6>
    );
  }

  const isConviction = sliderMode === 'conviction';

  return (
    <h6 className={`${styles.importanceText} ${styles.convictionToggleText}`}>
      <span className={styles.convictionToggleStack}>
        <button
          type="button"
          className={buildConvictionImportanceToggleLineClassName({
            activeClassName: styles.convictionToggleButtonActive,
            baseClassName: styles.convictionToggleLine,
            isActive: isConviction,
          })}
          onClick={() => onSelectMode('conviction')}
        >
          <span className={styles.convictionToggleLabel}>Conviction</span>
          <span className={styles.convictionToggleValue}>{convictionValue}</span>
        </button>
        {isExpanded ? (
          <button
            type="button"
            className={buildConvictionImportanceToggleLineClassName({
              activeClassName: styles.convictionToggleButtonActive,
              baseClassName: styles.convictionToggleLine,
              isActive: !isConviction,
            })}
            onClick={() => onSelectMode('importance')}
          >
            <span className={styles.convictionToggleLabel}>Importance</span>
            <span className={styles.convictionToggleValue}>{importanceValue}</span>
          </button>
        ) : null}
      </span>
    </h6>
  );
};

export default ConvictionImportanceLabel;
