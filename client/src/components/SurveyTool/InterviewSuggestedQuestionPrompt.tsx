import React, { useState, type ReactNode } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenNib } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './CreateQuestionsAndSurveys.module.scss';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  freeform: 'Freeform',
  rating: 'Rating',
  multichoice: 'Multichoice',
  binary: 'Binary',
};

const normalizeQuestionTypeLabel = (type: unknown): string => {
  const key = String(type || 'freeform')
    .trim()
    .toLowerCase();
  return QUESTION_TYPE_LABELS[key] || 'Freeform';
};

const readOptionText = (option: unknown): string => {
  if (typeof option === 'string' || typeof option === 'number') return String(option).trim();
  if (!option || typeof option !== 'object' || Array.isArray(option)) return '';
  const record = option as { label?: unknown; value?: unknown };
  const candidate =
    typeof record.label === 'string' ? record.label : typeof record.value === 'string' ? record.value : '';
  return candidate.trim();
};

const normalizeOptions = (options: unknown): string[] =>
  (Array.isArray(options) ? options : []).map(readOptionText).filter(Boolean).slice(0, 10);

export default function InterviewSuggestedQuestionPrompt({
  prompt,
  type = 'freeform',
  options = [],
  onChange,
  actions = null,
}: {
  prompt: string;
  type?: string;
  options?: string[];
  onChange: (value: string) => void;
  actions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const label = normalizeQuestionTypeLabel(type);
  const normalizedOptions = normalizeOptions(options);
  return (
    <div className={styles.interviewQuestionPrompt}>
      <div className={styles.interviewQuestionSummary}>
        <span className={styles.interviewQuestionTypeBadge}>{label}</span>
        {label === 'Multichoice' && normalizedOptions.length > 0 && (
          <span className={styles.interviewQuestionOptions}>Options: {normalizedOptions.join(' · ')}</span>
        )}
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
          <button type="button" className={styles.interviewQuestionPromptDoneButton} onClick={() => setEditing(false)}>
            Done editing
          </button>
        </>
      ) : (
        <h3>{prompt || 'Question prompt'}</h3>
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
