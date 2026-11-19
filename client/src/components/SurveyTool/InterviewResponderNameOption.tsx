/** @file InterviewResponderNameOption.tsx: the interview step's choice to write a name into submitted answers. */
import { Input, Label } from 'reactstrap';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type InterviewResponderNameOptionProps = {
  /** The name or names the answers would carry. */
  names: string[];
  choice: { checked: boolean; mixed: boolean };
  disabled: boolean;
  onChange: (included: boolean) => void;
};

/**
 * Offered only in a session with no place for names. A session that keeps names shows them just to the people
 * it admits, while a name written into an answer reaches everyone who can read answers.
 */
const InterviewResponderNameOption = ({ names, choice, disabled, onChange }: InterviewResponderNameOptionProps) => (
  <Label check className={styles.sessionInterviewProvenance}>
    <Input
      type="checkbox"
      checked={choice.mixed ? false : choice.checked}
      aria-checked={choice.mixed ? 'mixed' : choice.checked}
      innerRef={(element: HTMLInputElement | null) => {
        if (element) element.indeterminate = choice.mixed;
      }}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME}
    />{' '}
    {`Include ${names.map((name) => `“${name}”`).join(', ')} as the responder ${names.length > 1 ? 'names' : 'name'} with submitted responses`}
    {choice.mixed ? ' (mixed saved choices)' : ''}
  </Label>
);

export default InterviewResponderNameOption;
