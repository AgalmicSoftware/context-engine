import React from 'react';
import { FormText } from 'reactstrap';
import CESlider from '../Shared/CESlider';
import { DEFAULT_RATING_SCALE, type RatingScale } from '../../utilities/survey/ratingValue.js';
import styles from './SurveyTool.module.scss';

type FullQuestionRatingInputProps = {
  value?: number;
  scale?: RatingScale;
  disabled?: boolean;
  onChange?: ((nextValue: number, event?: unknown) => void) | null;
  onChangeComplete?: ((event?: unknown) => void) | null;
};

export const resolveFullQuestionRatingSliderStyle = (): React.CSSProperties => ({
  width: '200px',
});

const FullQuestionRatingInput = ({
  value = DEFAULT_RATING_SCALE.min,
  scale = DEFAULT_RATING_SCALE,
  disabled = false,
  onChange = null,
  onChangeComplete = null,
}: FullQuestionRatingInputProps) => (
  <>
    <div className={styles.importanceSlider}>
      <CESlider
        min={scale.min}
        max={scale.max}
        step={1}
        value={value}
        tooltip={false}
        onChange={(nextValue, event) => {
          if (typeof onChange === 'function') onChange(Number(nextValue), event);
        }}
        onChangeComplete={(event) => {
          if (typeof onChangeComplete === 'function') onChangeComplete(event);
        }}
        className={styles.ratingSlider}
        style={resolveFullQuestionRatingSliderStyle()}
        disabled={disabled}
      />
    </div>
    <FormText className={styles.ratingLabelText}>
      <span>{scale.minLabel}</span>
      <span aria-label="Current rating">{value}</span>
      <span>{scale.maxLabel}</span>
    </FormText>
  </>
);

export default FullQuestionRatingInput;
