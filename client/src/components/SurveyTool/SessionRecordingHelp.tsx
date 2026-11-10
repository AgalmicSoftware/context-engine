import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { UncontrolledTooltip } from 'reactstrap';
import styles from './SurveyTool.module.scss';

const HELP = 'Record, upload audio, or add a transcript.';

export default function SessionRecordingHelp() {
  const id = `ce-recording-help-${useId().replace(/:/g, '')}`;
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.sessionInterviewHeaderButton}
        aria-label="About Group Conversation"
        aria-describedby={`${id}-description`}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <span id={`${id}-description`} hidden>
        {HELP}
      </span>
      <UncontrolledTooltip target={id} trigger="hover focus" autohide={false}>
        {HELP}
      </UncontrolledTooltip>
    </>
  );
}
