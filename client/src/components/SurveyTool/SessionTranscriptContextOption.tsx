import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import ContextAccessPicker from '../Sessions/setup/ContextAccessPicker';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { useTranscriptContextUpload } from './useTranscriptContextUpload';
import styles from './SurveyTool.module.scss';

const ABOUT =
  'Submitting also uploads the whole transcript as a file in this session’s context, showing that you added it. Everyone you choose here can read every speaker’s words, and the session’s AI can use them when it works for one of those people. Ask the group first.';

type Props = { upload: ReturnType<typeof useTranscriptContextUpload> };

/** On the Submit questions line: a large checkbox, and once ticked, who may read the transcript. */
export default function SessionTranscriptContextOption({ upload }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <span className={styles.sessionTranscriptContext}>
      <span className={styles.sessionRecordingOption}>
        <label className={styles.sessionTranscriptContextLabel}>
          <input
            type="checkbox"
            checked={upload.chosen}
            data-testid={E2E_TESTIDS.SESSION_TRANSCRIPT_CONTEXT}
            onChange={(event) => upload.setChosen(event.target.checked)}
          />
          <span>Add transcript to context</span>
        </label>
        <button
          type="button"
          id={`ce-transcript-context-help-${id}`}
          className={styles.sessionInterviewHeaderButton}
          aria-label="About adding the transcript to context"
          aria-describedby={`ce-transcript-context-about-${id}`}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <span id={`ce-transcript-context-about-${id}`} hidden>
          {ABOUT}
        </span>
        <UncontrolledTooltip target={`ce-transcript-context-help-${id}`} trigger="hover focus" autohide={false}>
          {ABOUT}
        </UncontrolledTooltip>
      </span>
      {upload.chosen ? (
        <ContextAccessPicker
          id={`ce-transcript-context-access-${id}`}
          className={styles.sessionTranscriptContextAccess}
          aria-label="Who can read the transcript"
          value={upload.access}
          groups={upload.groups}
          allowAdminsOnly={upload.allowAdminsOnly}
          onChange={upload.setAccess}
        />
      ) : null}
    </span>
  );
}
