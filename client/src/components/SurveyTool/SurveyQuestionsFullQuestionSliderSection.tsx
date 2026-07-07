import React from 'react';

import BullhornToggleButton from './BullhornToggleButton';
import ConvictionImportanceLabel from './ConvictionImportanceLabel';
import ConvictionImportanceSliderControl from './ConvictionImportanceSliderControl';
import DeferredConvictionImportanceSlider from './DeferredConvictionImportanceSlider';
import styles from './SurveyTool.module.scss';
import { shouldExpandSliderToggle } from './surveyToolUtils.js';
import type { SliderMode } from './surveyToolSliderState.js';

type SurveyQuestionsFullQuestionSliderSectionProps = {
  activeSliderValue?: number;
  collapsedSliderMode?: SliderMode;
  convictionValue?: number;
  hasConvictionImportanceValue?: boolean;
  importanceToggleEnabled?: boolean;
  importanceValue?: number;
  isSubmitting?: boolean;
  onChange?: (nextValue: number, event?: unknown) => void;
  onChangeComplete?: (event?: unknown) => void;
  onCommit?: (nextValue: number) => void;
  onSelectMode: (nextMode: SliderMode) => void;
  questionId: string;
  singleQuestionMode?: boolean;
  sliderMode?: SliderMode;
  sliderOpen?: boolean;
  sliderToggleExpandedByQuestion?: Record<string, unknown>;
};

const SurveyQuestionsFullQuestionSliderSection = ({
  activeSliderValue = 0,
  collapsedSliderMode = 'conviction',
  convictionValue = 0,
  hasConvictionImportanceValue = false,
  importanceToggleEnabled = false,
  importanceValue = 0,
  isSubmitting = false,
  onChange,
  onChangeComplete,
  onCommit,
  onSelectMode,
  questionId,
  singleQuestionMode = false,
  sliderMode = 'conviction',
  sliderOpen = false,
  sliderToggleExpandedByQuestion = {},
}: SurveyQuestionsFullQuestionSliderSectionProps): React.ReactElement => {
  const isExpanded = shouldExpandSliderToggle({
    sliderToggleExpandedByQuestion,
    questionId,
    sliderMode,
  });

  if (!sliderOpen) {
    return (
      <div className={styles.importanceSlider}>
        <BullhornToggleButton
          onClick={() => onSelectMode(importanceToggleEnabled ? collapsedSliderMode : sliderMode)}
          disabled={isSubmitting}
          active={hasConvictionImportanceValue}
        />
      </div>
    );
  }

  return (
    <div className={styles.importanceSlider}>
      {singleQuestionMode ? (
        <DeferredConvictionImportanceSlider
          value={activeSliderValue}
          disabled={isSubmitting}
          importanceToggleEnabled={importanceToggleEnabled}
          sliderMode={sliderMode}
          isExpanded={isExpanded}
          convictionValue={convictionValue}
          importanceValue={importanceValue}
          onSelectMode={onSelectMode}
          onCommit={onCommit}
        />
      ) : (
        <ConvictionImportanceSliderControl
          label={
            <ConvictionImportanceLabel
              importanceToggleEnabled={importanceToggleEnabled}
              sliderMode={sliderMode}
              isExpanded={isExpanded}
              convictionValue={convictionValue}
              importanceValue={importanceValue}
              onSelectMode={onSelectMode}
            />
          }
          value={activeSliderValue}
          disabled={isSubmitting}
          onChange={onChange}
          onChangeComplete={onChangeComplete}
        />
      )}
    </div>
  );
};

export default SurveyQuestionsFullQuestionSliderSection;
