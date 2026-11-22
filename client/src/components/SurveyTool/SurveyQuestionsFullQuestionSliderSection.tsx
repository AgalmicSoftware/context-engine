import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import BullhornToggleButton from './BullhornToggleButton';
import ConvictionImportanceLabel from './ConvictionImportanceLabel';
import ConvictionImportanceSliderControl from './ConvictionImportanceSliderControl';
import DeferredConvictionImportanceSlider from './DeferredConvictionImportanceSlider';
import styles from './SurveyTool.module.scss';
import { shouldExpandSliderToggle } from './surveyToolUtils';
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
  // Closes the slider and returns both ratings to their submitted values (none if never submitted).
  onClear?: () => void;
  onCommit?: (nextValue: number) => void;
  onSelectMode: (nextMode: SliderMode) => void;
  questionId: string;
  singleQuestionMode?: boolean;
  sliderMode?: SliderMode;
  sliderOpen?: boolean;
  sliderToggleExpandedByQuestion?: Record<string, unknown>;
};

const ClearConvictionImportanceButton = ({
  disabled,
  importanceToggleEnabled,
  onClick,
}: {
  disabled: boolean;
  importanceToggleEnabled: boolean;
  onClick: () => void;
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const label = importanceToggleEnabled ? 'Undo conviction and importance' : 'Undo conviction';
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`${styles.iconButton} ${styles.convictionClearButton}`}
        aria-label={label}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <CETooltip target={buttonRef} placement="top" trigger="hover focus">
        {importanceToggleEnabled
          ? 'Close the slider and undo your conviction and importance changes since you last submitted.'
          : 'Close the slider and undo your conviction changes since you last submitted.'}
      </CETooltip>
    </>
  );
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
  onClear,
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
  // The X unmounts itself, so keyboard focus moves to the bullhorn that replaces it.
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const focusBullhornRef = useRef(false);
  useEffect(() => {
    if (sliderOpen || !focusBullhornRef.current) return;
    focusBullhornRef.current = false;
    sectionRef.current?.querySelector('button')?.focus();
  }, [sliderOpen]);

  if (!sliderOpen) {
    return (
      <div ref={sectionRef} className={styles.importanceSlider}>
        <BullhornToggleButton
          onClick={() => onSelectMode(importanceToggleEnabled ? collapsedSliderMode : sliderMode)}
          disabled={isSubmitting}
          active={hasConvictionImportanceValue}
        />
      </div>
    );
  }

  return (
    <div ref={sectionRef} className={`${styles.importanceSlider} ${onClear ? styles.convictionSliderWithClear : ''}`}>
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
      {onClear ? (
        <ClearConvictionImportanceButton
          disabled={isSubmitting}
          importanceToggleEnabled={importanceToggleEnabled}
          onClick={() => {
            focusBullhornRef.current = true;
            onClear();
          }}
        />
      ) : null}
    </div>
  );
};

export default SurveyQuestionsFullQuestionSliderSection;
