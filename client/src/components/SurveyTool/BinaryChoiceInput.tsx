import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SurveyTool.module.scss';

const BINARY_OPTIONS = ['Agree', 'Unsure', 'Disagree'] as const;

type BinaryChoiceInputProps = {
  questionId: string | number;
  value?: string;
  disabled?: boolean;
  showIcons?: boolean;
  inputNamePrefix?: string;
  onChange?: ((nextValue: string) => void) | null;
};

export const buildBinaryChoiceOptionClassName = (
  styleMap: Record<string, string>,
  option: string,
  isSelected: unknown,
) =>
  [styleMap.radioOptionText, styleMap[option.toLowerCase()], isSelected ? styleMap.selected : '']
    .filter(Boolean)
    .join(' ');

const BinaryChoiceInput = ({
  questionId,
  value = '',
  disabled = false,
  showIcons = false,
  inputNamePrefix = 'question',
  onChange = null,
}: BinaryChoiceInputProps) => (
  <FormGroup id={styles.binaryChoice}>
    {BINARY_OPTIONS.map((option) => {
      const isSelected = value === option;

      return (
        <Label key={option} check className={buildBinaryChoiceOptionClassName(styles, option, isSelected)}>
          <Input
            type="radio"
            name={`${inputNamePrefix}-${questionId}`}
            value={option}
            checked={isSelected}
            onChange={() => {
              if (typeof onChange === 'function') onChange(option);
            }}
            onClick={() => {
              if (isSelected && typeof onChange === 'function') onChange(option);
            }}
            disabled={disabled}
          />
          {showIcons && option === 'Agree' && <FontAwesomeIcon icon={faCheck} className={styles.optionIcon} />}
          {showIcons && option === 'Disagree' && <FontAwesomeIcon icon={faTimes} className={styles.optionIcon} />}
          {option}
        </Label>
      );
    })}
  </FormGroup>
);

export default BinaryChoiceInput;
