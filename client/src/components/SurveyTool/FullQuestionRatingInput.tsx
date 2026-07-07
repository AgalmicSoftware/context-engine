import React from 'react';
import { FormText } from 'reactstrap';
import CESlider from '../Shared/CESlider';
import { RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';
import styles from './SurveyTool.module.scss';

type FullQuestionRatingInputProps = {
  value?: number;
  disabled?: boolean;
  onChange?: ((nextValue: number, event?: unknown) => void) | null;
  onChangeComplete?: ((event?: unknown) => void) | null;
};

const FullQuestionRatingInput = ({
  value = 0,
  disabled = false,
  onChange = null,
  onChangeComplete = null,
}: FullQuestionRatingInputProps) => (
  <>
    <div className={styles.importanceSlider}>
      <CESlider
        min={RATING_MIN}
        max={RATING_MAX}
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
        style={{ width: '200px' }}
        disabled={disabled}
      />
    </div>
    <FormText className={styles.ratingLabelText}>{value}</FormText>
  </>
);

export default FullQuestionRatingInput;
