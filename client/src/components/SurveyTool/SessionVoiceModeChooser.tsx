import type { ReactNode } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faMicrophone, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';
import type { SessionVoiceMode } from './sessionInterview';

const CHOICES = [
  {
    mode: 'interview' as const,
    icon: faMicrophone,
    title: 'Interview',
    about: 'Talk with an AI interviewer to answer the session’s questions, then review your responses.',
    testId: E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW,
  },
  {
    mode: 'recordGroup' as const,
    icon: faComments,
    title: 'Group Conversation',
    about: 'Record a group discussion and generate questions and context from it.',
    testId: E2E_TESTIDS.SESSION_VOICE_MODE_GROUP,
  },
];

type SessionVoiceModeChooserProps = {
  onSelectMode: (mode: SessionVoiceMode) => void;
  // Shown below the two choices, such as the AI-prefill option.
  children?: ReactNode;
};

export default function SessionVoiceModeChooser({ onSelectMode, children }: SessionVoiceModeChooserProps) {
  return (
    <div className={styles.sessionVoiceModeLauncher}>
      <div className={styles.sessionVoiceModeChooser} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER}>
        {CHOICES.map(({ mode, icon, title, about, testId }) => (
          <div key={mode} className={styles.sessionVoiceModeChoice}>
            <button
              type="button"
              className={styles.sessionVoiceModeChoiceButton}
              onClick={() => onSelectMode(mode)}
              aria-describedby={`ce-voice-mode-${mode}-about`}
              data-testid={testId}
            >
              <FontAwesomeIcon icon={icon} fixedWidth />
              <strong>{title}</strong>
            </button>
            {/* Beside the choice's icon, but not inside the choice: a button can't hold another. */}
            <button
              type="button"
              id={`ce-voice-mode-${mode}-help`}
              className={`${styles.sessionInterviewHeaderButton} ${styles.sessionVoiceModeChoiceHelp}`}
              data-ce-control-appearance="frameless"
              aria-label={`About ${title}`}
              aria-describedby={`ce-voice-mode-${mode}-about`}
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            {/* Tooltips aren't read out, so screen readers get the description from here,
                with its controls only: `aria-describedby` still reads hidden text. */}
            <span id={`ce-voice-mode-${mode}-about`} hidden>
              {about}
            </span>
            <UncontrolledTooltip
              target={`ce-voice-mode-${mode}-help`}
              placement="top"
              trigger="hover focus"
              autohide={false}
            >
              {about}
            </UncontrolledTooltip>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
