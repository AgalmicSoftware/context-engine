import { useId } from 'react';
import { optionsOf } from '../../../../shared/questions/answerValue.mjs';
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

export const buildMultichoiceOptionClassName = ({
  baseClassName = '',
  isSelected = false,
  selectedClassName = '',
}: {
  baseClassName?: unknown;
  isSelected?: unknown;
  selectedClassName?: unknown;
} = {}): string =>
  [String(baseClassName || ''), isSelected ? String(selectedClassName || '') : ''].filter(Boolean).join(' ');

/** How many options a choice question takes, in the words its card and the interview's drafts both show. */
export const choiceKindLabel = (isSingleSelect: unknown): string => (isSingleSelect ? 'Pick one' : 'Pick any');

export const findDuplicateMultichoiceOptionLabels = (options: unknown[] = []): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  optionsOf({ options }).forEach((option) => {
    const label = option.trim();
    const key = label.toLowerCase();
    if (!key) return;
    if (seen.has(key)) duplicates.add(label);
    seen.add(key);
  });
  return Array.from(duplicates);
};

const MultichoiceQuestionInput = ({
  questionId,
  options = [],
  selectedValues = [],
  isSingleSelect = false,
  disabled = false,
  onChange = null,
}: MultichoiceQuestionInputProps) => {
  const normalizedOptions = optionsOf({ options });
  const normalizedSelectedValues = Array.isArray(selectedValues) ? selectedValues : [];
  const duplicateLabels = findDuplicateMultichoiceOptionLabels(normalizedOptions);
  // The same question can show in two places at once, so the id is per instance.
  const kindId = useId();

  if (duplicateLabels.length > 0) {
    return (
      <FormGroup id={styles.multiChoice}>
        <div role="alert">Multichoice options must have unique labels.</div>
      </FormGroup>
    );
  }

  return (
    <>
      <span className={styles.choiceKindPill} id={kindId}>
        {choiceKindLabel(isSingleSelect)}
      </span>
      <FormGroup id={styles.multiChoice} role="group" aria-describedby={kindId}>
        {normalizedOptions.map((option, optionIndex) => {
          const optionLabel = option;
          const isSelected = normalizedSelectedValues.includes(option);

          return (
            <Label
              check
              key={`${optionLabel}-${optionIndex}`}
              className={buildMultichoiceOptionClassName({
                baseClassName: styles.checkboxOptionText,
                isSelected,
                selectedClassName: styles.selected,
              })}
            >
              <Input
                type="checkbox"
                name={`question-${questionId}`}
                value={optionLabel}
                onChange={(event) => {
                  if (disabled) return;
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
    </>
  );
};

export default MultichoiceQuestionInput;
