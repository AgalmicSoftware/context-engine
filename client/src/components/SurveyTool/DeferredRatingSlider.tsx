import React from 'react';
import { FormText } from 'reactstrap';
import DeferredCommitSlider from './DeferredCommitSlider';
import CESlider from '../Shared/CESlider';
import styles from './SurveyTool.module.scss';
import { RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';

type DeferredRatingSliderProps = {
  value: number;
  disabled?: boolean;
  onCommit?: (value: number) => void;
};

export const resolveDeferredRatingSliderStyle = (): React.CSSProperties => ({
  width: '200px',
});

const DeferredRatingSlider = ({ value, disabled = false, onCommit }: DeferredRatingSliderProps) => (
  <DeferredCommitSlider
    value={value}
    min={RATING_MIN}
    max={RATING_MAX}
    step={1}
    tooltip={false}
    disabled={disabled}
    className={styles.ratingSlider}
    style={resolveDeferredRatingSliderStyle()}
    onCommit={onCommit}
  >
    {({ value: liveValue, sliderProps }) => (
      <>
        <div className={styles.importanceSlider}>
          <CESlider {...sliderProps} />
        </div>
        <FormText className={styles.ratingLabelText}>{liveValue}</FormText>
      </>
    )}
  </DeferredCommitSlider>
);

export default DeferredRatingSlider;
