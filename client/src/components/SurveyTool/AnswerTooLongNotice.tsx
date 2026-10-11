import React from 'react';

import styles from './SurveyTool.module.scss';

// Shown under an answer the session Worker would refuse as too long.
const AnswerTooLongNotice = ({ message = '' }: { message?: string }): React.ReactElement | null =>
  message ? (
    <p className={styles.answerTooLongNotice} role="status">
      {message}
    </p>
  ) : null;

export default AnswerTooLongNotice;
