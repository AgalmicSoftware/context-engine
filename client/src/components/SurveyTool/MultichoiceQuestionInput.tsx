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
  /** The prompt shows the kind (PromptWithChoiceKind); the options' group still names it for screen readers. */
  kindInPrompt?: boolean;
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

// A last word longer than this (a link, a long compound) may need to break, so the pill does not hold it on a line.
const PROMPT_END_WORD_MAX = 20;

/**
 * The prompt's text with "Pick one" or "Pick any" at its end, the pill kept on one line with the last word so it
 * never sits on a line alone. Screen readers hear it with the options instead (see kindInPrompt).
 */
export const PromptWithChoiceKind = ({ text, kind }: { text: string; kind: string }) => {
  const match = /^([\s\S]*?)(\S+)\s*$/.exec(text);
  const pill = (
    <span className={styles.choiceKindPill} aria-hidden="true">
      {kind}
    </span>
  );
  if (!match) return pill;
  if (match[2].length > PROMPT_END_WORD_MAX) {
    return (
      <>
        {match[1]}
        {match[2]} {pill}
      </>
    );
  }
  return (
    <>
      {match[1]}
      <span className={styles.choiceKindPromptEnd}>
        {match[2]} {pill}
      </span>
    </>
  );
};

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
  kindInPrompt = false,
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
      {!kindInPrompt && (
        <span className={styles.choiceKindPill} id={kindId}>
          {choiceKindLabel(isSingleSelect)}
        </span>
      )}
      <FormGroup
        id={styles.multiChoice}
        role="group"
        {...(kindInPrompt ? { 'aria-label': choiceKindLabel(isSingleSelect) } : { 'aria-labelledby': kindId })}
      >
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
