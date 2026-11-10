import { useId, useState, type ReactNode } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenNib } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import styles from './CreateQuestionsAndSurveys.module.scss';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  freeform: 'Freeform',
  rating: 'Rating',
  multichoice: 'Multichoice',
  binary: 'Binary',
  quadratic: 'Quadratic allocation',
};

const normalizeQuestionType = (type: unknown): string => {
  const key = String(type || 'freeform')
    .trim()
    .toLowerCase();
  return key in QUESTION_TYPE_LABELS ? key : 'freeform';
};
// A freeform answer is a text and voice field, too large to preview, so its card shows only the type.
const PREVIEWED_TYPES = ['binary', 'rating', 'multichoice', 'quadratic'];

const readOptionText = (option: unknown): string => {
  if (typeof option === 'string' || typeof option === 'number') return String(option).trim();
  if (!option || typeof option !== 'object' || Array.isArray(option)) return '';
  const record = option as { label?: unknown; value?: unknown };
  const candidate =
    typeof record.label === 'string' ? record.label : typeof record.value === 'string' ? record.value : '';
  return candidate.trim();
};

const normalizeOptions = (options: unknown): string[] =>
  (Array.isArray(options) ? options : []).map(readOptionText).filter(Boolean);

export default function InterviewSuggestedQuestionPrompt({
  prompt,
  type = 'freeform',
  options = [],
  singleSelect = false,
  voiceCredits,
  onChange,
  actions = null,
  editor = null,
}: {
  prompt: string;
  type?: string;
  options?: string[];
  // With the options, they shape the answer preview.
  singleSelect?: boolean;
  voiceCredits?: number;
  onChange: (value: string) => void;
  actions?: ReactNode;
  // Edits the rest of the question, such as its options; shown in place of the preview while editing.
  editor?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const previewId = `preview-${useId().replace(/:/g, '')}`;
  const questionType = normalizeQuestionType(type);
  return (
    <div className={styles.interviewQuestionPrompt}>
      <div className={styles.interviewQuestionSummary}>
        <span className={styles.interviewQuestionTypeBadge}>{QUESTION_TYPE_LABELS[questionType]}</span>
      </div>
      {editing ? (
        <>
          <Input
            autoFocus
            type="textarea"
            rows={3}
            aria-label="Edit suggested question"
            data-testid={E2E_TESTIDS.CREATE_QUESTION_PROMPT}
            value={prompt}
            onChange={(event) => onChange(event.target.value)}
          />
          {editor}
          <button type="button" className={styles.interviewQuestionPromptDoneButton} onClick={() => setEditing(false)}>
            Done editing
          </button>
        </>
      ) : (
        <>
          <h3>{prompt || 'Question prompt'}</h3>
          {PREVIEWED_TYPES.includes(questionType) ? (
            // The answer as respondents see it; it takes no focus or input here.
            <fieldset disabled aria-label="Answer preview" className={styles.interviewQuestionPreview}>
              <SurveyQuestionsFullQuestionResponseInput
                question={{
                  id: previewId,
                  type: questionType,
                  options: normalizeOptions(options),
                  singleSelect,
                  voiceCredits,
                }}
                answer={{}}
                isSubmitting
              />
            </fieldset>
          ) : null}
        </>
      )}
      <div className={styles.interviewQuestionPromptActions}>
        {!editing ? (
          <button
            type="button"
            aria-label="Edit suggested question"
            title="Edit question"
            className={styles.interviewQuestionPromptEditButton}
            onClick={() => setEditing(true)}
          >
            <FontAwesomeIcon icon={faPenNib} />
          </button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
