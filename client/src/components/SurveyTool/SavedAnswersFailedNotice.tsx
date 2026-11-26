import React from 'react';
import { Button } from 'reactstrap';
import styles from './SurveyTool.module.scss';

/** Said where answers are given when the session's saved answers did not load, with a way to load them again. */
export default function SavedAnswersFailedNotice({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <p className={styles.pileSubmitError} role="status">
      Your saved answers did not load, so answers you saved earlier may be missing.{' '}
      <Button color="link" size="sm" className="p-0 align-baseline" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </p>
  );
}
