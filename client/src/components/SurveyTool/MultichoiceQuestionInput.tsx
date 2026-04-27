import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SurveyTool.module.scss';

type MultichoiceQuestionInputProps = {
  questionId: string | number;
  options?: unknown[];
  selectedValues?: unknown[];
  isSingleSelect?: boolean;
  disabled?: boolean;
  onChange?: ((nextValues: unknown[]) => void) | null;
};

const MultichoiceQuestionInput = ({
  questionId,
  options = [],
  selectedValues = [],
  isSingleSelect = false,
  disabled = false,
  onChange = null,
}: MultichoiceQuestionInputProps) => {
  const normalizedOptions = Array.isArray(options) ? options : [];
  const normalizedSelectedValues = Array.isArray(selectedValues) ? selectedValues : [];

  return (
    <FormGroup id={styles.multiChoice}>
      {normalizedOptions.map((option, optionIndex) => {
        const optionLabel = String(option);
        const isSelected = normalizedSelectedValues.includes(option);

        return (
          <Label
            check
            key={`${optionLabel}-${optionIndex}`}
            className={`${styles.checkboxOptionText} ${isSelected ? styles.selected : ''}`}
          >
            <Input
              type="checkbox"
              name={`question-${questionId}`}
              value={optionLabel}
              onChange={(event) => {
                const checked = !!event.target.checked;
                let nextValues: unknown[] = [];

                if (isSingleSelect) {
                  nextValues = checked ? [option] : [];
                } else {
                  nextValues = [...normalizedSelectedValues];
                  if (checked) {
                    if (!nextValues.includes(option)) nextValues.push(option);
                  } else {
                    nextValues = nextValues.filter((value) => value !== option);
                  }
                }

                if (typeof onChange === 'function') onChange(nextValues);
              }}
              checked={isSelected}
              disabled={disabled}
            />
            {optionLabel}
          </Label>
        );
      })}
    </FormGroup>
  );
};

export default MultichoiceQuestionInput;
