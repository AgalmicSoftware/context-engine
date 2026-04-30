import React from 'react';
import CESlider from '../Shared/CESlider';
import styles from './SurveyTool.module.scss';

type ConvictionImportanceSliderControlProps = {
  label?: React.ReactNode;
  value?: number;
  disabled?: boolean;
  onChange?: ((nextValue: number, event?: unknown) => void) | null;
  onChangeComplete?: ((event?: unknown) => void) | null;
};

const ConvictionImportanceSliderControl = ({
  label = null,
  value = 0,
  disabled = false,
  onChange = null,
  onChangeComplete = null,
}: ConvictionImportanceSliderControlProps) => (
  <>
    {label}
    <CESlider
      min={0}
      max={10}
      step={1}
      value={value}
      className={styles.convictionSlider}
      tooltip={false}
      onChange={(nextValue, event) => {
        if (typeof onChange === 'function') onChange(Number(nextValue), event);
      }}
      onChangeComplete={(event) => {
        if (typeof onChangeComplete === 'function') onChangeComplete(event);
      }}
      disabled={disabled}
    />
  </>
);

export default ConvictionImportanceSliderControl;
