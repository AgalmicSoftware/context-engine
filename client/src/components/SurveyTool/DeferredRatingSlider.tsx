import React from 'react';
import { FormText } from 'reactstrap';
import DeferredCommitSlider from './DeferredCommitSlider';
import CESlider from '../Shared/CESlider';
import styles from './SurveyTool.module.scss';
import { DEFAULT_RATING_SCALE, type RatingScale } from '../../utilities/survey/ratingValue.js';

type DeferredRatingSliderProps = {
  value: number;
  scale?: RatingScale;
  disabled?: boolean;
  onCommit?: (value: number) => void;
};

export const resolveDeferredRatingSliderStyle = (): React.CSSProperties => ({
  width: '200px',
});

const DeferredRatingSlider = ({ value, scale = DEFAULT_RATING_SCALE, disabled = false, onCommit }: DeferredRatingSliderProps) => (
  <DeferredCommitSlider
    value={value}
    min={scale.min}
    max={scale.max}
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
        <FormText className={styles.ratingLabelText}>
          <span>{scale.minLabel}</span>
          <span aria-label="Current rating">{liveValue}</span>
          <span>{scale.maxLabel}</span>
        </FormText>
      </>
    )}
  </DeferredCommitSlider>
);

export default DeferredRatingSlider;
