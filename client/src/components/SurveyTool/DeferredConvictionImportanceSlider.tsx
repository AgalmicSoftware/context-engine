import React from 'react';
import DeferredCommitSlider from './DeferredCommitSlider';
import ConvictionImportanceLabel from './ConvictionImportanceLabel';
import CESlider from '../Shared/CESlider';
import styles from './SurveyTool.module.scss';
import type { SliderMode } from './surveyToolSliderState.js';
import { RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';

type DeferredConvictionImportanceSliderProps = {
  value: number;
  disabled?: boolean;
  importanceToggleEnabled?: boolean;
  sliderMode: SliderMode;
  isExpanded: boolean;
  convictionValue: number;
  importanceValue: number;
  onSelectMode: (mode: SliderMode) => void;
  onCommit?: (value: number) => void;
};

const DeferredConvictionImportanceSlider = ({
  value,
  disabled = false,
  importanceToggleEnabled = false,
  sliderMode,
  isExpanded,
  convictionValue,
  importanceValue,
  onSelectMode,
  onCommit,
}: DeferredConvictionImportanceSliderProps) => (
  <DeferredCommitSlider
    value={value}
    min={RATING_MIN}
    max={RATING_MAX}
    step={1}
    tooltip={false}
    disabled={disabled}
    onCommit={onCommit}
  >
    {({ value: liveValue, sliderProps }) => (
      <>
        <ConvictionImportanceLabel
          importanceToggleEnabled={importanceToggleEnabled}
          sliderMode={sliderMode}
          isExpanded={isExpanded}
          convictionValue={sliderMode === 'conviction' ? liveValue : convictionValue}
          importanceValue={sliderMode === 'importance' ? liveValue : importanceValue}
          onSelectMode={onSelectMode}
        />
        <CESlider
          {...sliderProps}
          className={[sliderProps.className, styles.convictionSlider].filter(Boolean).join(' ')}
        />
      </>
    )}
  </DeferredCommitSlider>
);

export default DeferredConvictionImportanceSlider;
