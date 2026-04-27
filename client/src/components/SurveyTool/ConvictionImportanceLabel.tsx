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
      <h6 id={styles.importanceText} className={styles.convictionValueRow}>
        <span className={styles.convictionToggleLabel}>Conviction</span>
        <span className={styles.convictionToggleValue}>{convictionValue}</span>
      </h6>
    );
  }

  const isConviction = sliderMode === 'conviction';

  return (
    <h6 id={styles.importanceText} className={styles.convictionToggleText}>
      <span className={styles.convictionToggleStack}>
        <button
          type="button"
          className={`${styles.convictionToggleLine} ${isConviction ? styles.convictionToggleButtonActive : ''}`}
          onClick={() => onSelectMode('conviction')}
        >
          <span className={styles.convictionToggleLabel}>Conviction</span>
          <span className={styles.convictionToggleValue}>{convictionValue}</span>
        </button>
        {isExpanded ? (
          <button
            type="button"
            className={`${styles.convictionToggleLine} ${!isConviction ? styles.convictionToggleButtonActive : ''}`}
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
