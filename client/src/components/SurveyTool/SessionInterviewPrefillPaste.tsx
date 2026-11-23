import { useState } from 'react';
import { Button, Input } from 'reactstrap';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type Props = {
  /** Imports what was pasted: '' when it was used, otherwise why it wasn't. */
  onImport: (text: string) => string;
};

// What the AI gave as text does the same job as its review link: its packet of draft answers, or the link itself.
export default function SessionInterviewPrefillPaste({ onImport }: Props) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  return (
    <div className={styles.sessionInterviewContext} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_PASTE}>
      <label htmlFor="ce-interview-prefill-json">Paste your AI’s answers</label>
      <Input
        id="ce-interview-prefill-json"
        type="textarea"
        className={styles.sessionInterviewContextInput}
        value={json}
        onChange={(event) => {
          setJson(event.target.value);
          setError('');
        }}
      />
      <Button
        type="button"
        className={styles.sessionListeningGenerate}
        disabled={!json.trim()}
        onClick={() => setError(onImport(json))}
      >
        Review draft answers
      </Button>
      {error ? (
        <p className={styles.sessionListeningError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
