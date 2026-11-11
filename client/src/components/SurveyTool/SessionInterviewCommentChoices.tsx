import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import type { InterviewCommentChoice } from './sessionInterviewComments';
import styles from './SessionInterviewDraftCard.module.scss';

const explain = (locked: boolean) =>
  locked
    ? 'Your earlier comment is locked, so it stays unless you choose the AI’s. Writing in the box replaces it.'
    : 'Both keeps your earlier comment with the AI’s addition after it. Mine keeps only yours, and AI’s uses only the AI’s. You can also edit the text.';

type Props = {
  choices: InterviewCommentChoice[];
  // The comment the card holds now; the choice that matches it shows as pressed.
  value: string;
  locked: boolean;
  disabled: boolean;
  onChoose: (value: string) => void;
};

/** Quick choices between the person's earlier comment and the AI's, above the comment they can edit. */
export default function SessionInterviewCommentChoices({ choices, value, locked, disabled, onChoose }: Props) {
  const helpId = `ce-comment-choices-help-${useId().replace(/:/g, '')}`;
  const explanation = explain(locked);
  return (
    <div className={styles.commentChoices} role="group" aria-label="Comment to submit">
      {choices.map((choice) => (
        <button
          key={choice.label}
          type="button"
          className={styles.commentChoice}
          aria-pressed={value === choice.value}
          disabled={disabled}
          onClick={() => onChoose(choice.value)}
        >
          {value === choice.value ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" /> : null}
          {choice.label}
        </button>
      ))}
      <button
        type="button"
        id={helpId}
        className={styles.commentChoicesHelp}
        aria-label="About these comment choices"
        aria-describedby={`${helpId}-description`}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      {/* Tooltips aren't read out, so the description reaches screen readers through its control only. */}
      <span id={`${helpId}-description`} hidden>
        {explanation}
      </span>
      <UncontrolledTooltip target={helpId} placement="top" trigger="hover focus" autohide={false}>
        {explanation}
      </UncontrolledTooltip>
    </div>
  );
}
