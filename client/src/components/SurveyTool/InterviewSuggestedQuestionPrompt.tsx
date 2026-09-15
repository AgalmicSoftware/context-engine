import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenNib } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './CreateQuestionsAndSurveys.module.scss';

export default function InterviewSuggestedQuestionPrompt({
  prompt,
  onChange,
}: {
  prompt: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={styles.interviewQuestionPrompt}>
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
          <button type="button" onClick={() => setEditing(false)}>
            Done editing
          </button>
        </>
      ) : (
        <>
          <h3>{prompt || 'Question prompt'}</h3>
          <button
            type="button"
            aria-label="Edit suggested question"
            title="Edit question"
            onClick={() => setEditing(true)}
          >
            <FontAwesomeIcon icon={faPenNib} />
          </button>
        </>
      )}
    </div>
  );
}
